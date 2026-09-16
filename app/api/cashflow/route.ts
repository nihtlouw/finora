import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, positiveMoney, requireText } from '@/lib/validation/finance'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'
export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const rows = await prisma.cashflowTransaction.findMany({ where: { OR: [{ workspaceId: c.workspace.id }, { payment: { invoice: { client: { workspaceId: c.workspace.id } } } }, { expense: { workspaceId: c.workspace.id } }] }, orderBy: { transactionDate: 'desc' }, take: 200 })
  return NextResponse.json({ transactions: rows.map(x => ({ ...x, amount: Number(x.amount) })) })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  try {
    const b = await req.json()
    const type = String(b.type ?? '').trim().toUpperCase()
    if (!['INCOME', 'EXPENSE'].includes(type)) throw new Error('Tipe transaksi harus INCOME atau EXPENSE.')
    if (b.paymentId || b.expenseId) throw new Error('Transaksi yang terkait payment/expense dibuat otomatis oleh sistem.')
    const category = requireText(b.category, 'Kategori', 120)
    const amount = positiveMoney(b.amount, 'Nominal')
    const transactionDate = dateOnly(b.transactionDate, 'Tanggal transaksi')
    const sourceRef = String(b.sourceRef ?? '').trim() || null
    await assertAccountingPeriodOpen(c.workspace.id, transactionDate)
    const bankAccountId = b.bankAccountId ? String(b.bankAccountId) : null
    if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, workspaceId: c.workspace.id, isActive: true } })
      if (!bank) throw new Error('Rekening bank tidak ditemukan atau tidak aktif.')
    }
    const row = await prisma.cashflowTransaction.create({ data: { workspaceId: c.workspace.id, type, category, amount: amount.decimal, transactionDate, sourceRef, bankAccountId } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'CASHFLOW_TRANSACTION', entityId: row.id, metadata: { type, category, amount: amount.decimal } })
    return NextResponse.json({ transaction: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat transaksi kas.' }, { status: 400 })
  }
}
