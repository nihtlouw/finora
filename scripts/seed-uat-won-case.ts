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

function futureDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Date(d.toISOString().slice(0, 10))
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const ownerEmails = splitEmails(process.env.FINORA_OWNER_EMAILS)
if (!ownerEmails.length) {
  throw new Error('FINORA_OWNER_EMAILS belum dikonfigurasi. Script tidak akan menebak owner/workspace.')
}

const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 })
const prisma = new PrismaClient({ adapter })

const CLIENT_NAME = 'PT Nusantara Properti Sentosa'
const PROPOSAL_NUMBER = 'PR-UAT-2026-002'
const QUOTATION_REFERENCE = 'QTN/UAT/FINORA/X/2026-B'
const PROJECT_NAME = 'Retrofit Panel Listrik & ATS-Genset — Bekasi Timur'
const PROJECT_LOCATION = 'Bekasi Timur, Jawa Barat'

type SeedItem = readonly [string, string, string, string, string, number, string, number]
type SeedSection = { code: string; name: string; description: string; items: SeedItem[] }

const sectionData: SeedSection[] = [
  {
    code: 'A',
    name: 'MATERIAL PANEL & ATS',
    description: 'Pengadaan material utama untuk retrofit panel distribusi dan integrasi ATS-genset.',
    items: [
      ['MATERIAL', 'Panel LVMDP Retrofit 1600A', 'Schneider', 'MVS / Equivalent', 'ACB 4P 1600A, enclosure indoor', 1, 'SET', 145000000],
      ['MATERIAL', 'Automatic Transfer Switch 1600A', 'Schneider', 'ATS', 'Interlock PLN-Genset, 4P', 1, 'SET', 78000000],
      ['MATERIAL', 'Busbar & Power Accessories', '', '', 'Copper busbar, support, lug, termination accessories', 1, 'LOT', 22000000],
    ],
  },
  {
    code: 'B',
    name: 'JASA INSTALLASI & INTEGRASI',
    description: 'Dismantling panel existing, instalasi panel retrofit, wiring kontrol, dan integrasi genset.',
    items: [
      ['SERVICE', 'Dismantling & Re-arrangement Panel Existing', '', '', 'Shutdown coordination dan pekerjaan pembongkaran', 1, 'LOT', 18000000],
      ['SERVICE', 'Instalasi Panel Retrofit & ATS', '', '', 'Posisi existing panel room', 1, 'LOT', 32000000],
      ['SERVICE', 'Control Wiring & Integration Genset', '', '', 'Signal PLN / GENSET / ATS', 1, 'LOT', 24000000],
      ['SERVICE', 'Testing, Commissioning & As-Built', '', '', 'FAT/SAT, functional test, dokumentasi akhir', 1, 'LOT', 14000000],
    ],
  },
]

const subtotal = sectionData.flatMap((s) => s.items).reduce((sum, item) => sum + Number(item[7]), 0)
const taxPercent = 11
const taxAmount = Math.round(subtotal * taxPercent / 100)
const totalAmount = subtotal + taxAmount

