import { prisma } from '@/lib/db/prisma'

export type FinancialInvoiceSnapshot = {
  status: string
  dueDate: Date
  totalAmount: unknown
  payments: { amount: unknown }[]
}

function todayDateOnly() {
  return new Date(new Date().toISOString().slice(0, 10))
}

export function invoicePaidAmount(invoice: FinancialInvoiceSnapshot) {
  return invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
}

export function invoiceFinancialStatus(invoice: FinancialInvoiceSnapshot) {
  const status = String(invoice.status)
  if (status === 'CANCELLED' || status === 'VOID') return status
  const total = Number(invoice.totalAmount)
  const paid = invoicePaidAmount(invoice)
  if (paid >= total && total > 0) return 'PAID'
  if (paid > 0) return 'PARTIAL'
  if (new Date(invoice.dueDate) < todayDateOnly()) return 'OVERDUE'
  return status === 'SENT' ? 'SENT' : 'UNPAID'
}

export function deriveBillingMilestoneStatus(input: {
  storedStatus: string
  invoice?: FinancialInvoiceSnapshot | null
}) {
  if (input.storedStatus === 'CANCELLED') return 'CANCELLED'
  if (!input.invoice || input.invoice.status === 'CANCELLED' || input.invoice.status === 'VOID') return input.storedStatus
  const invoiceStatus = invoiceFinancialStatus(input.invoice)
  return invoiceStatus === 'PAID' ? 'PAID' : 'BILLED'
}

export function derivePaymentMilestoneStatus(input: {
  storedStatus: string
  dueDate?: Date | null
  invoice?: FinancialInvoiceSnapshot | null
}) {
  if (input.storedStatus === 'CANCELLED') return 'CANCELLED'
  if (input.invoice && input.invoice.status !== 'CANCELLED' && input.invoice.status !== 'VOID') {
    const invoiceStatus = invoiceFinancialStatus(input.invoice)
    if (invoiceStatus === 'PAID') return 'PAID'
    if (invoiceStatus === 'PARTIAL') {
      return input.dueDate && new Date(input.dueDate) < todayDateOnly() ? 'OVERDUE' : 'PARTIAL'
    }
    if (invoiceStatus === 'OVERDUE') return 'OVERDUE'
  }
  if (input.storedStatus === 'DUE') return 'DUE'
  if (input.storedStatus === 'PARTIAL' || input.storedStatus === 'PAID' || input.storedStatus === 'OVERDUE') return input.storedStatus
  return input.dueDate && new Date(input.dueDate) < todayDateOnly() ? 'OVERDUE' : input.storedStatus
}

export async function syncProjectFinancialStatuses(projectId: string) {
  const billing = await prisma.billingMilestone.findMany({
    where: { projectId },
    include: {
      invoice: {
        include: { payments: { select: { amount: true } } },
      },
    },
  })

  const payment = await prisma.paymentMilestone.findMany({
    where: { projectId },
    include: {
      billingMilestone: {
        include: {
          invoice: {
            include: { payments: { select: { amount: true } } },
          },
        },
      },
    },
  })

  for (const row of billing) {
    const nextStatus = deriveBillingMilestoneStatus({ storedStatus: row.status, invoice: row.invoice })
    if (nextStatus !== row.status) {
      await prisma.billingMilestone.update({ where: { id: row.id }, data: { status: nextStatus } })
    }
  }

  for (const row of payment) {
    const nextStatus = derivePaymentMilestoneStatus({ storedStatus: row.status, dueDate: row.dueDate, invoice: row.billingMilestone?.invoice })
    if (nextStatus !== row.status) {
      await prisma.paymentMilestone.update({ where: { id: row.id }, data: { status: nextStatus } })
    }
  }
}
