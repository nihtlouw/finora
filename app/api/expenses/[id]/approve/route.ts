import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  const { id } = await params
  const expense = await prisma.expense.findFirst({ where: { id, workspaceId: c.workspace.id }, include: { vendor: { select: { name: true } } } })
  if (!expense) return NextResponse.json({ error: 'Biaya tidak ditemukan.' }, { status: 404 })
  if (expense.status === 'APPROVED') return NextResponse.json({ expense })
  try { await assertAccountingPeriodOpen(c.workspace.id, expense.expenseDate) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Periode terkunci.' }, { status: 409 }) }
  if (expense.status !== 'PENDING') return NextResponse.json({ error: 'Biaya tidak berada pada status approval.' }, { status: 409 })
  const row = await prisma.$transaction(async tx => {
    const e = await tx.expense.update({ where: { id }, data: { status: 'APPROVED', approvedBy: c.user.id } })
    // Approval intentionally does not create a cashflow transaction. The expense
    // may be incurred/approved before it is actually paid to the vendor/payee.
    return e
  })
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'APPROVE', entityType: 'EXPENSE', entityId: id, metadata: { approvedBy: c.user.id } })
  return NextResponse.json({ expense: row })
}
