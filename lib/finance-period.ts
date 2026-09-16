import { prisma } from '@/lib/db/prisma'

export function periodKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function assertAccountingPeriodOpen(workspaceId: string, date: Date) {
  const period = periodKey(date)
  const row = await prisma.accountingPeriod.findUnique({
    where: { workspaceId_period: { workspaceId, period } },
    select: { status: true },
  })
  if (row?.status === 'CLOSED') throw new Error(`Periode ${period} sudah ditutup. Transaksi tidak dapat diubah.`)
}

export async function ensureAccountingPeriod(workspaceId: string, date: Date) {
  const period = periodKey(date)
  return prisma.accountingPeriod.upsert({
    where: { workspaceId_period: { workspaceId, period } },
    create: { workspaceId, period, status: 'OPEN' },
    update: {},
  })
}
