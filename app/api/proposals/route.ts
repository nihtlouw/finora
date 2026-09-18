import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, lineItemsTotalCents, requireText, positiveMoney, optionalText, parseMoneyCents, centsToDecimal } from '@/lib/validation/finance'
import { percentageBps, bpsToDecimal } from '@/lib/validation/commercial'

export const dynamic = 'force-dynamic'

function normalizeSections(body: any) {
  const rawSections = Array.isArray(body.sections) ? body.sections : []
  if (rawSections.length) return rawSections
  const legacyItems = Array.isArray(body.items) ? body.items : []
  return [{ code: 'A', name: 'Pekerjaan Utama', description: '', items: legacyItems }]
}

function flattenItems(sections: any[]) {
  return sections.flatMap((section: any) => Array.isArray(section.items) ? section.items : [])
}

function validateSections(sections: any[]) {
  if (!sections.length) throw new Error('Minimal satu bagian pekerjaan harus diisi.')
  sections.forEach((section, sectionIndex) => {
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

function commercialWithOverhead(subtotalCents: bigint, discountBps: bigint, taxBps: bigint, overheadCents: bigint, roundingCents: bigint, taxIncluded: boolean) {
  const discount = (subtotalCents * discountBps + 5000n) / 10000n
  const net = subtotalCents > discount ? subtotalCents - discount : 0n
  const tax = taxIncluded ? ((net * taxBps + 5000n) / 10000n) : ((net * taxBps + 5000n) / 10000n)
  const total = net + overheadCents + tax
  return { subtotal: centsToDecimal(subtotalCents), discount: centsToDecimal(discount), tax: centsToDecimal(tax), total: centsToDecimal(total), rounded: centsToDecimal(total + roundingCents), overhead: centsToDecimal(overheadCents), rounding: centsToDecimal(roundingCents) }
}

function sectionCreateData(sections: any[]) {
  return sections.map((section: any, index: number) => ({
    code: String(section.code || String.fromCharCode(65 + index)).trim() || String.fromCharCode(65 + index),
    name: requireText(section.name, `Nama section ${index + 1}`, 150),
    description: optionalText(section.description, 2000),
    sortOrder: index,
    items: { create: (Array.isArray(section.items) ? section.items : []).map((item: any) => ({
      description: requireText(item.description, 'Deskripsi item', 500),
      category: String(item.category || 'SERVICE'),
      brand: optionalText(item.brand, 150),
      itemType: optionalText(item.itemType, 150),
      specification: optionalText(item.specification, 5000),
      qty: Number(item.qty),
      unit: String(item.unit || 'UNIT').trim() || 'UNIT',
      unitPrice: positiveMoney(item.unitPrice, 'Harga satuan').decimal,
      notes: optionalText(item.notes, 2000),
    })) },
  }))
}

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const rows = await prisma.proposal.findMany({
    where: { client: { workspaceId: c.workspace.id } },
    include: { client: true, items: { orderBy: { id: 'asc' } }, sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { id: 'asc' } } } }, invoice: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ proposals: rows })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE', 'SALES'].includes(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  try {
    const b = await req.json()
    const clientId = requireText(b.clientId, 'Klien')
    const client = await prisma.clientVendor.findFirst({ where: { id: clientId, workspaceId: c.workspace.id, type: 'CLIENT', isActive: true } })
    if (!client) return NextResponse.json({ error: 'Klien tidak ditemukan atau tidak aktif.' }, { status: 404 })
    const sections = normalizeSections(b)
    validateSections(sections)
    const items = flattenItems(sections)
    const subtotalCents = lineItemsTotalCents(items)
    const discountBps = percentageBps(b.discountPercent ?? 0, 'Diskon'); const taxBps = percentageBps(b.taxPercent ?? 0, 'Pajak'); const overheadCents = parseMoneyCents(String(b.overheadAmount ?? '0')); const roundingCents = parseMoneyCents(String(b.roundingAmount ?? '0')); const commercial = commercialWithOverhead(subtotalCents, discountBps, taxBps, overheadCents, roundingCents, Boolean(b.taxIncluded))
    const validUntil = dateOnly(b.validUntil, 'Berlaku sampai')
    if (validUntil < new Date(new Date().toISOString().slice(0, 10))) throw new Error('Masa berlaku proposal tidak boleh di masa lalu.')
    const proposalNumber = String(b.proposalNumber ?? '').trim() || `PR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
    const row = await prisma.proposal.create({
      data: {
        clientId: client.id,
        proposalNumber,
        quotationReference: optionalText(b.quotationReference, 150),
        projectName: optionalText(b.projectName, 250),
        projectLocation: optionalText(b.projectLocation, 250),
        scopeSummary: optionalText(b.scopeSummary, 5000),
        status: 'DRAFT',
        subtotalAmount: commercial.subtotal,
        discountPercent: bpsToDecimal(discountBps),
        discountAmount: commercial.discount,
        taxPercent: bpsToDecimal(taxBps),
        taxAmount: commercial.tax,
        totalAmount: commercial.total,
        currency: String(b.currency || 'IDR'),
        taxIncluded: Boolean(b.taxIncluded),
        overheadAmount: commercial.overhead,
        roundingAmount: commercial.rounding,
        roundedTotalAmount: commercial.rounded,
        pricingMode: String(b.pricingMode || 'ITEM_SUM'),
        commercialNotes: optionalText(b.commercialNotes, 5000),
        termsAndConditions: optionalText(b.termsAndConditions, 5000),
        validUntil,
        sections: { create: sectionCreateData(sections) },
      },
      include: { client: true, items: { orderBy: { id: 'asc' } }, sections: { orderBy: { sortOrder: 'asc' }, include: { items: true } } },
    })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'PROPOSAL', entityId: row.id, metadata: { proposalNumber: row.proposalNumber, total: row.totalAmount.toString(), sectionCount: row.sections.length } })
    return NextResponse.json({ proposal: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat proposal.' }, { status: 400 })
  }
}
