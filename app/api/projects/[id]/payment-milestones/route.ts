import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, requireText } from '@/lib/validation/finance'
import { centsToDecimal, parseMoneyCents } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { derivePaymentMilestoneStatus, invoicePaidAmount } from '@/lib/project-financial-sync'

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
  const rows = await prisma.paymentMilestone.findMany({
    where: { projectId: id },
    include: {
      billingMilestone: {
        select: {
          id: true, sequence: true, name: true, status: true,
          invoice: { select: { id: true, invoiceNumber: true, status: true, dueDate: true, totalAmount: true, payments: { select: { amount: true } } } },
        },
      },
    },
    orderBy: { sequence: 'asc' },
  })
  const paymentMilestones = rows.map((row) => {
    const invoice = row.billingMilestone?.invoice
    const paidAmount = invoice ? invoicePaidAmount(invoice) : 0
    const outstandingAmount = invoice ? Math.max(Number(invoice.totalAmount) - paidAmount, 0) : 0
    return {
      ...row,
      displayStatus: derivePaymentMilestoneStatus({ storedStatus: row.status, dueDate: row.dueDate, invoice }),
      actual: invoice ? { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceStatus: invoice.status, paidAmount, outstandingAmount } : null,
      billingMilestone: row.billingMilestone ? { ...row.billingMilestone, invoice: undefined } : null,
    }
  })
  return NextResponse.json({ paymentMilestones, contractValue: project.contractValue })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengatur payment milestone.' }, { status: 403 })
  const { id } = await params
  try {
    const project = await getProject(id, c.workspace.id)
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })
    if (project.status === 'CLOSED' || project.status === 'CANCELLED') return NextResponse.json({ error: 'Project sudah ditutup/dibatalkan dan tidak dapat ditambah milestone.' }, { status: 409 })
    const b = await req.json()
    const name = requireText(b.name, 'Nama milestone', 160)
    const billingMilestoneId = b.billingMilestoneId ? String(b.billingMilestoneId) : null
    let pct = percentage(b.percentage)
    if (billingMilestoneId) {
      const linked = await prisma.billingMilestone.findFirst({ where: { id: billingMilestoneId, projectId: id }, select: { id: true, percentage: true, amount: true, status: true } })
      if (!linked) return NextResponse.json({ error: 'Billing milestone yang dipilih tidak ada pada project ini.' }, { status: 404 })
      const existingLink = await prisma.paymentMilestone.findFirst({ where: { projectId: id, billingMilestoneId }, select: { id: true } })
      if (existingLink) return NextResponse.json({ error: 'Billing milestone tersebut sudah terhubung ke payment milestone lain.' }, { status: 409 })
      pct = Number(linked.percentage)
    }
    const current = await prisma.paymentMilestone.findMany({ where: { projectId: id }, select: { percentage: true, sequence: true } })
    const totalPct = current.reduce((sum, row) => sum + Number(row.percentage), 0) + pct
    if (totalPct > 100.0001) return NextResponse.json({ error: `Total payment milestone menjadi ${totalPct.toFixed(2)}%. Maksimal 100%.` }, { status: 409 })
    const sequence = Number.isInteger(Number(b.sequence)) && Number(b.sequence) > 0 ? Number(b.sequence) : (current.length ? Math.max(...current.map((row) => row.sequence)) + 1 : 1)
    const existingSequence = await prisma.paymentMilestone.findFirst({ where: { projectId: id, sequence } })
    if (existingSequence) return NextResponse.json({ error: `Urutan milestone ${sequence} sudah digunakan.` }, { status: 409 })
    const amount = expectedAmount(project.contractValue.toString(), pct)
    const dueDate = b.dueDate ? dateOnly(b.dueDate, 'Jatuh tempo payment milestone') : null
    const row = await prisma.paymentMilestone.create({ data: { projectId: id, billingMilestoneId, sequence, name, percentage: pct.toFixed(2), amount, dueDate, status: 'PLANNED', triggerCode: b.triggerCode ? String(b.triggerCode).trim() : null, dueDays: b.dueDays === undefined || b.dueDays === '' ? null : Number(b.dueDays), retentionMonths: b.retentionMonths === undefined || b.retentionMonths === '' ? null : Number(b.retentionMonths), retentionPercent: b.retentionPercent === undefined || b.retentionPercent === '' ? null : Number(b.retentionPercent), conditionNotes: b.conditionNotes ? String(b.conditionNotes).trim() : null, notes: b.notes ? String(b.notes).trim() : null }, include: { billingMilestone: true } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'PAYMENT_MILESTONE', entityId: row.id, metadata: { projectId: id, projectCode: project.projectCode, sequence, percentage: pct, amount, billingMilestoneId } })
    return NextResponse.json({ paymentMilestone: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat payment milestone.' }, { status: 400 })
  }
}
