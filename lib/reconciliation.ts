import { prisma } from '@/lib/db/prisma'
import { ReportRange } from '@/lib/reports'

type ReconciliationIssue = {
  id: string
  kind: string
  severity: 'ERROR' | 'WARNING'
  reference: string
  date: Date
  expected: number
  recorded: number
  difference: number
  message: string
}

function inRange<T extends { paymentDate?: Date; expenseDate?: Date; transactionDate?: Date }>(row: T, range: ReportRange, key: keyof T) {
  const value = row[key] as Date | undefined
  if (!value) return true
  if (range.start && value < range.start) return false
  if (range.endExclusive && value >= range.endExclusive) return false
  return true
}

export async function reconcileWorkspace(workspaceId: string, range: ReportRange) {
  const [payments, expenses] = await prisma.$transaction([
    prisma.payment.findMany({
      where: {
        invoice: { client: { workspaceId } },
        ...(range.start || range.endExclusive
          ? { paymentDate: { ...(range.start ? { gte: range.start } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } }
          : {}),
      },
      include: {
        invoice: { select: { invoiceNumber: true } },
        cashflow: { select: { id: true, amount: true, type: true, transactionDate: true, category: true, sourceRef: true } },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.expense.findMany({
      where: {
        workspaceId,
        ...(range.start || range.endExclusive
          ? { expenseDate: { ...(range.start ? { gte: range.start } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } }
          : {}),
      },
      include: {
        vendor: { select: { name: true } },
        cashflow: { select: { id: true, amount: true, type: true, transactionDate: true, category: true, sourceRef: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  const issues: ReconciliationIssue[] = []
  let matchedItems = 0
  let expectedAutomaticAmount = 0
  let recordedAutomaticAmount = 0

  for (const payment of payments) {
    const expected = Number(payment.amount)
    expectedAutomaticAmount += expected
    const cashflows = payment.cashflow
    if (cashflows.length === 0) {
      issues.push({
        id: `payment-missing-${payment.id}`,
        kind: 'PAYMENT_MISSING_CASHFLOW',
        severity: 'ERROR',
        reference: payment.invoice.invoiceNumber,
        date: payment.paymentDate,
        expected,
        recorded: 0,
        difference: expected,
        message: `Payment ${payment.invoice.invoiceNumber} belum memiliki cashflow income otomatis.`,
      })
      continue
    }
    if (cashflows.length > 1) {
      const recorded = cashflows.reduce((sum, row) => sum + Number(row.amount), 0)
      recordedAutomaticAmount += recorded
      issues.push({
        id: `payment-duplicate-${payment.id}`,
        kind: 'PAYMENT_DUPLICATE_CASHFLOW',
        severity: 'ERROR',
        reference: payment.invoice.invoiceNumber,
        date: payment.paymentDate,
        expected,
        recorded,
        difference: recorded - expected,
        message: `Payment ${payment.invoice.invoiceNumber} memiliki lebih dari satu cashflow otomatis.`,
      })
      continue
    }
    const recorded = Number(cashflows[0].amount)
    recordedAutomaticAmount += recorded
    if (cashflows[0].type !== 'INCOME' || Math.abs(recorded - expected) > 0.005) {
      issues.push({
        id: `payment-mismatch-${payment.id}`,
        kind: 'PAYMENT_CASHFLOW_MISMATCH',
        severity: 'ERROR',
        reference: payment.invoice.invoiceNumber,
        date: payment.paymentDate,
        expected,
        recorded,
        difference: recorded - expected,
        message: `Cashflow payment ${payment.invoice.invoiceNumber} tidak sama dengan nominal payment.`,
      })
      continue
    }
    matchedItems += 1
  }

  for (const expense of expenses) {
    const cashflows = expense.cashflow
    const expected = Number(expense.amount)
    const requiresCashflow = expense.status === 'APPROVED'
    if (requiresCashflow) expectedAutomaticAmount += expected

    if (!requiresCashflow) {
      if (cashflows.length > 0) {
        const recorded = cashflows.reduce((sum, row) => sum + Number(row.amount), 0)
        recordedAutomaticAmount += recorded
        issues.push({
          id: `expense-unapproved-${expense.id}`,
          kind: 'EXPENSE_UNAPPROVED_CASHFLOW',
          severity: 'ERROR',
          reference: expense.vendor?.name || expense.payeeName || 'Tanpa vendor',
          date: expense.expenseDate,
          expected: 0,
          recorded,
          difference: recorded,
          message: `Expense ${expense.vendor?.name || expense.payeeName || 'Tanpa vendor'} berstatus ${expense.status} tetapi sudah memiliki cashflow otomatis.`,
        })
      } else {
        matchedItems += 1
      }
      continue
    }

    if (cashflows.length === 0) {
      issues.push({
        id: `expense-missing-${expense.id}`,
        kind: 'EXPENSE_MISSING_CASHFLOW',
        severity: 'ERROR',
        reference: expense.vendor?.name || expense.payeeName || 'Tanpa vendor',
        date: expense.expenseDate,
        expected,
        recorded: 0,
        difference: expected,
        message: `Expense approved ${expense.vendor?.name || expense.payeeName || 'Tanpa vendor'} belum memiliki cashflow expense otomatis.`,
      })
      continue
    }
    if (cashflows.length > 1) {
      const recorded = cashflows.reduce((sum, row) => sum + Number(row.amount), 0)
      recordedAutomaticAmount += recorded
      issues.push({
        id: `expense-duplicate-${expense.id}`,
        kind: 'EXPENSE_DUPLICATE_CASHFLOW',
        severity: 'ERROR',
        reference: expense.vendor?.name || expense.payeeName || 'Tanpa vendor',
        date: expense.expenseDate,
        expected,
        recorded,
        difference: recorded - expected,
        message: `Expense ${expense.vendor?.name || expense.payeeName || 'Tanpa vendor'} memiliki lebih dari satu cashflow otomatis.`,
      })
      continue
    }
    const recorded = Number(cashflows[0].amount)
    recordedAutomaticAmount += recorded
    if (cashflows[0].type !== 'EXPENSE' || Math.abs(recorded - expected) > 0.005) {
      issues.push({
        id: `expense-mismatch-${expense.id}`,
        kind: 'EXPENSE_CASHFLOW_MISMATCH',
        severity: 'ERROR',
        reference: expense.vendor?.name || expense.payeeName || 'Tanpa vendor',
        date: expense.expenseDate,
        expected,
        recorded,
        difference: recorded - expected,
        message: `Cashflow expense ${expense.vendor?.name || expense.payeeName || 'Tanpa vendor'} tidak sama dengan nominal expense.`,
      })
      continue
    }
    matchedItems += 1
  }

  return {
    range,
    summary: {
      paymentCount: payments.length,
      expenseCount: expenses.length,
      matchedItems,
      issueCount: issues.length,
      expectedAutomaticAmount,
      recordedAutomaticAmount,
      automaticDifference: recordedAutomaticAmount - expectedAutomaticAmount,
      status: issues.length === 0 ? 'RECONCILED' : 'NEEDS_REVIEW',
    },
    issues,
  }
}
