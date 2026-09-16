import { prisma } from '@/lib/db/prisma'
import { dateOnly, parseMoneyCents, centsToDecimal } from '@/lib/validation/finance'
import { syncProjectFinancialStatuses } from '@/lib/project-financial-sync'

export type MidtransSettlementPayload = {
  transaction_status?: string
  fraud_status?: string | null
  transaction_id?: string | null
  payment_type?: string | null
  gross_amount?: string | number | null
  settlement_time?: string | null
  transaction_time?: string | null
}

function isSuccessful(payload: MidtransSettlementPayload) {
  return payload.transaction_status === 'settlement' ||
    (payload.transaction_status === 'capture' && payload.fraud_status === 'accept')
}

function paymentMethodFrom(payload: MidtransSettlementPayload) {
  const type = String(payload.payment_type || '').toLowerCase()
  const map: Record<string, string> = {
    qris: 'QRIS',
    bank_transfer: 'BANK_TRANSFER',
    gopay: 'GOPAY',
    shopeepay: 'SHOPEEPAY',
    credit_card: 'CREDIT_CARD',
    cstore: 'CONVENIENCE_STORE',
  }
  return map[type] || 'PAYMENT_GATEWAY'
}

function paymentDateFrom(payload: MidtransSettlementPayload) {
  const source = String(payload.settlement_time || payload.transaction_time || new Date().toISOString())
  return dateOnly(source.slice(0, 10), 'Tanggal pembayaran')
}

export async function settleMidtransGatewayTransaction(input: {
  gatewayId: string
  workspaceId: string
  payload: MidtransSettlementPayload
}) {
  if (!isSuccessful(input.payload)) return { applied: false as const, reason: 'NOT_SETTLEMENT' as const }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.paymentGatewayTransaction.findUnique({
      where: { id: input.gatewayId },
      include: { invoice: { include: { payments: true } }, payment: true },
    })

    if (!current) return { applied: false as const, reason: 'NOT_FOUND' as const }
    if (current.invoice.status === 'CANCELLED' || current.invoice.status === 'VOID') return { applied: false as const, reason: 'INVOICE_NOT_PAYABLE' as const }
    if (current.paymentId || current.status === 'SETTLEMENT') {
      return { applied: false as const, reason: 'ALREADY_APPLIED' as const, paymentId: current.paymentId }
    }

    // Serialize settlement for the same invoice so two different gateway
    // transactions cannot both read the same outstanding balance and overpay.
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      current.invoiceId,
    )

    const amountCents = parseMoneyCents(String(input.payload.gross_amount ?? '0'))
    const expectedAmount = parseMoneyCents(current.amount.toString())
    const total = parseMoneyCents(current.invoice.totalAmount.toString())

    if (amountCents !== expectedAmount) {
      await tx.paymentGatewayTransaction.update({
        where: { id: current.id },
        data: {
          status: 'REVIEW',
          transactionId: input.payload.transaction_id ? String(input.payload.transaction_id) : null,
          paymentType: input.payload.payment_type ? String(input.payload.payment_type) : null,
          rawResponse: input.payload as any,
        },
      })
      return { applied: false as const, reason: 'AMOUNT_MISMATCH' as const }
    }

    const freshPayments = await tx.payment.findMany({
      where: { invoiceId: current.invoiceId },
      select: { amount: true },
    })
    const paidBefore = freshPayments.reduce((sum, payment) => sum + parseMoneyCents(payment.amount.toString()), 0n)
    const outstanding = total - paidBefore

    if (amountCents <= 0n || amountCents > outstanding) {
      await tx.paymentGatewayTransaction.update({
        where: { id: current.id },
        data: {
          status: 'REVIEW',
          transactionId: input.payload.transaction_id ? String(input.payload.transaction_id) : null,
          paymentType: input.payload.payment_type ? String(input.payload.payment_type) : null,
          rawResponse: input.payload as any,
        },
      })
      return { applied: false as const, reason: 'OUTSTANDING_MISMATCH' as const }
    }

    const claim = await tx.paymentGatewayTransaction.updateMany({
      where: { id: current.id, paymentId: null, status: { in: ['PENDING', 'REVIEW', 'PROCESSING'] } },
      data: {
        status: 'PROCESSING',
        transactionId: input.payload.transaction_id ? String(input.payload.transaction_id) : null,
        paymentType: input.payload.payment_type ? String(input.payload.payment_type) : null,
        rawResponse: input.payload as any,
      },
    })
    if (claim.count !== 1) return { applied: false as const, reason: 'CLAIM_LOST' as const }

    const paymentDate = paymentDateFrom(input.payload)
    const paid = await tx.payment.create({
      data: {
        invoiceId: current.invoiceId,
        amount: centsToDecimal(amountCents),
        paymentDate,
        method: paymentMethodFrom(input.payload),
      },
    })

    const newPaid = paidBefore + amountCents
    const newStatus = newPaid >= total ? 'PAID' : 'PARTIAL'

    await tx.invoice.update({ where: { id: current.invoiceId }, data: { status: newStatus } })
    await tx.cashflowTransaction.create({
      data: {
        workspaceId: input.workspaceId,
        type: 'INCOME',
        category: 'Payment',
        amount: centsToDecimal(amountCents),
        paymentId: paid.id,
        transactionDate: paymentDate,
        sourceRef: current.invoice.invoiceNumber,
      },
    })
    await tx.paymentGatewayTransaction.update({
      where: { id: current.id },
      data: {
        status: 'SETTLEMENT',
        transactionId: input.payload.transaction_id ? String(input.payload.transaction_id) : null,
        paymentType: input.payload.payment_type ? String(input.payload.payment_type) : null,
        paymentId: paid.id,
        rawResponse: input.payload as any,
      },
    })

    return {
      applied: true as const,
      reason: 'SETTLED' as const,
      paymentId: paid.id,
      invoiceId: current.invoiceId,
      amount: centsToDecimal(amountCents),
      status: newStatus,
      paidAmount: centsToDecimal(newPaid),
      outstandingAmount: centsToDecimal(total - newPaid),
    }
  })

  if (result.applied) {
    const projectId = await prisma.invoice.findUnique({ where: { id: result.invoiceId ?? '' }, select: { projectId: true } })
    if (projectId?.projectId) await syncProjectFinancialStatuses(projectId.projectId)
  }
  return result
}