async function main() {
  const owner = await prisma.user.findFirst({
    where: { email: { in: ownerEmails } },
    orderBy: { createdAt: 'asc' },
  })
  if (!owner) throw new Error(`User owner tidak ditemukan untuk FINORA_OWNER_EMAILS=${ownerEmails.join(', ')}`)

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: owner.id, role: 'OWNER' },
    include: { workspace: true },
  })
  if (!membership) throw new Error('Workspace OWNER tidak ditemukan untuk user owner.')

  const workspaceId = membership.workspaceId

  let client = await prisma.clientVendor.findFirst({
    where: { workspaceId, type: 'CLIENT', name: CLIENT_NAME },
  })

  if (!client) {
    client = await prisma.clientVendor.create({
      data: {
        workspaceId,
        name: CLIENT_NAME,
        type: 'CLIENT',
        picName: 'PIC UAT Procurement',
        email: 'uat-client@example.invalid',
        address: 'Bekasi, Jawa Barat',
        isActive: true,
      },
    })
  }

  const existing = await prisma.proposal.findUnique({
    where: { proposalNumber: PROPOSAL_NUMBER },
    include: { invoice: true },
  })

  if (existing?.invoice) {
    console.log(`Proposal ${PROPOSAL_NUMBER} sudah memiliki invoice. Tidak diubah agar UAT aman.`)
    return
  }

  if (existing) {
    console.log(`Proposal ${PROPOSAL_NUMBER} sudah ada dengan status ${existing.status}. Tidak diubah agar UAT aman.`)
    console.log(`Project : ${existing.projectName || '-'}`)
    return
  }

  const proposalId = await prisma.$transaction(async (tx) => {
    const row = await tx.proposal.create({
      data: {
        clientId: client.id,
        proposalNumber: PROPOSAL_NUMBER,
        quotationReference: QUOTATION_REFERENCE,
        projectName: PROJECT_NAME,
        projectLocation: PROJECT_LOCATION,
        scopeSummary: 'Retrofit panel distribusi, integrasi ATS-genset, pengujian fungsi, dan dokumentasi as-built.',
        status: 'DRAFT',
        subtotalAmount: String(subtotal),
        discountPercent: '0',
        discountAmount: '0',
        taxPercent: String(taxPercent),
        taxAmount: String(taxAmount),
        totalAmount: String(totalAmount),
        termsAndConditions: [
          'Harga sudah memperhitungkan pekerjaan material, instalasi, testing, dan commissioning sesuai scope.',
          'PPN 11% dikenakan atas nilai penawaran.',
          'Penawaran berlaku 14 hari kalender sejak tanggal terbit.',
          'Simulasi termin: DP 30% setelah PO/SPK, progress 60% setelah instalasi dan testing, retensi 10% setelah handover.',
          'Data ini dibuat khusus untuk UAT Golden Path; belum membentuk Customer PO atau Project.',
        ].join('\n'),
        validUntil: futureDate(14),
      },
    })

    let sortOrder = 0
    for (const section of sectionData) {
      const createdSection = await tx.proposalSection.create({
        data: {
          proposalId: row.id,
          code: section.code,
          name: section.name,
          description: section.description,
          sortOrder,
        },
      })
      sortOrder += 1

      for (const item of section.items) {
        await tx.proposalItem.create({
          data: {
            proposalId: row.id,
            sectionId: createdSection.id,
            category: item[0],
            description: item[1],
            brand: item[2] || null,
            itemType: item[3] || null,
            specification: item[4] || null,
            qty: item[5],
            unit: item[6],
            unitPrice: String(item[7]),
            notes: null,
          },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: owner.id,
        action: 'CREATE_UAT_DEMO',
        entityType: 'PROPOSAL',
        entityId: row.id,
        metadata: {
          proposalNumber: PROPOSAL_NUMBER,
          reference: QUOTATION_REFERENCE,
          projectName: PROJECT_NAME,
          scenario: 'GOLDEN_PATH_WON',
          total: String(totalAmount),
          sectionCount: sectionData.length,
          itemCount: sectionData.reduce((n, s) => n + s.items.length, 0),
        },
      },
    })

    return row.id
  })

  console.log('=== FINORA UAT GOLDEN PATH — WON CASE ===')
  console.log(`Workspace : ${membership.workspace.name}`)
  console.log(`Client    : ${CLIENT_NAME}`)
  console.log(`Proposal  : ${PROPOSAL_NUMBER}`)
  console.log(`Reference : ${QUOTATION_REFERENCE}`)
  console.log(`Project   : ${PROJECT_NAME}`)
  console.log(`Location  : ${PROJECT_LOCATION}`)
  console.log(`Subtotal  : Rp${subtotal.toLocaleString('id-ID')}`)
  console.log(`PPN 11%   : Rp${taxAmount.toLocaleString('id-ID')}`)
  console.log(`Total     : Rp${totalAmount.toLocaleString('id-ID')}`)
  console.log('Status    : DRAFT')
  console.log(`Proposal ID: ${proposalId}`)
  console.log('')
  console.log('UAT jalur WON:')
  console.log('  1. DRAFT -> SENT')
  console.log('  2. SENT -> WON')
  console.log('  3. WON -> Project tanpa PO (HARUS REJECT)')
  console.log('  4. WON -> Customer PO (ALLOW)')
  console.log('  5. PO UNVERIFIED -> Project (HARUS REJECT)')
  console.log('  6. PO VERIFIED -> Project (ALLOW)')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
