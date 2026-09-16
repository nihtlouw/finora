import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import { parseMoneyCents } from '@/lib/validation/finance'

export const dynamic = 'force-dynamic'

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function rowsToCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function startOfToday() {
  return new Date(new Date().toISOString().slice(0, 10))
}

function agingBucket(days: number) {
  if (days <= 0) return 'CURRENT'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_PLUS'
}

function dateText(date: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeZone: 'UTC' }).format(date)
}

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengexport piutang.' }, { status: 403 })
  }

  try {
    const today = startOfToday()
    const rows = await prisma.invoice.findMany({
      where: { client: { workspaceId: c.workspace.id } },
      include: { client: true, payments: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    })

    const outstanding = rows.map((invoice) => {
      const total = parseMoneyCents(invoice.totalAmount.toString())
      const paid = invoice.payments.reduce((sum, payment) => sum + parseMoneyCents(payment.amount.toString()), 0n)
      const amount = total > paid ? total - paid : 0n
      const days = amount > 0n
        ? Math.max(0, Math.floor((today.getTime() - new Date(invoice.dueDate.toISOString().slice(0, 10)).getTime()) / 86400000))
        : 0
      return {
        invoice,
        total,
        paid,
        amount,
        days,
        bucket: agingBucket(days),
      }
    }).filter((item) => item.amount > 0n)

    const rowsCsv: unknown[][] = [
      ['FINORA — RECEIVABLES AGING EXPORT'],
      ['Dibuat', dateText(today)],
      [],
      ['Invoice', 'Klien', 'Jatuh Tempo', 'Status', 'Aging', 'Hari Terlambat', 'Total', 'Sudah Dibayar', 'Outstanding'],
      ...outstanding.map((item) => [
        item.invoice.invoiceNumber,
        item.invoice.client.name,
        dateText(item.invoice.dueDate),
        item.days > 0 ? 'OVERDUE' : item.paid > 0n ? 'PARTIAL' : item.invoice.status,
        item.bucket,
        item.days,
        (Number(item.total) / 100).toFixed(2),
        (Number(item.paid) / 100).toFixed(2),
        (Number(item.amount) / 100).toFixed(2),
      ]),
    ]

    const csv = rowsToCsv(rowsCsv)
    const filename = `finora-receivables-aging-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat export piutang.' },
      { status: 400 },
    )
  }
}
