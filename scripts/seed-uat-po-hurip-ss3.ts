import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

function splitEmails(value: unknown): string[] {
  return String(value || '')
    .split(/[;,]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const ownerEmails = splitEmails(process.env.FINORA_OWNER_EMAILS)
if (!ownerEmails.length) throw new Error('FINORA_OWNER_EMAILS belum dikonfigurasi.')

const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 })
const prisma = new PrismaClient({ adapter })

const PO_NUMBER = '00077/PO/HU/VIII/2026'
const PO_DATE = new Date('2026-08-10')
const CLIENT_NAME = 'PT HURIP UTAMA'
const SUPPLIER_NAME = 'PT BERJAYA SUKSES MAKMUR'
const REFERENCE_OFFER = '0072/PH-BSM/HU/VII/2026'.replace('VII','VIII')
const PROJECT_SCOPE = 'Jasa Terminasi Penarikan Kabel Power SS3 ke NPK-2'
const SUBTOTAL = 28377500
const TAX = 3121525
const GRAND_TOTAL = 31500000

async function main() {
  console.log('=== UAT PO KABEL POWER SS3 ===')

  const owner = await prisma.user.findFirst({
    where: { email: { in: ownerEmails } },
    orderBy: { createdAt: 'asc' },
  })
  if (!owner) throw new Error('User owner tidak ditemukan.')

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: owner.id, role: 'OWNER' },
    include: { workspace: true },
  })
  if (!membership) throw new Error('Workspace OWNER tidak ditemukan.')

  const workspaceId = membership.workspaceId

  let client = await prisma.clientVendor.findFirst({
    where: { workspaceId, name: CLIENT_NAME, type: 'CLIENT' },
  })
  if (!client) {
    client = await prisma.clientVendor.create({
      data: {
        workspaceId,
        name: CLIENT_NAME,
        type: 'CLIENT',
        address: 'Kawasan Industri Kujang Cikampek, Dawuan Tengah, Kec. Cikampek, Karawang, Jawa Barat',
        isActive: true,
      },
    })
    console.log(`Client   : ${client.name} [created]`)
  } else {
    console.log(`Client   : ${client.name} [existing]`)
  }

  const proposalNumber = 'PR-UAT-HU-SS3-2026-001'
  let proposal = await prisma.proposal.findUnique({ where: { proposalNumber } })

  if (!proposal) {
    proposal = await prisma.$transaction(async tx => {
      const row = await tx.proposal.create({
        data: {
          clientId: client!.id,
          proposalNumber,
          quotationReference: REFERENCE_OFFER,
          projectName: PROJECT_SCOPE,
          projectLocation: 'NPK-2',
          scopeSummary: PROJECT_SCOPE,
          status: 'WON',
          subtotalAmount: SUBTOTAL.toFixed(2),
          discountPercent: '0',
          discountAmount: '0',
          taxPercent: '11',
          taxAmount: TAX.toFixed(2),
          totalAmount: GRAND_TOTAL.toFixed(2),
          currency: 'IDR',
          taxIncluded: true,
          overheadAmount: '0',
          roundingAmount: '0',
          roundedTotalAmount: GRAND_TOTAL.toFixed(2),
          pricingMode: 'ITEM_SUM',
          commercialNotes: 'SOURCE BRIDGE UAT: data komersial diturunkan langsung dari Customer PO Kabel Power SS3; bukan quotation asli.',
          termsAndConditions: [
            'Harga sudah termasuk PPN.',
            'Garansi 6 (enam) bulan.',
            'DP 50% dari PO terbit, pembayaran 7 hari setelah invoice masuk.',
            'Pelunasan 50% setelah pekerjaan selesai dengan BAP.',
            `Referensi surat penawaran: ${REFERENCE_OFFER}.`,
          ].join('\\n'),
          validUntil: PO_DATE,
        },
      })

      const section = await tx.proposalSection.create({
        data: {
          proposalId: row.id,
          code: 'SS3',
          name: PROJECT_SCOPE,
          description: 'Source bridge section derived from Customer PO.',
          sortOrder: 0,
        },
      })

      await tx.proposalItem.createMany({
        data: [
          {
            proposalId: row.id,
            sectionId: section.id,
            description: 'Material',
            category: 'MATERIAL',
            qty: 1,
            unit: 'LOT',
            unitPrice: '22000000',
          },
          {
            proposalId: row.id,
            sectionId: section.id,
            description: 'Jasa Terminasi',
            category: 'SERVICE',
            qty: 1,
            unit: 'LOT',
            unitPrice: '6377500',
          },
        ],
      })

      await tx.auditLog.create({
        data: {
          workspaceId,
          actorUserId: owner!.id,
          action: 'CREATE_UAT_BRIDGE_PROPOSAL',
          entityType: 'PROPOSAL',
          entityId: row.id,
          metadata: {
            proposalNumber,
            sourcePoNumber: PO_NUMBER,
            referenceOffer: REFERENCE_OFFER,
            note: 'Synthetic bridge only; source PO did not include a separate matching quotation.',
          },
        },
      })
      return row
    })
    console.log(`Proposal : ${proposalNumber} [created as WON bridge]`)
  } else {
    if (proposal.clientId !== client.id) throw new Error('Existing bridge proposal belongs to another client.')
    if (proposal.status !== 'WON') throw new Error(`Existing bridge proposal status is ${proposal.status}; seed will not change it.`)
    console.log(`Proposal : ${proposalNumber} [existing]`)
  }

  let po = await prisma.customerPO.findFirst({ where: { workspaceId, poNumber: PO_NUMBER } })
  if (!po) {
    po = await prisma.customerPO.create({
      data: {
        workspaceId,
        clientId: client.id,
        quotationId: proposal.id,
        poNumber: PO_NUMBER,
        poDate: PO_DATE,
        receivedDate: PO_DATE,
        reference: REFERENCE_OFFER,
        status: 'RECEIVED',
        totalAmount: SUBTOTAL.toFixed(2),
        taxAmount: TAX.toFixed(2),
        grandTotal: GRAND_TOTAL.toFixed(2),
        currency: 'IDR',
        taxIncluded: true,
        overheadAmount: '0',
        roundingAmount: '0',
        roundedGrandTotal: GRAND_TOTAL.toFixed(2),
        pricingMode: 'ITEM_SUM',
        paymentTermsSnapshot: {
          currency: 'IDR',
          source: 'Customer PO',
          stages: [
            {
              sequence: 1,
              name: 'DP 50%',
              percentage: 50,
              triggerCode: 'PO_RELEASED',
              triggerDescription: 'DP 50% dari PO terbit.',
              dueDays: 7,
              dueRule: 'days_after_invoice_received',
            },
            {
              sequence: 2,
              name: 'Pelunasan 50%',
              percentage: 50,
              triggerCode: 'BAP_COMPLETED',
              triggerDescription: 'Pelunasan 50% setelah pekerjaan selesai dengan BAP.',
              conditionNotes: 'PO tidak menyebut jumlah hari setelah BAP.',
            },
          ],
        },
        remarks: [
          'Source document: 2. PO-Kabel Power SS3 -1 ttd.pdf.',
          `Supplier: ${SUPPLIER_NAME}.`,
          'Harga sudah termasuk PPN 11%.',
          'Garansi 6 (enam) bulan.',
          'UAT assumption: receivedDate disamakan dengan poDate karena PDF hanya mencantumkan tanggal PO.',
          'PO sengaja dibuat RECEIVED agar tahap VERIFY dapat diuji melalui workflow Finora.',
        ].join(' '),
      },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: owner.id,
        action: 'CREATE_UAT_CUSTOMER_PO',
        entityType: 'CUSTOMER_PO',
        entityId: po.id,
        metadata: {
          poNumber: PO_NUMBER,
          client: CLIENT_NAME,
          supplier: SUPPLIER_NAME,
          poDate: '2026-08-10',
          subtotal: SUBTOTAL,
          tax: TAX,
          grandTotal: GRAND_TOTAL,
          taxIncluded: true,
          payment: '50% DP / 50% BAP',
          reference: REFERENCE_OFFER,
          source: 'PO Kabel Power SS3',
        },
      },
    })
    console.log(`PO       : ${po.poNumber} [created: RECEIVED]`)
  } else {
    if (po.clientId !== client.id || po.quotationId !== proposal.id) {
      throw new Error('Existing PO belongs to a different client/proposal; seed stopped.')
    }
    console.log(`PO       : ${po.poNumber} [existing: ${po.status}]`)
  }

  console.log('')
  console.log('=== SOURCE SNAPSHOT ===')
  console.log(`Client      : ${CLIENT_NAME}`)
  console.log(`PO Number   : ${PO_NUMBER}`)
  console.log('PO Date     : 10 Aug 2026')
  console.log(`Reference   : ${REFERENCE_OFFER}`)
  console.log(`Subtotal    : Rp${SUBTOTAL.toLocaleString('id-ID')}`)
  console.log(`PPN 11%     : Rp${TAX.toLocaleString('id-ID')}`)
  console.log(`Grand Total : Rp${GRAND_TOTAL.toLocaleString('id-ID')}`)
  console.log('Payment     : 50% DP / 50% setelah pekerjaan selesai + BAP')
  console.log('')
  console.log('NEXT: verify PO in UI, then create Project from VERIFIED PO.')
}

main()
  .catch(error => {
    console.error('=== SEED FAILED ===')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
