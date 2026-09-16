import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, positiveMoney, parseMoneyCents } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    const action = String(body.action ?? '').toUpperCase()
    const row = await prisma.vendorBill.findFirst({ where: { id, workspaceId: c.workspace.id }, include: { payments: true } })
    if (!row) return NextResponse.json({ error: 'Vendor bill tidak ditemukan.' }, { status: 404 })

    if (action === 'APPROVE') {
      if (row.status !== 'DRAFT') return NextResponse.json({ error: 'Hanya DRAFT yang dapat diapprove.' }, { status: 409 })
      await assertAccountingPeriodOpen(c.workspace.id, row.billDate)
      const updated = await prisma.vendorBill.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: c.user.id } })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'VENDOR_BILL', entityId: id })
      return NextResponse.json({ vendorBill: updated })
    }

    if (action === 'PAY') {
      if (!['APPROVED', 'PARTIAL'].includes(row.status)) return NextResponse.json({ error: 'Vendor bill harus APPROVED atau PARTIAL.' }, { status: 409 })
      const paymentDate = dateOnly(body.paymentDate, 'Tanggal pembayaran')
      await assertAccountingPeriodOpen(c.workspace.id, paymentDate)
      const amount = positiveMoney(body.amount, 'Pembayaran').cents
      const paid = row.payments.reduce((s, x) => s + parseMoneyCents(x.amount.toString()), 0n)
      const total = parseMoneyCents(row.totalAmount.toString())
      if (amount + paid > total) return NextResponse.json({ error: 'Pembayaran melebihi outstanding vendor bill.' }, { status: 409 })
      const bankAccountId = body.bankAccountId ? String(body.bankAccountId) : null
      if (bankAccountId) {
        const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, workspaceId: c.workspace.id, isActive: true } })
        if (!bank) return NextResponse.json({ error: 'Rekening bank tidak ditemukan.' }, { status: 404 })
      }
      const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.vendorBillPayment.create({ data: { vendorBillId: id, bankAccountId, paymentDate, amount: amount.toString(), method: String(body.method || 'TRANSFER'), reference: body.reference ? String(body.reference) : null } })
        await tx.cashflowTransaction.create({ data: { workspaceId: c.workspace.id, type: 'EXPENSE', category: 'VENDOR_BILL', amount: amount.toString(), transactionDate: paymentDate, sourceRef: `VENDOR_BILL_PAYMENT:${created.id}`, vendorBillPaymentId: created.id, bankAccountId } })
        const nextStatus = paid + amount === total ? 'PAID' : 'PARTIAL'
        await tx.vendorBill.update({ where: { id }, data: { status: nextStatus } })
        return created
      })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'VENDOR_BILL', entityId: id, metadata: { amount: amount.toString() } })
      return NextResponse.json({ vendorBill: await prisma.vendorBill.findUnique({ where: { id }, include: { payments: true } }), payment })
    }
    return NextResponse.json({ error: 'Action tidak didukung.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memproses vendor bill.' }, { status: 400 })
  }
}
