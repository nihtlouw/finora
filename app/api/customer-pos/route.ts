import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, positiveMoney, requireText, parseMoneyCents, centsToDecimal } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  const rows = await prisma.customerPO.findMany({
    where: { workspaceId: c.workspace.id },
    include: {
      client: true,
      quotation: { select: { id: true, proposalNumber: true, projectName: true, status: true, subtotalAmount: true, taxAmount: true, totalAmount: true } },
      project: { select: { id: true, projectCode: true, projectName: true, status: true } },
      verifiedBy: { select: { id: true, name: true, email: true } },
      cancelledBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { poDate: 'desc' },
  })
  return NextResponse.json({ customerPOs: rows })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mencatat PO customer.' }, { status: 403 })

  try {
    const b = await req.json()
    const clientId = requireText(b.clientId, 'Klien')
    const poNumber = requireText(b.poNumber, 'Nomor PO', 120)
    const quotationId = requireText(b.quotationId, 'Proposal WON')

    const client = await prisma.clientVendor.findFirst({ where: { id: clientId, workspaceId: c.workspace.id, type: 'CLIENT', isActive: true } })
    if (!client) return NextResponse.json({ error: 'Klien tidak ditemukan atau tidak aktif.' }, { status: 404 })

    const quotation = await prisma.proposal.findFirst({
      where: { id: quotationId, clientId, client: { workspaceId: c.workspace.id } },
      select: { id: true, proposalNumber: true, status: true, subtotalAmount: true, taxAmount: true, totalAmount: true },
    })
    if (!quotation) return NextResponse.json({ error: 'Proposal referensi tidak ditemukan.' }, { status: 404 })
    if (quotation.status !== 'WON') return NextResponse.json({ error: 'Proposal harus WON sebelum direferensikan ke PO customer.' }, { status: 409 })
    const activePO = await prisma.customerPO.findFirst({ where: { workspaceId: c.workspace.id, quotationId, status: { in: ['RECEIVED', 'VERIFIED'] } }, select: { id: true, poNumber: true, status: true } })
    if (activePO) return NextResponse.json({ error: `Proposal WON sudah memiliki PO aktif ${activePO.poNumber} (${activePO.status}). Batalkan PO lama sebelum membuat PO pengganti.` }, { status: 409 })

    const quotationSubtotal = parseMoneyCents(quotation.subtotalAmount.toString())
    const quotationTax = parseMoneyCents(quotation.taxAmount.toString())
    const quotationGrand = parseMoneyCents(quotation.totalAmount.toString())

    const requestedSubtotal = b.totalAmount === undefined || b.totalAmount === ''
      ? quotationSubtotal
      : positiveMoney(b.totalAmount, 'Subtotal PO').cents
    const requestedTax = b.taxAmount === undefined || b.taxAmount === ''
      ? quotationTax
      : positiveMoney(b.taxAmount, 'PPN PO').cents
    const requestedGrand = b.grandTotal === undefined || b.grandTotal === ''
      ? requestedSubtotal + requestedTax
      : positiveMoney(b.grandTotal, 'Grand total PO').cents

    if (requestedGrand !== requestedSubtotal + requestedTax) {
      throw new Error('Grand total PO harus sama dengan subtotal + PPN.')
    }

    const variance = requestedGrand - quotationGrand
    const varianceReason = b.commercialVarianceReason ? String(b.commercialVarianceReason).trim() : ''
    if (variance !== 0n && !varianceReason) {
      return NextResponse.json({
        error: 'Nilai PO berbeda dari proposal WON. Jelaskan alasan perubahan nilai pada Commercial Variance Reason.',
        expected: {
          subtotal: centsToDecimal(quotationSubtotal),
          tax: centsToDecimal(quotationTax),
          grandTotal: centsToDecimal(quotationGrand),
        },
      }, { status: 409 })
    }
    if (varianceReason.length > 3000) throw new Error('Commercial variance reason terlalu panjang.')

    const row = await prisma.$transaction(async (tx) => {
      // Serialize PO creation per quotation so two concurrent requests cannot
      // create two active customer POs for the same WON proposal.
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        quotationId,
      )

      const duplicate = await tx.customerPO.findFirst({ where: { workspaceId: c.workspace.id, poNumber } })
      if (duplicate) throw new Error('Nomor PO tersebut sudah ada di workspace.')

      const activePO = await tx.customerPO.findFirst({
        where: { workspaceId: c.workspace.id, quotationId, status: { in: ['RECEIVED', 'VERIFIED'] } },
        select: { id: true, poNumber: true, status: true },
      })
      if (activePO) throw new Error(`Proposal WON ini sudah memiliki PO aktif ${activePO.poNumber} (${activePO.status}). PO baru hanya dapat dibuat setelah PO aktif dibatalkan.`)

      const created = await tx.customerPO.create({
        data: {
          workspaceId: c.workspace.id,
          clientId,
          quotationId,
          poNumber,
          poDate: dateOnly(b.poDate, 'Tanggal PO'),
          receivedDate: dateOnly(b.receivedDate || b.poDate, 'Tanggal diterima'),
          reference: b.reference ? String(b.reference).trim() : null,
          status: 'RECEIVED',
          totalAmount: centsToDecimal(requestedSubtotal),
          taxAmount: centsToDecimal(requestedTax),
          grandTotal: centsToDecimal(requestedGrand),
          quotationSubtotalSnapshot: centsToDecimal(quotationSubtotal),
          quotationTaxSnapshot: centsToDecimal(quotationTax),
          quotationGrandTotalSnapshot: centsToDecimal(quotationGrand),
          commercialVarianceAmount: centsToDecimal(variance),
          commercialVarianceReason: variance === 0n ? null : varianceReason,
          remarks: b.remarks ? String(b.remarks).trim() : null,
          documentUrl: b.documentUrl ? String(b.documentUrl).trim() : null,
        },
        include: { client: true, quotation: true },
      })
      return created
    })

    await writeAuditLog({
      workspaceId: c.workspace.id,
      actorUserId: c.user.id,
      action: 'CREATE',
      entityType: 'CUSTOMER_PO',
      entityId: row.id,
      metadata: {
        poNumber,
        clientId,
        quotationId,
        status: row.status,
        quotationGrandTotal: quotation.totalAmount.toString(),
        poGrandTotal: row.grandTotal.toString(),
        commercialVarianceAmount: row.commercialVarianceAmount.toString(),
      },
    })
    return NextResponse.json({ customerPO: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal mencatat PO customer.' }, { status: 400 })
  }
}
