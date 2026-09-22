import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, lineItemsTotalCents, requireText, positiveMoney, optionalText, parseMoneyCents } from '@/lib/validation/finance'
import { calculateCommercialTotals, percentageBps, bpsToDecimal } from '@/lib/validation/commercial'
import { syncProjectFinancialStatuses } from '@/lib/project-financial-sync'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

function displayedStatus(status: string, dueDate: Date, paidCents: bigint, totalCents: bigint) {
  if (paidCents >= totalCents) return 'PAID'
  if (dueDate < new Date(new Date().toISOString().slice(0, 10))) return 'OVERDUE'
  if (paidCents > 0n) return 'PARTIAL'
  return status === 'SENT' ? 'SENT' : 'UNPAID'
}

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const rows = await prisma.invoice.findMany({ where: { client: { workspaceId: c.workspace.id } }, include: { client: true, items: true, payments: true, creditNotes: { where: { status: 'ISSUED' } }, project: { select: { id: true, projectCode: true, projectName: true } }, billingMilestone: { select: { id: true, sequence: true, name: true } } }, orderBy: { dueDate: 'asc' } })
  const invoices = rows.map(row => {
    const paid = row.payments.reduce((sum, p) => sum + parseMoneyCents(p.amount.toString()), 0n)
    const credited = row.creditNotes.reduce((sum, n) => sum + parseMoneyCents(n.totalAmount.toString()), 0n)
    const grossTotal = parseMoneyCents(row.totalAmount.toString())
    const total = grossTotal > credited ? grossTotal - credited : 0n
    return {
      ...row,
      status: paid >= total && total === 0n ? 'CREDITED' : displayedStatus(row.status, row.dueDate, paid, total),
      paidAmount: Number(paid) / 100,
      creditedAmount: Number(credited) / 100,
      outstandingAmount: Number(total - paid > 0n ? total - paid : 0n) / 100,
    }
  })
  return NextResponse.json({ invoices })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE', 'SALES'].includes(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  try {
    const b = await req.json()
    const projectId = b.projectId ? String(b.projectId) : ''
    const billingMilestoneId = b.billingMilestoneId ? String(b.billingMilestoneId) : ''
    if (projectId && !billingMilestoneId) return NextResponse.json({ error: 'Invoice project harus berasal dari Billing Milestone READY. Gunakan aksi Buat Invoice pada milestone project.' }, { status: 409 })

    let clientId = String(b.clientId || '').trim()
    let milestone: any = null
    if (billingMilestoneId) {
      milestone = await prisma.billingMilestone.findFirst({
        where: { id: billingMilestoneId, project: { workspaceId: c.workspace.id } },
        include: { invoice: true, project: { select: { id: true, clientId: true, projectName: true, location: true } } },
      })
      if (!milestone) return NextResponse.json({ error: 'Billing milestone tidak ditemukan.' }, { status: 404 })
      if (milestone.status !== 'READY') return NextResponse.json({ error: 'Billing milestone harus READY sebelum invoice dapat dibuat.' }, { status: 409 })
      if (milestone.invoice) return NextResponse.json({ error: 'Billing milestone tersebut sudah memiliki invoice.' }, { status: 409 })
      if (projectId && projectId !== milestone.projectId) return NextResponse.json({ error: 'Project dan Billing Milestone tidak saling cocok.' }, { status: 409 })
      clientId = milestone.project.clientId
    }

    const client = await prisma.clientVendor.findFirst({ where: { id: clientId, workspaceId: c.workspace.id, type: 'CLIENT', isActive: true } })
    if (!client) return NextResponse.json({ error: 'Klien tidak ditemukan atau tidak aktif.' }, { status: 404 })

    let commercial
    let itemsData
    if (milestone) {
      // Billing milestone amount is already the canonical invoicing amount. Do not recalculate tax/discount.
      commercial = { subtotalAmount: milestone.amount.toString(), discountPercentBps: 0n, discountAmount: '0.00', taxPercentBps: 0n, taxAmount: '0.00', totalAmount: milestone.amount.toString() }
      itemsData = [{ description: milestone.name, qty: 1, unitPrice: milestone.amount.toString(), category: 'SERVICE' }]
    } else {
      const items = Array.isArray(b.items) ? b.items : []
      const subtotalCents = lineItemsTotalCents(items)
      commercial = calculateCommercialTotals(subtotalCents, percentageBps(b.discountPercent ?? 0, 'Diskon'), percentageBps(b.taxPercent ?? 0, 'Pajak'))
      itemsData = items.map((x: any) => ({ description: requireText(x.description, 'Deskripsi item', 500), qty: Number(x.qty), unit: optionalText(x.unit, 40) || 'UNIT', unitPrice: positiveMoney(x.unitPrice, 'Harga satuan').decimal, category: String(x.category || 'SERVICE') }))
    }

    const dueDate = dateOnly(b.dueDate, 'Jatuh tempo')
    await assertAccountingPeriodOpen(c.workspace.id, new Date())
    const invoiceNumber = String(b.invoiceNumber ?? '').trim() || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
    const row = await prisma.$transaction(async (tx) => {
      if (billingMilestoneId) {
        const claim = await tx.billingMilestone.updateMany({ where: { id: billingMilestoneId, projectId: milestone.projectId, status: 'READY' }, data: { status: 'BILLED' } })
        if (claim.count !== 1) throw new Error('Billing milestone berubah saat invoice dibuat. Silakan muat ulang dan coba lagi.')
      }
      return tx.invoice.create({ data: {
        clientId,
        projectId: milestone?.projectId || null,
        billingMilestoneId: milestone?.id || null,
        invoiceNumber,
        status: 'UNPAID',
        projectName: milestone?.project?.projectName || null,
        projectLocation: milestone?.project?.location || null,
        dueDate,
        subtotalAmount: commercial.subtotalAmount,
        discountPercent: bpsToDecimal(commercial.discountPercentBps),
        discountAmount: commercial.discountAmount,
        taxPercent: bpsToDecimal(commercial.taxPercentBps),
        taxAmount: commercial.taxAmount,
        totalAmount: commercial.totalAmount,
        termsAndConditions: milestone?.notes || optionalText(b.termsAndConditions, 5000),
        items: { create: itemsData },
      }, include: { client: true, items: true, payments: true, creditNotes: { where: { status: 'ISSUED' } }, project: true, billingMilestone: true } })
    })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'INVOICE', entityId: row.id, metadata: { invoiceNumber, total: row.totalAmount.toString() } })
    return NextResponse.json({ invoice: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat invoice.' }, { status: 400 })
  }
}
