import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat membayar biaya.' }, { status: 403 })

  const { id } = await params
  try {
    const b = await req.json().catch(() => ({}))
    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id, workspaceId: c.workspace.id },
        include: { vendor: { select: { name: true } } },
      })
      if (!expense) throw new Error('Biaya tidak ditemukan.')
      if (expense.status !== 'APPROVED') throw new Error('Biaya harus APPROVED sebelum dapat dibayar.')
      if (expense.settlementStatus === 'PAID') throw new Error('Biaya ini sudah ditandai PAID.')

      const existingCashflow = await tx.cashflowTransaction.findFirst({ where: { expenseId: id }, select: { id: true } })
      if (existingCashflow) {
        await tx.expense.update({ where: { id }, data: { settlementStatus: 'PAID', paidAt: new Date(), paidBy: c.user.id } })
        return { paid: true, expenseId: id }
      }

      const paymentDate = b.paymentDate ? dateOnly(b.paymentDate, 'Tanggal pembayaran biaya') : expense.expenseDate
      const paymentMethod = b.paymentMethod ? String(b.paymentMethod).trim() : expense.paymentMethod
      await assertAccountingPeriodOpen(c.workspace.id, paymentDate)
      const bankAccountId = b.bankAccountId ? String(b.bankAccountId) : null
      if (paymentMethod === 'BANK_TRANSFER' && !bankAccountId) throw new Error('Rekening bank wajib dipilih untuk transfer.')
      if (bankAccountId) { const bank = await tx.bankAccount.findFirst({ where: { id: bankAccountId, workspaceId: c.workspace.id, isActive: true } }); if (!bank) throw new Error('Rekening bank tidak ditemukan.') }
      if (!paymentMethod) throw new Error('Metode pembayaran wajib diisi saat biaya dibayar.')

      const updated = await tx.expense.update({ where: { id }, data: { settlementStatus: 'PAID', paidAt: new Date(), paidBy: c.user.id, paymentMethod } })
      await tx.cashflowTransaction.create({
        data: {
          workspaceId: c.workspace.id,
          type: 'EXPENSE',
          category: updated.category,
          amount: updated.amount,
          expenseId: updated.id,
          transactionDate: paymentDate,
          bankAccountId,
          sourceRef: expense.vendor?.name || expense.payeeName || 'Paid expense',
        },
      })
      return { paid: true, expenseId: id }
    })

    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'PAY', entityType: 'EXPENSE', entityId: id, metadata: { paymentDate: b.paymentDate || null, paymentMethod: b.paymentMethod || null } })
    return NextResponse.json(result, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membayar biaya.' }, { status: 400 })
  }
}
