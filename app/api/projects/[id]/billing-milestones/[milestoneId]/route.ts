import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, requireText } from '@/lib/validation/finance'
import { centsToDecimal, parseMoneyCents } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
const statuses = ['PLANNED', 'READY', 'BILLED', 'CANCELLED']

function percentage(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error('Persentase milestone harus lebih besar dari 0 dan maksimal 100%.')
  return n
}
function expectedAmount(contractValue: string, percent: number) {
  const cents = parseMoneyCents(contractValue)
  const bps = BigInt(Math.round(percent * 100))
  return centsToDecimal((cents * bps + 5000n) / 10000n)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengubah billing milestone.' }, { status: 403 })
  const { id, milestoneId } = await params
  const existing = await prisma.billingMilestone.findFirst({ where: { id: milestoneId, projectId: id }, include: { project: true, invoice: true } })
  if (!existing || existing.project.workspaceId !== c.workspace.id) return NextResponse.json({ error: 'Billing milestone tidak ditemukan.' }, { status: 404 })
  try {
    const b = await req.json()
    const data: any = {}
    if (b.name !== undefined) data.name = requireText(b.name, 'Nama milestone', 160)
    if (b.percentage !== undefined) {
      const pct = percentage(b.percentage)
      const others = await prisma.billingMilestone.findMany({ where: { projectId: id, id: { not: milestoneId } }, select: { percentage: true } })
      const totalPct = others.reduce((sum, row) => sum + Number(row.percentage), 0) + pct
      if (totalPct > 100.0001) throw new Error(`Total billing milestone menjadi ${totalPct.toFixed(2)}%. Maksimal 100%.`)
      data.percentage = pct.toFixed(2)
      data.amount = expectedAmount(existing.project.contractValue.toString(), pct)
    }
    if (b.sequence !== undefined) {
      const seq = Number(b.sequence)
      if (!Number.isInteger(seq) || seq <= 0) throw new Error('Urutan milestone harus bilangan bulat positif.')
      const duplicate = await prisma.billingMilestone.findFirst({ where: { projectId: id, sequence: seq, id: { not: milestoneId } } })
      if (duplicate) throw new Error(`Urutan milestone ${seq} sudah digunakan.`)
      data.sequence = seq
    }
    if (b.plannedDate !== undefined) data.plannedDate = b.plannedDate ? dateOnly(b.plannedDate, 'Tanggal billing milestone') : null
    if (b.notes !== undefined) data.notes = b.notes ? String(b.notes).trim() : null
    if (b.status !== undefined) {
      const status = String(b.status)
      if (!statuses.includes(status)) throw new Error('Status billing milestone tidak valid.')
      if (status !== 'READY' || existing.status !== 'PLANNED') return NextResponse.json({ error: 'Perubahan status manual hanya PLANNED → READY. Status BILLED/CANCELLED akan dikendalikan oleh lifecycle berikutnya.' }, { status: 409 })
      data.status = status
    }
    const row = await prisma.billingMilestone.update({ where: { id: milestoneId }, data, include: { invoice: true } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE', entityType: 'BILLING_MILESTONE', entityId: milestoneId, metadata: { projectId: id, changes: data } })
    return NextResponse.json({ billingMilestone: row })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui billing milestone.' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  const { id, milestoneId } = await params
  const existing = await prisma.billingMilestone.findFirst({ where: { id: milestoneId, projectId: id }, include: { project: true, invoice: true, paymentMilestones: true } })
  if (!existing || existing.project.workspaceId !== c.workspace.id) return NextResponse.json({ error: 'Billing milestone tidak ditemukan.' }, { status: 404 })
  if (existing.invoice || existing.paymentMilestones.length) return NextResponse.json({ error: 'Billing milestone yang sudah memiliki invoice atau payment milestone tidak dapat dihapus.' }, { status: 409 })
  if (existing.status !== 'PLANNED') return NextResponse.json({ error: 'Hanya milestone PLANNED yang dapat dihapus.' }, { status: 409 })
  await prisma.billingMilestone.delete({ where: { id: milestoneId } })
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'DELETE', entityType: 'BILLING_MILESTONE', entityId: milestoneId, metadata: { projectId: id } })
  return NextResponse.json({ ok: true })
}
