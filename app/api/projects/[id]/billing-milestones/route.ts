import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, requireText } from '@/lib/validation/finance'
import { centsToDecimal, parseMoneyCents } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { deriveBillingMilestoneStatus } from '@/lib/project-financial-sync'

export const dynamic = 'force-dynamic'

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

async function getProject(id: string, workspaceId: string) {
  return prisma.project.findFirst({ where: { id, workspaceId }, select: { id: true, contractValue: true, status: true, projectCode: true } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  const { id } = await params
  const project = await getProject(id, c.workspace.id)
  if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })
  const rows = await prisma.billingMilestone.findMany({ where: { projectId: id }, include: { invoice: { select: { id: true, invoiceNumber: true, status: true, dueDate: true, totalAmount: true, payments: { select: { amount: true } } } } }, orderBy: { sequence: 'asc' } })
  const billingMilestones = rows.map((row) => ({
    ...row,
    displayStatus: deriveBillingMilestoneStatus({ storedStatus: row.status, invoice: row.invoice ? { status: row.invoice.status, dueDate: row.invoice.dueDate, totalAmount: row.invoice.totalAmount, payments: row.invoice.payments } : null }),
  }))
  return NextResponse.json({ billingMilestones, contractValue: project.contractValue })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengatur billing milestone.' }, { status: 403 })
  const { id } = await params
  try {
    const project = await getProject(id, c.workspace.id)
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })
    if (project.status === 'CLOSED' || project.status === 'CANCELLED') return NextResponse.json({ error: 'Project sudah ditutup/dibatalkan dan tidak dapat ditambah milestone.' }, { status: 409 })
    const b = await req.json()
    const name = requireText(b.name, 'Nama milestone', 160)
    const pct = percentage(b.percentage)
    const current = await prisma.billingMilestone.findMany({ where: { projectId: id }, select: { percentage: true, sequence: true } })
    const totalPct = current.reduce((sum, row) => sum + Number(row.percentage), 0) + pct
    if (totalPct > 100.0001) return NextResponse.json({ error: `Total billing milestone menjadi ${totalPct.toFixed(2)}%. Maksimal 100%.` }, { status: 409 })
    const sequence = Number.isInteger(Number(b.sequence)) && Number(b.sequence) > 0 ? Number(b.sequence) : (current.length ? Math.max(...current.map((row) => row.sequence)) + 1 : 1)
    const existingSequence = await prisma.billingMilestone.findFirst({ where: { projectId: id, sequence } })
    if (existingSequence) return NextResponse.json({ error: `Urutan milestone ${sequence} sudah digunakan.` }, { status: 409 })
    const amount = expectedAmount(project.contractValue.toString(), pct)
    const plannedDate = b.plannedDate ? dateOnly(b.plannedDate, 'Tanggal billing milestone') : null
    const row = await prisma.billingMilestone.create({ data: { projectId: id, sequence, name, percentage: pct.toFixed(2), amount, plannedDate, status: 'PLANNED', notes: b.notes ? String(b.notes).trim() : null } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'BILLING_MILESTONE', entityId: row.id, metadata: { projectId: id, projectCode: project.projectCode, sequence, percentage: pct, amount } })
    return NextResponse.json({ billingMilestone: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat billing milestone.' }, { status: 400 })
  }
}
