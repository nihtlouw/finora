import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, lineItemsTotalCents, requireText, positiveMoney, optionalText } from '@/lib/validation/finance'
import { calculateCommercialTotals, percentageBps, bpsToDecimal } from '@/lib/validation/commercial'
import { syncProjectFinancialStatuses } from '@/lib/project-financial-sync'

export const dynamic = 'force-dynamic'

async function getOwned(id: string, workspaceId: string) {
  return prisma.invoice.findFirst({ where: { id, client: { workspaceId } }, include: { items: true, payments: true, client: true, proposal: true, project: { select: { id: true, projectCode: true, projectName: true } }, billingMilestone: { select: { id: true, sequence: true, name: true } } } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE', 'SALES'].includes(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  const { id } = await params
  const existing = await getOwned(id, c.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })

  let body: any = {}
  try { body = await req.json() } catch { body = {} }

  if (body.action === 'MARK_SENT') {
    if (existing.payments.length) return NextResponse.json({ error: 'Invoice yang sudah menerima pembayaran tidak dapat ditandai terkirim.' }, { status: 409 })
    if (existing.status === 'SENT') return NextResponse.json({ invoice: existing, message: 'Invoice sudah ditandai terkirim.' })
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' },
      include: { client: true, items: true, payments: true },
    })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'MARK_SENT', entityType: 'INVOICE', entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber } })
    return NextResponse.json({ invoice, message: 'Invoice ditandai sebagai terkirim.' })
  }

  if (existing.payments.length) return NextResponse.json({ error: 'Invoice yang sudah menerima pembayaran tidak dapat diedit.' }, { status: 409 })
  if (existing.proposalId) return NextResponse.json({ error: 'Invoice hasil konversi proposal hanya dapat diubah dari proposal DRAFT sebelum dikonversi.' }, { status: 409 })
  if (existing.billingMilestoneId || existing.projectId) return NextResponse.json({ error: 'Invoice yang berasal dari project/billing milestone adalah dokumen terkunci. Koreksi harus dilakukan melalui proses koreksi invoice/credit note pada fase berikutnya.' }, { status: 409 })
  try {
    const client = await prisma.clientVendor.findFirst({ where: { id: body.clientId, workspaceId: c.workspace.id, type: 'CLIENT', isActive: true } })
    if (!client) return NextResponse.json({ error: 'Klien tidak ditemukan atau tidak aktif.' }, { status: 404 })
    const items = Array.isArray(body.items) ? body.items : []
    const subtotalCents = lineItemsTotalCents(items)
    const commercial = calculateCommercialTotals(subtotalCents, percentageBps(body.discountPercent ?? 0, 'Diskon'), percentageBps(body.taxPercent ?? 0, 'Pajak'))
    const dueDate = dateOnly(body.dueDate, 'Jatuh tempo')
    const termsAndConditions = optionalText(body.termsAndConditions, 5000)
    const invoice = await prisma.$transaction(async tx => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
      return tx.invoice.update({ where: { id }, data: {
        clientId: client.id,
        dueDate,
        status: 'UNPAID',
        subtotalAmount: commercial.subtotalAmount,
        discountPercent: bpsToDecimal(commercial.discountPercentBps),
        discountAmount: commercial.discountAmount,
        taxPercent: bpsToDecimal(commercial.taxPercentBps),
        taxAmount: commercial.taxAmount,
        totalAmount: commercial.totalAmount,
        termsAndConditions,
        items: { create: items.map((x: any) => ({ description: requireText(x.description, 'Deskripsi item', 500), qty: Number(x.qty), unit: optionalText(x.unit, 40) || 'UNIT', unitPrice: positiveMoney(x.unitPrice, 'Harga satuan').decimal, category: String(x.category || 'SERVICE') })) },
      }, include: { client: true, items: true, payments: true } })
    })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE', entityType: 'INVOICE', entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber, total: invoice.totalAmount.toString() } })
    return NextResponse.json({ invoice })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui invoice.' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat menghapus invoice.' }, { status: 403 })
  const { id } = await params
  const existing = await getOwned(id, c.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
  if (existing.payments.length) return NextResponse.json({ error: 'Invoice yang sudah dibayar tidak dapat dihapus.' }, { status: 409 })
  if (existing.proposalId) return NextResponse.json({ error: 'Invoice hasil konversi proposal tidak dapat dihapus dari layar ini.' }, { status: 409 })
  if (existing.billingMilestoneId || existing.projectId) return NextResponse.json({ error: 'Invoice yang terkait project/billing milestone tidak dapat dihapus. Gunakan proses void/correction yang teraudit pada fase berikutnya.' }, { status: 409 })
  await prisma.invoice.delete({ where: { id } })
  if (existing.projectId) await syncProjectFinancialStatuses(existing.projectId)
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'DELETE', entityType: 'INVOICE', entityId: id, metadata: { projectId: existing.projectId ?? null } })
  return NextResponse.json({ ok: true })
}
