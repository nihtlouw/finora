import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, lineItemsTotalCents, requireText, positiveMoney, optionalText } from '@/lib/validation/finance'
import { calculateCommercialTotals, percentageBps, bpsToDecimal } from '@/lib/validation/commercial'

export const dynamic = 'force-dynamic'
const ALLOWED = new Set(['DRAFT', 'SENT', 'NEGOTIATION', 'WON', 'LOST', 'EXPIRED', 'CANCELLED'])

function normalizeSections(body: any) {
  const rawSections = Array.isArray(body.sections) ? body.sections : []
  if (rawSections.length) return rawSections
  const legacyItems = Array.isArray(body.items) ? body.items : []
  return [{ code: 'A', name: 'Pekerjaan Utama', description: '', items: legacyItems }]
}
function validateSections(sections: any[]) {
  if (!sections.length) throw new Error('Minimal satu bagian pekerjaan harus diisi.')
  sections.forEach((section: any, sectionIndex: number) => {
    requireText(section.name, `Nama section ${sectionIndex + 1}`, 150)
    const items = Array.isArray(section.items) ? section.items : []
    if (!items.length) throw new Error(`Section ${section.name} belum memiliki item.`)
    items.forEach((item: any, itemIndex: number) => {
      requireText(item.description, `Deskripsi item ${sectionIndex + 1}.${itemIndex + 1}`, 500)
      const qty = Number(item.qty)
      if (!Number.isInteger(qty) || qty < 1) throw new Error(`Qty item ${sectionIndex + 1}.${itemIndex + 1} harus bilangan bulat minimal 1.`)
      positiveMoney(item.unitPrice, `Harga satuan item ${sectionIndex + 1}.${itemIndex + 1}`)
      const category = String(item.category || 'SERVICE')
      if (!['MATERIAL','SERVICE','OTHER'].includes(category)) throw new Error(`Kategori item ${sectionIndex + 1}.${itemIndex + 1} tidak valid.`)
    })
  })
}
function sectionCreateData(sections: any[]) {
  return sections.map((section: any, index: number) => ({
    code: String(section.code || String.fromCharCode(65 + index)).trim() || String.fromCharCode(65 + index),
    name: requireText(section.name, `Nama section ${index + 1}`, 150),
    description: optionalText(section.description, 2000),
    sortOrder: index,
    items: { create: (Array.isArray(section.items) ? section.items : []).map((item: any) => ({
      description: requireText(item.description, 'Deskripsi item', 500), category: String(item.category || 'SERVICE'), brand: optionalText(item.brand, 150), itemType: optionalText(item.itemType, 150), specification: optionalText(item.specification, 5000), qty: Number(item.qty), unit: String(item.unit || 'UNIT').trim() || 'UNIT', unitPrice: positiveMoney(item.unitPrice, 'Harga satuan').decimal, notes: optionalText(item.notes, 2000),
    })) },
  }))
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE', 'SALES'].includes(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Payload JSON tidak valid.' }, { status: 400 }) }
  const existing = await prisma.proposal.findFirst({ where: { id, client: { workspaceId: c.workspace.id } }, include: { items: true, sections: { orderBy: { sortOrder: 'asc' } }, invoice: true, client: true } })
  if (!existing) return NextResponse.json({ error: 'Proposal tidak ditemukan.' }, { status: 404 })

  try {
    if (body.action === 'CONVERT') {
      return NextResponse.json({ error: 'Konversi Proposal langsung ke Invoice sudah dihentikan. Proposal WON harus melalui Customer PO → Project → Billing Milestone → Invoice.' }, { status: 409 })
    }

    if (body.action === 'EDIT') {
      if (existing.status !== 'DRAFT') return NextResponse.json({ error: 'Proposal hanya bisa diedit saat DRAFT.' }, { status: 409 })
      const clientId = requireText(body.clientId, 'Klien')
      const client = await prisma.clientVendor.findFirst({ where: { id: clientId, workspaceId: c.workspace.id, type: 'CLIENT', isActive: true } })
      if (!client) return NextResponse.json({ error: 'Klien tidak ditemukan atau tidak aktif.' }, { status: 404 })
      const sections = normalizeSections(body)
      validateSections(sections)
      const items = sections.flatMap((section: any) => Array.isArray(section.items) ? section.items : [])
      const subtotalCents = lineItemsTotalCents(items)
      const commercial = calculateCommercialTotals(subtotalCents, percentageBps(body.discountPercent ?? 0, 'Diskon'), percentageBps(body.taxPercent ?? 0, 'Pajak'))
      const validUntil = dateOnly(body.validUntil, 'Berlaku sampai')
      const termsAndConditions = optionalText(body.termsAndConditions, 5000)
      await prisma.$transaction(async tx => {
        // Legacy ProposalItem rows may pre-date ProposalSection and therefore
        // have sectionId = NULL. They are invisible in the section editor but
        // would still be picked up by invoice conversion. Remove those legacy
        // orphans together with the section tree when replacing a DRAFT.
        await tx.proposalItem.deleteMany({ where: { proposalId: id, sectionId: null } })
        await tx.proposalSection.deleteMany({ where: { proposalId: id } })
        return tx.proposal.update({ where: { id }, data: { clientId, quotationReference: optionalText(body.quotationReference, 150), projectName: optionalText(body.projectName, 250), projectLocation: optionalText(body.projectLocation, 250), scopeSummary: optionalText(body.scopeSummary, 5000), validUntil, subtotalAmount: commercial.subtotalAmount, discountPercent: bpsToDecimal(commercial.discountPercentBps), discountAmount: commercial.discountAmount, taxPercent: bpsToDecimal(commercial.taxPercentBps), taxAmount: commercial.taxAmount, totalAmount: commercial.totalAmount, termsAndConditions, sections: { create: sectionCreateData(sections) } } })
      })
      const proposal = await prisma.proposal.findUnique({ where: { id }, include: { client: true, items: true, sections: { orderBy: { sortOrder: 'asc' }, include: { items: true } }, invoice: true } })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE', entityType: 'PROPOSAL', entityId: id, metadata: { total: proposal?.totalAmount?.toString(), sectionCount: proposal?.sections?.length || 0 } })
      return NextResponse.json({ proposal })
    }

    if (typeof body.status !== 'string' || !ALLOWED.has(body.status)) return NextResponse.json({ error: 'Status proposal tidak valid.' }, { status: 400 })

    // Sending a draft is a sales workflow action, but accepting/rejecting a
    // quotation is a commercial/financial decision. The API must enforce the
    // same rule as the UI so a SALES user cannot bypass it with a direct PATCH.
    if ((body.status === 'WON' || body.status === 'LOST' || body.status === 'EXPIRED' || body.status === 'CANCELLED') && !canManageFinance(c.user.role)) {
      return NextResponse.json({ error: 'Hanya Owner / Finance yang dapat menerima atau menolak proposal.' }, { status: 403 })
    }

    if (body.status === 'EXPIRED') {
      const today = new Date(new Date().toISOString().slice(0, 10))
      if (existing.validUntil >= today) return NextResponse.json({ error: 'Proposal belum melewati tanggal berlaku sehingga belum dapat dinyatakan EXPIRED.' }, { status: 409 })
    }
    const transitionOk =
      (existing.status === 'DRAFT' && body.status === 'SENT') ||
      (existing.status === 'SENT' && ['NEGOTIATION', 'WON', 'LOST', 'EXPIRED', 'CANCELLED'].includes(body.status)) ||
      (existing.status === 'NEGOTIATION' && ['WON', 'LOST', 'EXPIRED', 'CANCELLED'].includes(body.status)) ||
      existing.status === body.status
    if (!transitionOk) return NextResponse.json({ error: `Perubahan status ${existing.status} → ${body.status} tidak diizinkan.` }, { status: 409 })
    const proposal = await prisma.proposal.update({ where: { id }, data: { status: body.status }, include: { client: true, items: true, sections: { orderBy: { sortOrder: 'asc' }, include: { items: true } }, invoice: true } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE_STATUS', entityType: 'PROPOSAL', entityId: id, metadata: { from: existing.status, to: body.status } })
    return NextResponse.json({ proposal })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui proposal.' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE', 'SALES'].includes(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  const { id } = await params
  const existing = await prisma.proposal.findFirst({ where: { id, client: { workspaceId: c.workspace.id } }, include: { invoice: true } })
  if (!existing) return NextResponse.json({ error: 'Proposal tidak ditemukan.' }, { status: 404 })
  if (existing.invoice) return NextResponse.json({ error: 'Proposal yang sudah menjadi invoice tidak dapat dihapus.' }, { status: 409 })
  if (existing.status !== 'DRAFT') return NextResponse.json({ error: 'Hanya proposal DRAFT yang dapat dihapus.' }, { status: 409 })
  try {
    await prisma.proposal.delete({ where: { id } })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'DELETE', entityType: 'PROPOSAL', entityId: id, metadata: {} })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal menghapus proposal.' }, { status: 400 })
  }
}
