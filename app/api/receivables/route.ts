import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { parseMoneyCents } from '@/lib/validation/finance'

export const dynamic = 'force-dynamic'

type AgingBucket = 'CURRENT' | '1_30' | '31_60' | '61_90' | '90_PLUS'

function startOfToday() {
  return new Date(new Date().toISOString().slice(0, 10))
}

function daysOverdue(dueDate: Date, today: Date) {
  return Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000))
}

function agingBucket(days: number): AgingBucket {
  if (days <= 0) return 'CURRENT'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_PLUS'
}

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat melihat piutang.' }, { status: 403 })
  }

  const today = startOfToday()
  const rows = await prisma.invoice.findMany({
    where: { client: { workspaceId: c.workspace.id } },
    include: { client: true, payments: true },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  })

  const receivables = rows.map((row) => {
    const total = parseMoneyCents(row.totalAmount.toString())
    const paid = row.payments.reduce((sum, p) => sum + parseMoneyCents(p.amount.toString()), 0n)
    const outstanding = total > paid ? total - paid : 0n
    const overdueDays = outstanding > 0n ? daysOverdue(row.dueDate, today) : 0
    const bucket = agingBucket(overdueDays)
    const status = outstanding <= 0n ? 'PAID' : overdueDays > 0 ? 'OVERDUE' : row.payments.length ? 'PARTIAL' : (row.status === 'SENT' ? 'SENT' : 'UNPAID')
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      client: row.client,
      dueDate: row.dueDate,
      totalAmount: Number(total) / 100,
      paidAmount: Number(paid) / 100,
      outstandingAmount: Number(outstanding) / 100,
      status,
      overdueDays,
      agingBucket: bucket,
    }
  }).filter((x) => x.outstandingAmount > 0)

  const summary = receivables.reduce((acc, item) => {
    acc.totalOutstanding += item.outstandingAmount
    if (item.agingBucket === 'CURRENT') acc.current += item.outstandingAmount
    else {
      acc.overdue += item.outstandingAmount
      if (item.agingBucket === '1_30') acc.bucket1_30 += item.outstandingAmount
      if (item.agingBucket === '31_60') acc.bucket31_60 += item.outstandingAmount
      if (item.agingBucket === '61_90') acc.bucket61_90 += item.outstandingAmount
      if (item.agingBucket === '90_PLUS') acc.bucket90_plus += item.outstandingAmount
    }
    return acc
  }, { totalOutstanding: 0, current: 0, overdue: 0, bucket1_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90_plus: 0 })

  return NextResponse.json({ receivables, summary, generatedAt: today.toISOString() })
}
