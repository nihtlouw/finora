import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { budgetPeriodRange, normalizeBudgetPeriod, positiveMoney, requireText } from '@/lib/validation/finance'
export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const rows = await prisma.budget.findMany({ where: { workspaceId: c.workspace.id }, orderBy: [{ period: 'desc' }, { category: 'asc' }] })
  const budgets = await Promise.all(rows.map(async row => {
    const { start, end } = budgetPeriodRange(row.period)
    const actual = await prisma.cashflowTransaction.aggregate({
      where: {
        type: 'EXPENSE',
        category: row.category,
        transactionDate: { gte: start, lt: end },
        OR: [
          { workspaceId: c.workspace.id },
          { expense: { workspaceId: c.workspace.id } },
          { payment: { invoice: { client: { workspaceId: c.workspace.id } } } },
        ],
      },
      _sum: { amount: true },
    })
    return { ...row, plannedAmount: Number(row.plannedAmount), actualAmount: Number(actual._sum.amount ?? 0) }
  }))
  return NextResponse.json({ budgets })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  try {
    const b = await req.json()
    const category = requireText(b.category, 'Kategori', 120)
    const period = normalizeBudgetPeriod(b.period)
    const planned = positiveMoney(b.plannedAmount, 'Nominal anggaran')
    const duplicate = await prisma.budget.findFirst({ where: { workspaceId: c.workspace.id, category, period } })
    if (duplicate) return NextResponse.json({ error: 'Anggaran untuk kategori dan periode tersebut sudah ada.' }, { status: 409 })
    const row = await prisma.budget.create({ data: { workspaceId: c.workspace.id, category, period, plannedAmount: planned.decimal } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'BUDGET', entityId: row.id, metadata: { category, period, plannedAmount: planned.decimal } })
    return NextResponse.json({ budget: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat anggaran.' }, { status: 400 })
  }
}
