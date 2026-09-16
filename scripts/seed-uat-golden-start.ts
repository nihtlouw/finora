import dotenv from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

function splitEmails(value: unknown): string[] {
  return String(value || '')
    .split(/[;,]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
}

function futureDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Date(d.toISOString().slice(0, 10))
}

const ownerEmails = splitEmails(process.env.FINORA_OWNER_EMAILS)
if (!ownerEmails.length) {
  throw new Error(
    'FINORA_OWNER_EMAILS belum dikonfigurasi. Isi .env.local agar script tidak salah memilih workspace.'
  )
}

const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 })
const prisma = new PrismaClient({ adapter })

const CLIENT_NAME = 'PT Nusantara Properti Sentosa'
const VENDOR_NAME = 'PT Cipta Material Engineering'
const PROPOSAL_NUMBER = 'PR-UAT-2026-001'
const QUOTATION_REFERENCE = 'QTN/UAT/FINORA/IX/2026'
const PROJECT_NAME = 'Upgrade Panel Listrik & Backup Power — Cikarang'
const PROJECT_LOCATION = 'Cikarang, Jawa Barat'

const items = [
  {
    category: 'SERVICE',
    description: 'Survey, engineering, dan mobilisasi pekerjaan',
    specification: 'Survey site, engineering check, mobilisasi tim',
    qty: 1,
    unit: 'LOT',
    unitPrice: 45000000,
  },
  {
    category: 'MATERIAL',
    description: 'Pengadaan panel LVMDP dan protection devices',
    specification: 'LVMDP, MCCB/ACB, metering, protection, enclosure',
    qty: 1,
    unit: 'SET',
    unitPrice: 210000000,
  },
  {
    category: 'SERVICE',
    description: 'Instalasi, testing, commissioning, dan dokumentasi',
    specification: 'Instalasi kabel, termination, testing, as-built drawing',
    qty: 1,
    unit: 'LOT',
    unitPrice: 140000000,
  },
]

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: { in: ownerEmails } },
    orderBy: { createdAt: 'asc' },
  })
  if (!owner) {
    throw new Error(`User tidak ditemukan untuk FINORA_OWNER_EMAILS=${ownerEmails.join(', ')}`)
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: owner.id, role: 'OWNER' },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) throw new Error('Workspace OWNER tidak ditemukan untuk user tersebut.')

  const workspaceId = membership.workspaceId
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const taxPercent = 11
  const taxAmount = Math.round((subtotal * taxPercent) / 100)
  const totalAmount = subtotal + taxAmount
  const validUntil = futureDate(14)

  const result = await prisma.$transaction(async (tx) => {
    let client = await tx.clientVendor.findFirst({
      where: { workspaceId, type: 'CLIENT', name: CLIENT_NAME },
    })
    if (!client) {
      client = await tx.clientVendor.create({
        data: {
          workspaceId,
          name: CLIENT_NAME,
          type: 'CLIENT',
          category: 'PROPERTY / INDUSTRIAL',
          offerings: 'Pengelolaan fasilitas dan properti industri',
          email: 'procurement@nusantaraproperti.example.invalid',
          phone: '+62 21 555 2600',
          picName: 'Andi Pratama',
          address: 'Kawasan Industri Jababeka, Cikarang, Jawa Barat',
          isActive: true,
        },
      })
    }

    let vendor = await tx.clientVendor.findFirst({
      where: { workspaceId, type: 'VENDOR', name: VENDOR_NAME },
    })
    if (!vendor) {
      vendor = await tx.clientVendor.create({
        data: {
          workspaceId,
          name: VENDOR_NAME,
          type: 'VENDOR',
          category: 'ELECTRICAL SUPPLIER',
          offerings: 'Panel listrik, protection devices, kabel, dan material electrical',
          email: 'sales@ciptamaterial.example.invalid',
          phone: '+62 21 555 3810',
          picName: 'Budi Santoso',
          address: 'Bekasi, Jawa Barat',
          isActive: true,
        },
      })
    }

    const existingProposal = await tx.proposal.findUnique({
      where: { proposalNumber: PROPOSAL_NUMBER },
      include: { sections: { include: { items: true } } },
    })

    let proposalId: string
    let reused = false

    if (existingProposal) {
      if (existingProposal.status !== 'DRAFT') {
        throw new Error(
          `Proposal ${PROPOSAL_NUMBER} sudah ada dengan status ${existingProposal.status}. Script berhenti agar state UAT tidak tertimpa.`
        )
      }
      if (existingProposal.clientId !== client.id) {
        throw new Error(`Proposal ${PROPOSAL_NUMBER} sudah ada tetapi client-nya berbeda. Script berhenti.`)
      }
      proposalId = existingProposal.id
      reused = existingProposal.sections.length > 0
    } else {
      const createdProposal = await tx.proposal.create({
        data: {
          clientId: client.id,
          proposalNumber: PROPOSAL_NUMBER,
          quotationReference: QUOTATION_REFERENCE,
          projectName: PROJECT_NAME,
          projectLocation: PROJECT_LOCATION,
          scopeSummary:
            'Upgrade panel distribusi listrik mencakup engineering, pengadaan panel dan protection devices, instalasi, testing, commissioning, dan dokumentasi akhir.',
          status: 'DRAFT',
          subtotalAmount: String(subtotal),
          discountPercent: '0',
          discountAmount: '0',
          taxPercent: String(taxPercent),
          taxAmount: String(taxAmount),
          totalAmount: String(totalAmount),
          termsAndConditions: [
            'Penawaran berlaku 14 hari kalender sejak tanggal terbit.',
            'Harga sudah termasuk jasa instalasi dan commissioning sesuai scope.',
            'PPN 11% dihitung di atas nilai pekerjaan.',
            'Termin pembayaran akan dituangkan pada Customer PO dan Payment Schedule.',
            'Perubahan scope di luar proposal diproses melalui change order / revisi komersial.',
          ].join('\n'),
          validUntil,
        },
      })

      const section = await tx.proposalSection.create({
        data: {
          proposalId: createdProposal.id,
          code: 'A',
          name: 'SCOPE PEKERJAAN UAT',
          description: 'Satu section sederhana untuk memudahkan UAT proposal end-to-end.',
          sortOrder: 0,
        },
      })

      for (const item of items) {
        await tx.proposalItem.create({
          data: {
            proposalId: createdProposal.id,
            sectionId: section.id,
            category: item.category,
            description: item.description,
            itemType: item.category,
            specification: item.specification,
            qty: item.qty,
            unit: item.unit,
            unitPrice: String(item.unitPrice),
          },
        })
      }

      proposalId = createdProposal.id
    }

    const proposal = await tx.proposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { sections: { include: { items: true } } },
    })

    return { client, vendor, proposal, reused }
  })

  console.log('')
  console.log('=== FINORA UAT GOLDEN START ===')
  console.log(`Workspace : ${membership.workspace.name}`)
  console.log(`Client    : ${result.client.name}`)
  console.log(`Vendor    : ${result.vendor.name}`)
  console.log(`Proposal  : ${result.proposal.proposalNumber}`)
  console.log(`Reference : ${QUOTATION_REFERENCE}`)
  console.log(`Project   : ${PROJECT_NAME}`)
  console.log(`Location  : ${PROJECT_LOCATION}`)
  console.log(`Subtotal  : Rp${subtotal.toLocaleString('id-ID')}`)
  console.log(`PPN 11%   : Rp${taxAmount.toLocaleString('id-ID')}`)
  console.log(`Total     : Rp${totalAmount.toLocaleString('id-ID')}`)
  console.log(`Status    : ${result.proposal.status}`)
  console.log(`Mode      : ${result.reused ? 'REUSED EXISTING DRAFT' : 'CREATED NEW UAT DATA'}`)
  console.log('')
  console.log('UAT mulai dari sini:')
  console.log('  1. Proposal DRAFT -> SENT')
  console.log('  2. SENT -> WON')
  console.log('  3. Coba shortcut SENT -> Project (HARUS REJECT)')
  console.log('  4. Buat Customer PO dari Proposal WON')
  console.log('  5. Coba Project dengan PO belum VERIFIED (HARUS REJECT)')
  console.log('  6. VERIFIED -> Project')
  console.log('  7. Lanjut Billing -> Invoice -> Payment -> Expense -> Profitability')
  console.log('')
  console.log('Vendor dibuat sebagai master data terpisah untuk UAT Expense/Cost di tahap berikutnya.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
