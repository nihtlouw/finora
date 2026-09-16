import { prisma } from '@/lib/db/prisma'

export type ReportPeriodKey = 'all' | 'month' | 'quarter' | 'year' | 'custom'

export type ReportRange = {
  start: Date | null
  endExclusive: Date | null
  label: string
}

function utcDate(year: number, monthIndex: number, day = 1) {
  return new Date(Date.UTC(year, monthIndex, day))
}

function endExclusiveFromInclusiveDate(dateText: string) {
  const d = new Date(`${dateText}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) throw new Error('Tanggal laporan tidak valid.')
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export function resolveReportRange(searchParams: Record<string, string | undefined>): ReportRange {
  const period = (searchParams.period || 'month') as ReportPeriodKey
  const today = new Date()
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()

  if (period === 'all') {
    return { start: null, endExclusive: null, label: 'Semua periode' }
  }

  if (period === 'year') {
    const selectedYear = Number(searchParams.date || year)
    if (!Number.isInteger(selectedYear) || selectedYear < 2000 || selectedYear > 2100) throw new Error('Tahun tidak valid.')
    return {
      start: utcDate(selectedYear, 0, 1),
      endExclusive: utcDate(selectedYear + 1, 0, 1),
      label: `Tahun ${selectedYear}`,
    }
  }

  if (period === 'quarter') {
    const raw = searchParams.date || `${year}-Q${Math.floor(month / 3) + 1}`
    const match = /^(\d{4})-Q([1-4])$/.exec(raw)
    if (!match) throw new Error('Kuartal tidak valid.')
    const selectedYear = Number(match[1])
    const quarter = Number(match[2])
    const startMonth = (quarter - 1) * 3
    return {
      start: utcDate(selectedYear, startMonth, 1),
      endExclusive: utcDate(selectedYear, startMonth + 3, 1),
      label: `Q${quarter} ${selectedYear}`,
    }
  }

  if (period === 'custom') {
    const startRaw = searchParams.start
    const endRaw = searchParams.end
    if (!startRaw || !endRaw) throw new Error('Periode custom membutuhkan tanggal mulai dan selesai.')
    const start = new Date(`${startRaw}T00:00:00.000Z`)
    const endExclusive = endExclusiveFromInclusiveDate(endRaw)
    if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime()) || start >= endExclusive) {
      throw new Error('Rentang tanggal custom tidak valid.')
    }
    return { start, endExclusive, label: `${startRaw} s/d ${endRaw}` }
  }

  const raw = searchParams.date || `${year}-${String(month + 1).padStart(2, '0')}`
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) throw new Error('Bulan tidak valid.')
  const selectedYear = Number(match[1])
  const selectedMonth = Number(match[2])
  if (selectedMonth < 1 || selectedMonth > 12) throw new Error('Bulan tidak valid.')
  return {
    start: utcDate(selectedYear, selectedMonth - 1, 1),
    endExclusive: utcDate(selectedYear, selectedMonth, 1),
    label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate(selectedYear, selectedMonth - 1, 1)),
  }
}

export function getPreviousRange(range: ReportRange): ReportRange | null {
  if (!range.start || !range.endExclusive) return null
  const duration = range.endExclusive.getTime() - range.start.getTime()
  const endExclusive = new Date(range.start.getTime())
  const start = new Date(range.start.getTime() - duration)
  return { start, endExclusive, label: `${start.toISOString().slice(0, 10)} s/d ${new Date(endExclusive.getTime() - 86400000).toISOString().slice(0, 10)}` }
}

function cashflowWhere(workspaceId: string, start: Date | null, endExclusive: Date | null) {
  return {
    OR: [
      { workspaceId },
      { payment: { invoice: { client: { workspaceId } } } },
      { expense: { workspaceId } },
    ],
    ...(start || endExclusive
      ? { transactionDate: { ...(start ? { gte: start } : {}), ...(endExclusive ? { lt: endExclusive } : {}) } }
      : {}),
  }
}

export async function getCashflowsForRange(workspaceId: string, range: ReportRange) {
  return prisma.cashflowTransaction.findMany({
    where: cashflowWhere(workspaceId, range.start, range.endExclusive),
    orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
  })
}

export function summarizeCashflows(rows: Array<{ type: string; amount: any; category: string }>) {
  const income = rows.filter((x) => x.type === 'INCOME').reduce((sum, x) => sum + Number(x.amount), 0)
  const expense = rows.filter((x) => x.type === 'EXPENSE').reduce((sum, x) => sum + Number(x.amount), 0)
  const byCategory = Object.entries(
    rows.filter((x) => x.type === 'EXPENSE').reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] ?? 0) + Number(row.amount)
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  return { income, expense, net: income - expense, byCategory }
}

export async function getBalanceSheetSnapshot(workspaceId: string, asOfExclusive: Date) {
  const cashflows = await prisma.cashflowTransaction.findMany({
    where: cashflowWhere(workspaceId, null, asOfExclusive),
    select: { type: true, amount: true },
  })
  const cash = cashflows.reduce((sum: number, row: any) => sum + (row.type === 'INCOME' ? Number(row.amount) : -Number(row.amount)), 0)

  const invoices = await prisma.invoice.findMany({
    where: {
      client: { workspaceId },
      createdAt: { lt: asOfExclusive },
    },
    select: {
      totalAmount: true,
      payments: {
        where: { paymentDate: { lt: asOfExclusive } },
        select: { amount: true },
      },
    },
  })
  const receivables = invoices.reduce((sum: number, invoice: any) => {
    const paid = invoice.payments.reduce((sub: number, payment: any) => sub + Number(payment.amount), 0)
    return sum + Math.max(0, Number(invoice.totalAmount) - paid)
  }, 0)

  // Liabilities are intentionally shown as zero until a liability/debt ledger exists in the data model.
  const liabilities = 0
  const assets = cash + receivables
  const equity = assets - liabilities
  return { cash, receivables, assets, liabilities, equity }
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatDateParam(date: Date) {
  return date.toISOString().slice(0, 10)
}
