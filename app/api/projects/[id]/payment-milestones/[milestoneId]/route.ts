import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { centsToDecimal, dateOnly, parseMoneyCents, requireText } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
const statuses = ['PLANNED', 'DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']

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
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengubah payment milestone.' }, { status: 403 })
  const { id, milestoneId } = await params
  const existing = await prisma.paymentMilestone.findFirst({ where: { id: milestoneId, projectId: id }, include: { project: true, billingMilestone: true } })
  if (!existing || existing.project.workspaceId !== c.workspace.id) return NextResponse.json({ error: 'Payment milestone tidak ditemukan.' }, { status: 404 })
  try {
    const b = await req.json()
    const data: any = {}
    if (b.name !== undefined) data.name = requireText(b.name, 'Nama milestone', 160)
    if (b.percentage !== undefined) {
      const pct = percentage(b.percentage)
      if (existing.billingMilestone) {
        const linkedPct = Number(existing.billingMilestone.percentage)
        if (Math.abs(linkedPct - pct) > 0.001) throw new Error(`Payment ini terhubung ke billing ${existing.billingMilestone.name}; persentase harus mengikuti ${linkedPct.toFixed(2)}%.`)
      }
      const others = await prisma.paymentMilestone.findMany({ where: { projectId: id, id: { not: milestoneId } }, select: { percentage: true } })
      const totalPct = others.reduce((sum, row) => sum + Number(row.percentage), 0) + pct
      if (totalPct > 100.0001) throw new Error(`Total payment milestone menjadi ${totalPct.toFixed(2)}%. Maksimal 100%.`)
      data.percentage = pct.toFixed(2)
      data.amount = expectedAmount(existing.project.contractValue.toString(), pct)
    }
    if (b.sequence !== undefined) {
      const seq = Number(b.sequence)
      if (!Number.isInteger(seq) || seq <= 0) throw new Error('Urutan milestone harus bilangan bulat positif.')
      const duplicate = await prisma.paymentMilestone.findFirst({ where: { projectId: id, sequence: seq, id: { not: milestoneId } } })
      if (duplicate) throw new Error(`Urutan milestone ${seq} sudah digunakan.`)
      data.sequence = seq
    }
    if (b.billingMilestoneId !== undefined) {
      const bmId = b.billingMilestoneId ? String(b.billingMilestoneId) : null
      if (bmId) {
        const linked = await prisma.billingMilestone.findFirst({ where: { id: bmId, projectId: id } })
        if (!linked) throw new Error('Billing milestone yang dipilih tidak ada pada project ini.')
        const duplicate = await prisma.paymentMilestone.findFirst({ where: { projectId: id, billingMilestoneId: bmId, id: { not: milestoneId } }, select: { id: true } })
        if (duplicate) throw new Error('Billing milestone tersebut sudah terhubung ke payment milestone lain.')
        // Payment yang terhubung ke billing merepresentasikan termin yang sama.
        // Persentasenya mengikuti billing agar nominal tidak bisa tidak sinkron.
        const linkedPct = Number(linked.percentage)
        const others = await prisma.paymentMilestone.findMany({ where: { projectId: id, id: { not: milestoneId } }, select: { percentage: true } })
        const totalPct = others.reduce((sum, row) => sum + Number(row.percentage), 0) + linkedPct
        if (totalPct > 100.0001) throw new Error(`Total payment milestone menjadi ${totalPct.toFixed(2)}%. Maksimal 100%.`)
        data.percentage = linkedPct.toFixed(2)
        data.amount = expectedAmount(existing.project.contractValue.toString(), linkedPct)
      }
      data.billingMilestoneId = bmId
    }
    if (b.dueDate !== undefined) data.dueDate = b.dueDate ? dateOnly(b.dueDate, 'Jatuh tempo payment milestone') : null
    if (b.notes !== undefined) data.notes = b.notes ? String(b.notes).trim() : null
    if (b.triggerCode !== undefined) data.triggerCode = b.triggerCode ? String(b.triggerCode).trim() : null
    if (b.dueDays !== undefined) data.dueDays = b.dueDays === '' || b.dueDays === null ? null : Number(b.dueDays)
    if (b.retentionMonths !== undefined) data.retentionMonths = b.retentionMonths === '' || b.retentionMonths === null ? null : Number(b.retentionMonths)
    if (b.retentionPercent !== undefined) data.retentionPercent = b.retentionPercent === '' || b.retentionPercent === null ? null : Number(b.retentionPercent)
    if (b.conditionNotes !== undefined) data.conditionNotes = b.conditionNotes ? String(b.conditionNotes).trim() : null
    if (b.status !== undefined) {
      const status = String(b.status)
      if (!statuses.includes(status)) throw new Error('Status payment milestone tidak valid.')
      if (status !== 'DUE' || existing.status !== 'PLANNED') return NextResponse.json({ error: 'Perubahan status manual hanya PLANNED → DUE. Status PARTIAL/PAID/OVERDUE akan dikendalikan oleh lifecycle payment berikutnya.' }, { status: 409 })
      data.status = status
    }
    const row = await prisma.paymentMilestone.update({ where: { id: milestoneId }, data, include: { billingMilestone: true } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE', entityType: 'PAYMENT_MILESTONE', entityId: milestoneId, metadata: { projectId: id, changes: data } })
    return NextResponse.json({ paymentMilestone: row })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui payment milestone.' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  const { id, milestoneId } = await params
  const existing = await prisma.paymentMilestone.findFirst({ where: { id: milestoneId, projectId: id }, include: { project: true } })
  if (!existing || existing.project.workspaceId !== c.workspace.id) return NextResponse.json({ error: 'Payment milestone tidak ditemukan.' }, { status: 404 })
  if (existing.status !== 'PLANNED') return NextResponse.json({ error: 'Hanya milestone PLANNED yang dapat dihapus.' }, { status: 409 })
  await prisma.paymentMilestone.delete({ where: { id: milestoneId } })
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'DELETE', entityType: 'PAYMENT_MILESTONE', entityId: milestoneId, metadata: { projectId: id } })
  return NextResponse.json({ ok: true })
}
