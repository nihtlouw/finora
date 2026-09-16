import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, positiveMoney, parseMoneyCents } from '@/lib/validation/finance'
import { syncProjectFinancialStatuses } from '@/lib/project-financial-sync'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const rows = await prisma.payment.findMany({ where: { invoice: { client: { workspaceId: c.workspace.id } } }, include: { invoice: { include: { client: true, project: { select: { id: true, projectCode: true, projectName: true } } } }, gatewayTransaction: true }, orderBy: { paymentDate: 'desc' } })
  return NextResponse.json({ payments: rows })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  try {
    const b = await req.json()
    const manualMethod = String(b.method || 'BANK_TRANSFER')
    if (!['BANK_TRANSFER', 'CASH'].includes(manualMethod)) {
      return NextResponse.json({ error: 'Pembayaran gateway harus dilakukan melalui tombol Bayar Online. Pembayaran manual hanya mendukung Transfer Bank atau Cash.' }, { status: 400 })
    }
    const invoice = await prisma.invoice.findFirst({ where: { id: b.invoiceId, client: { workspaceId: c.workspace.id } }, include: { payments: true, creditNotes: { where: { status: 'ISSUED' } } } })
    if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') return NextResponse.json({ error: `Invoice berstatus ${invoice.status} dan tidak dapat menerima pembayaran.` }, { status: 409 })
    const payment = positiveMoney(b.amount, 'Nominal pembayaran')
    const paidBefore = invoice.payments.reduce((sum, p) => sum + parseMoneyCents(p.amount.toString()), 0n)
    const credited = invoice.creditNotes.reduce((sum, n) => sum + parseMoneyCents(n.totalAmount.toString()), 0n)
    const total = parseMoneyCents(invoice.totalAmount.toString())
    const netTotal = total > credited ? total - credited : 0n
    const outstanding = netTotal - paidBefore
    if (outstanding <= 0n) return NextResponse.json({ error: 'Invoice sudah lunas.' }, { status: 409 })
    if (payment.cents > outstanding) return NextResponse.json({ error: `Pembayaran melebihi sisa tagihan (${Number(outstanding) / 100}).` }, { status: 409 })
    const paymentDate = dateOnly(b.paymentDate, 'Tanggal pembayaran')
    await assertAccountingPeriodOpen(c.workspace.id, paymentDate)
    const bankAccountId = b.bankAccountId ? String(b.bankAccountId) : null
    if (manualMethod === 'BANK_TRANSFER' && !bankAccountId) return NextResponse.json({ error: 'Rekening bank wajib dipilih untuk pembayaran transfer.' }, { status: 400 })
    if (bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, workspaceId: c.workspace.id, isActive: true } })
      if (!bank) return NextResponse.json({ error: 'Rekening bank tidak ditemukan.' }, { status: 404 })
    }
    const result = await prisma.$transaction(async tx => {
      // Serialize all payment writes for the same invoice. Gateway settlements use
      // the same advisory lock, preventing manual and online payments from racing
      // each other and accidentally exceeding the invoice outstanding balance.
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        invoice.id,
      )

      const freshPayments = await tx.payment.findMany({ where: { invoiceId: invoice.id }, select: { amount: true } })
      const freshPaid = freshPayments.reduce((sum, row) => sum + parseMoneyCents(row.amount.toString()), 0n)
      const freshOutstanding = netTotal - freshPaid
      if (freshOutstanding <= 0n) throw new Error('Invoice sudah lunas.')
      if (payment.cents > freshOutstanding) throw new Error(`Pembayaran melebihi sisa tagihan (${Number(freshOutstanding) / 100}).`)

      // A single invoice is allowed to have multiple payments (partial/installment).
      // Each payment gets its own cashflow row; CashflowTransaction.paymentId is unique
      // so one payment can never generate two automatic cashflow rows.
      const created = await tx.payment.create({ data: { invoiceId: invoice.id, amount: payment.decimal, paymentDate, method: manualMethod } })
      const newPaid = freshPaid + payment.cents
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: newPaid >= netTotal ? 'PAID' : 'PARTIAL' } })
      await tx.cashflowTransaction.create({ data: { workspaceId: c.workspace.id, type: 'INCOME', category: 'Payment', amount: payment.decimal, paymentId: created.id, transactionDate: paymentDate, sourceRef: invoice.invoiceNumber, bankAccountId } })
      return created
    })
    if (invoice.projectId) await syncProjectFinancialStatuses(invoice.projectId)
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'PAYMENT', entityId: result.id, metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, projectId: invoice.projectId ?? null, amount: payment.decimal, method: manualMethod } })
    return NextResponse.json({ payment: result }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal mencatat pembayaran.' }, { status: 400 })
  }
}
