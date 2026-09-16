import { prisma } from '@/lib/db/prisma'
import { getBalanceSheetSnapshot, getCashflowsForRange, getPreviousRange, ReportRange, summarizeCashflows, formatDateParam } from '@/lib/reports'
import { reconcileWorkspace } from '@/lib/reconciliation'
import { parseMoneyCents } from '@/lib/validation/finance'

function moneyString(value: unknown) {
  if (typeof value === 'bigint') return (Number(value) / 100).toFixed(2)
  if (typeof value === 'number') return value.toFixed(2)
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number((value as { toString(): string }).toString()).toFixed(2)
  }
  return '0.00'
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function rowsToCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function rangeFilter(column: 'paymentDate' | 'expenseDate' | 'transactionDate', range: ReportRange) {
  if (!range.start && !range.endExclusive) return {}
  return {
    [column]: {
      ...(range.start ? { gte: range.start } : {}),
      ...(range.endExclusive ? { lt: range.endExclusive } : {}),
    },
  }
}

function workspaceClientFilter(workspaceId: string) {
  return { client: { workspaceId } }
}

export async function buildFinancialExport(workspaceId: string, range: ReportRange) {
  const previousRange = getPreviousRange(range)
  const [cashflows, previousCashflows, balance, payments, expenses, invoices, reconciliation] = await Promise.all([
    prisma.cashflowTransaction.findMany({
      where: {
        OR: [
          { workspaceId },
          { payment: { invoice: workspaceClientFilter(workspaceId) } },
          { expense: { workspaceId } },
        ],
        ...rangeFilter('transactionDate', range),
      },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    }),
    previousRange
      ? prisma.cashflowTransaction.findMany({
          where: {
            OR: [
              { workspaceId },
              { payment: { invoice: workspaceClientFilter(workspaceId) } },
              { expense: { workspaceId } },
            ],
            ...rangeFilter('transactionDate', previousRange),
          },
          orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    getBalanceSheetSnapshot(workspaceId, range.endExclusive ?? new Date(Date.now() + 86400000)),
    prisma.payment.findMany({
      where: { invoice: workspaceClientFilter(workspaceId), ...rangeFilter('paymentDate', range) },
      include: { invoice: { include: { client: true } } },
      orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.expense.findMany({
      where: { workspaceId, ...rangeFilter('expenseDate', range) },
      include: { vendor: true },
      orderBy: [{ expenseDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.invoice.findMany({
      where: { client: { workspaceId }, ...(range.endExclusive ? { createdAt: { lt: range.endExclusive } } : {}) },
      include: { client: true, payments: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    }),
    reconcileWorkspace(workspaceId, range),
  ])

  const current = summarizeCashflows(cashflows)
  const previous = summarizeCashflows(previousCashflows)
  const asOf = range.endExclusive ?? new Date(Date.now() + 86400000)
  const receivables = invoices.map((invoice) => {
    const total = parseMoneyCents(invoice.totalAmount.toString())
    const paid = invoice.payments
      .filter((payment) => payment.paymentDate < asOf)
      .reduce((sum, payment) => sum + parseMoneyCents(payment.amount.toString()), 0n)
    const outstanding = total > paid ? total - paid : 0n
    return { invoice, total, paid, outstanding }
  }).filter((item) => item.outstanding > 0n)

  const aging = { CURRENT: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_PLUS': 0 }
  const today = new Date(asOf.toISOString().slice(0, 10))
  const dayMs = 86400000
  for (const item of receivables) {
    const due = new Date(item.invoice.dueDate.toISOString().slice(0, 10))
    const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / dayMs))
    const bucket = days <= 0 ? 'CURRENT' : days <= 30 ? '1_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : '90_PLUS'
    aging[bucket] += Number(item.outstanding) / 100
  }

  const rows: unknown[][] = [
    ['FINORA — FINANCIAL EXPORT'],
    ['Periode', range.label],
    ['Dibuat', formatDateParam(new Date())],
    ['Catatan', 'Basis kas untuk P&L; Balance Sheet adalah snapshot sederhana.'],
    [],
    ['PROFIT & LOSS'],
    ['Metric', 'Nilai'],
    ['Pendapatan', moneyString(current.income)],
    ['Beban', moneyString(current.expense)],
    ['Laba Bersih', moneyString(current.net)],
    [],
    ['COMPARISON'],
    ['Metric', 'Periode Aktif', 'Periode Sebelumnya'],
    ['Pendapatan', moneyString(current.income), previousRange ? moneyString(previous.income) : ''],
    ['Beban', moneyString(current.expense), previousRange ? moneyString(previous.expense) : ''],
    ['Laba Bersih', moneyString(current.net), previousRange ? moneyString(previous.net) : ''],
    [],
    ['BALANCE SHEET — SEDERHANA'],
    ['Metric', 'Nilai'],
    ['Kas Bersih', moneyString(balance.cash)],
    ['Piutang Usaha', moneyString(balance.receivables)],
    ['Total Aset', moneyString(balance.assets)],
    ['Liabilitas Tercatat', moneyString(balance.liabilities)],
    ['Ekuitas Sederhana', moneyString(balance.equity)],
    [],
    ['RECEIVABLES AGING — SNAPSHOT'],
    ['Bucket', 'Outstanding'],
    ['Belum jatuh tempo', moneyString(aging.CURRENT)],
    ['1–30 hari', moneyString(aging['1_30'])],
    ['31–60 hari', moneyString(aging['31_60'])],
    ['61–90 hari', moneyString(aging['61_90'])],
    ['>90 hari', moneyString(aging['90_PLUS'])],
    [],
    ['RECONCILIATION'],
    ['Status', reconciliation.summary.status],
    ['Payment diperiksa', reconciliation.summary.paymentCount],
    ['Expense diperiksa', reconciliation.summary.expenseCount],
    ['Temuan', reconciliation.summary.issueCount],
    ['Expected automatic cashflow', moneyString(reconciliation.summary.expectedAutomaticAmount)],
    ['Recorded automatic cashflow', moneyString(reconciliation.summary.recordedAutomaticAmount)],
    ['Selisih otomatis', moneyString(reconciliation.summary.automaticDifference)],
    [],
    ['CASHFLOW DETAIL'],
    ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Sumber', 'Asal'],
    ...cashflows.map((row) => [
      formatDateParam(new Date(row.transactionDate)),
      row.type,
      row.category,
      moneyString(row.amount),
      row.sourceRef ?? '',
      row.paymentId ? 'Payment' : row.expenseId ? 'Expense' : 'Manual',
    ]),
    [],
    ['PAYMENT DETAIL'],
    ['Tanggal', 'Invoice', 'Klien', 'Metode', 'Nominal'],
    ...payments.map((payment) => [
      formatDateParam(new Date(payment.paymentDate)),
      payment.invoice.invoiceNumber,
      payment.invoice.client.name,
      payment.method,
      moneyString(payment.amount),
    ]),
    [],
    ['EXPENSE DETAIL'],
    ['Tanggal', 'Vendor', 'Kategori', 'Status', 'Nominal'],
    ...expenses.map((expense) => [
      formatDateParam(new Date(expense.expenseDate)),
      expense.vendor?.name || expense.payeeName || 'Tanpa vendor',
      expense.category,
      expense.status,
      moneyString(expense.amount),
    ]),
    [],
    ['RECEIVABLES DETAIL'],
    ['Invoice', 'Klien', 'Jatuh Tempo', 'Total', 'Sudah Dibayar', 'Outstanding'],
    ...receivables.map((item) => [
      item.invoice.invoiceNumber,
      item.invoice.client.name,
      formatDateParam(new Date(item.invoice.dueDate)),
      moneyString(item.total),
      moneyString(item.paid),
      moneyString(item.outstanding),
    ]),
  ]

  return rowsToCsv(rows)
}
