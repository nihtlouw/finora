import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const ownerEmails = String(process.env.FINORA_OWNER_EMAILS || '')
  .split(/[;,]/)
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean)

if (!ownerEmails.length) throw new Error('FINORA_OWNER_EMAILS belum dikonfigurasi.')

const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 })
const prisma = new PrismaClient({ adapter })

const money = (n: number) => n.toFixed(2)
const date = (value: string) => new Date(`${value}T00:00:00.000Z`)
const round = (n: number) => Math.round(n)
const textBytes = (content: string) => Buffer.from(content, 'utf8')

const executionFoundation = [
  ['MOBILIZATION', 'Mobilisasi'],
  ['PROCUREMENT', 'Procurement'],
  ['FAT', 'Factory Acceptance Test (FAT)'],
  ['DELIVERY', 'Delivery Onsite'],
  ['INSTALLATION', 'Installation'],
  ['TESTING', 'Testing'],
  ['COMMISSIONING', 'Commissioning'],
  ['BAP_BAST', 'BAP / BAST'],
  ['CLOSEOUT', 'Closeout'],
] as const

type Item = {
  category: string
  description: string
  brand?: string
  itemType?: string
  specification?: string
  qty: number
  unit: string
  unitPrice: number
}

type Section = {
  code: string
  name: string
  description: string
  items: Item[]
}

type PaymentStage = {
  sequence: number
  name: string
  percentage: number
  triggerCode: string
  triggerDescription: string
  dueDays?: number
  retentionMonths?: number
  retentionPercent?: number
  conditions?: Array<{
    label: string
    executionCode?: string
    documentCategory?: string
    conditionType: string
  }>
}

type Scenario = {
  key: string
  sourceType: string
  client: {
    name: string
    category: string
    offerings: string
    email: string
    phone?: string
    picName?: string
    address: string
  }
  vendor: {
    name: string
    category: string
    offerings: string
  }
  proposalNumber: string
  quotationReference: string
  proposalDate: string
  projectCode: string
  projectName: string
  location: string
  contractValue: number
  revenueBasisValue: number
  taxAmount: number
  taxIncluded: boolean
  overhead: number
  rounding: number
  roundedTotal: number
  proposalStatus: string
  poNumber: string
  poDate: string
  projectStatus: string
  notes: string
  sections: Section[]
  paymentStages: PaymentStage[]
}

const scenarios: Scenario[] = [
  {
    key: 'RSPAD-ONGOING',
    sourceType: 'SOURCE_QUOTATION_RSPAD',
    client: {
      name: 'PT.KLIK UTAMA SYSTEM',
      category: 'KONTRAKTOR',
      offerings: 'Project engineering, electrical system, construction and infrastructure',
      email: 'procurement@klikutama.example.invalid',
      picName: 'PIC Procurement RSPAD',
      address: 'Jakarta Pusat, DKI Jakarta',
    },
    vendor: {
      name: 'PT Cipta Material Engineering',
      category: 'ELECTRICAL SUPPLIER',
      offerings: 'Panel, transformer, cable, electrical accessories',
    },
    proposalNumber: 'PR-UAT-RSPAD-2026-ONGOING',
    quotationReference: 'EST/KUS/0003-AE-07-2026',
    proposalDate: '2026-07-20',
    projectCode: 'FIN-UAT-RSPAD-ONGOING-2026',
    projectName: 'GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD',
    location: 'Jakarta Pusat',
    contractValue: 3405280000,
    revenueBasisValue: 3405280000,
    taxAmount: 0,
    taxIncluded: false,
    overhead: 66770120,
    rounding: 3880,
    roundedTotal: 3405280000,
    proposalStatus: 'WON',
    poNumber: 'PO-UAT-RSPAD-2026-001',
    poDate: '2026-08-18',
    projectStatus: 'ACTIVE',
    notes: 'UAT source-based scenario from the supplied RSPAD quotation. The commercial snapshot follows the source summary; the item detail is an executable UAT reconstruction, not a claim that the entire original BOQ was copied verbatim.',
    sections: [
      {
        code: 'A',
        name: 'MOBILISASI & DEMOBILISASI',
        description: 'Persiapan site, temporary facilities, safety, logistics, documentation and testing support.',
        items: [
          { category: 'SERVICE', description: 'Site survey, engineering check and mobilization', qty: 1, unit: 'LOT', unitPrice: 24500000 },
          { category: 'SERVICE', description: 'Temporary office, workshop, warehouse, utilities', qty: 1, unit: 'LOT', unitPrice: 24850000 },
          { category: 'SERVICE', description: 'Safety, APD, scaffolding and temporary power', qty: 1, unit: 'LOT', unitPrice: 30000000 },
          { category: 'SERVICE', description: 'Documentation, as-built drawing and test report', qty: 1, unit: 'LOT', unitPrice: 40000000 },
          { category: 'SERVICE', description: 'SLO / NIDI, electrical compliance and closeout preparation', qty: 1, unit: 'LOT', unitPrice: 55399000 },
        ],
      },
      {
        code: 'B',
        name: 'PANEL, TRAFO, LVMDP & JASA INSTALASI',
        description: 'Major electrical equipment, panel, transformer, capacitor bank and installation.',
        items: [
          { category: 'MATERIAL', description: 'Panel Cubicle TM 24kV', brand: 'Schneider', itemType: 'F-SM6R', specification: '24kV, 630A, IK 16kA-1 sec', qty: 1, unit: 'CUBICLE', unitPrice: 54600000 },
          { category: 'MATERIAL', description: 'SF6 GCB Circuit Breaker', brand: 'Schneider', itemType: 'F-SM6R-DM1A', specification: '24kV, 630A', qty: 1, unit: 'CUBICLE', unitPrice: 290325000 },
          { category: 'MATERIAL', description: 'Transformer Distribusi 1000kVA', brand: 'B&D Trafindo', itemType: 'Indoor', specification: '20kV/400V, ONAN, Dyn-5', qty: 1, unit: 'UNIT', unitPrice: 415500000 },
          { category: 'MATERIAL', description: 'LVMDP Panel Utama', brand: 'Schneider', itemType: 'MVS16H3MF2A', specification: 'ACB 4P 1600A', qty: 1, unit: 'CELL', unitPrice: 194177500 },
          { category: 'MATERIAL', description: 'Capacitor Bank 400kVAR', brand: 'Himel / Zez Silko', itemType: '12 Step', specification: 'APFC', qty: 1, unit: 'CELL', unitPrice: 159498700 },
          { category: 'SERVICE', description: 'Installation, setting and commissioning of panels and transformer', qty: 1, unit: 'LOT', unitPrice: 235499800 },
        ],
      },
      {
        code: 'C',
        name: 'PENGADAAN KABEL & JASA INSTALASI',
        description: 'Power cable, tray, pulling, termination and installation.',
        items: [
          { category: 'MATERIAL', description: 'Power cable package floors 1–7', brand: 'Sutrado/KMI', itemType: 'NYY', specification: 'Multi-size feeder package', qty: 1, unit: 'LOT', unitPrice: 660000000 },
          { category: 'MATERIAL', description: 'Genset and transformer feeder cable package', brand: 'Sutrado/KMI', itemType: 'NYY/NYYHY', specification: 'Multi-core power cable', qty: 1, unit: 'LOT', unitPrice: 470000000 },
          { category: 'MATERIAL', description: 'Ladder tray and supporting accessories', brand: 'Lokal', itemType: 'Galvanized', specification: 'Tray + cover + jointing', qty: 1, unit: 'LOT', unitPrice: 95000000 },
          { category: 'SERVICE', description: 'Cable pulling, termination and tray installation', qty: 1, unit: 'LOT', unitPrice: 250000000 },
        ],
      },
      {
        code: 'D',
        name: 'GROUNDING SYSTEM & JASA INSTALASI',
        description: 'Grounding rods, BC cable, accessories and resistance measurement.',
        items: [
          { category: 'MATERIAL', description: 'Grounding rod and accessories package', qty: 1, unit: 'LOT', unitPrice: 90000000 },
          { category: 'MATERIAL', description: 'BC cable, busbar and grounding boxes', qty: 1, unit: 'LOT', unitPrice: 100000000 },
          { category: 'SERVICE', description: 'Grounding installation, pulling, termination and testing', qty: 1, unit: 'LOT', unitPrice: 149156000 },
        ],
      },
    ],
    paymentStages: [
      {
        sequence: 1,
        name: 'DP 50% setelah PO/SPK',
        percentage: 50,
        triggerCode: 'PO_RELEASED',
        triggerDescription: 'DP 50% setelah PO/SPK terbit.',
        dueDays: 7,
      },
      {
        sequence: 2,
        name: 'Progress 45% setelah FAT dan material sebelum delivery onsite',
        percentage: 45,
        triggerCode: 'FAT_AND_PRE_DELIVERY',
        triggerDescription: 'Progress 45% setelah FAT dan material sebelum delivery onsite.',
        conditions: [
          { label: 'FAT completed', executionCode: 'FAT', conditionType: 'EXECUTION' },
          { label: 'FAT evidence', documentCategory: 'FAT', conditionType: 'DOCUMENT' },
        ],
      },
      {
        sequence: 3,
        name: 'Retention 5% setelah masa retensi 2 bulan',
        percentage: 5,
        triggerCode: 'RETENTION_END',
        triggerDescription: 'Retention 5% setelah masa retensi 2 bulan dan BAP/BAST.',
        retentionMonths: 2,
        retentionPercent: 5,
        conditions: [
          { label: 'BAP / BAST completed', executionCode: 'BAP_BAST', conditionType: 'EXECUTION' },
          { label: 'BAP / BAST evidence', documentCategory: 'BAP_BAST', conditionType: 'DOCUMENT' },
        ],
      },
    ],
  },
  {
    key: 'SS3-COMPLETED',
    sourceType: 'SOURCE_PO_KABEL_POWER_SS3',
    client: {
      name: 'PT HURIP UTAMA',
      category: 'KONTRAKTOR',
      offerings: 'Power cable installation and electrical termination services',
      email: 'procurement@huriputama.example.invalid',
      address: 'Kawasan Industri Kujang Cikampek, Dawuan Tengah, Karawang, Jawa Barat',
    },
    vendor: {
      name: 'PT Berjaya Sukses Makmur',
      category: 'SYSTEM INTEGRATOR',
      offerings: 'Electrical engineering, cable installation, panel and termination services',
    },
    proposalNumber: 'PR-UAT-HU-SS3-2026-001',
    quotationReference: '0072/PH-BSM/HU/VIII/2026',
    proposalDate: '2026-08-10',
    projectCode: 'FIN-UAT-SS3-COMPLETED-2026',
    projectName: 'Jasa Terminasi Penarikan Kabel Power SS3 ke NPK-2',
    location: 'NPK-2',
    contractValue: 31500000,
    revenueBasisValue: 28377500,
    taxAmount: 3121525,
    taxIncluded: true,
    overhead: 0,
    rounding: 0,
    roundedTotal: 31500000,
    proposalStatus: 'WON',
    poNumber: '00077/PO/HU/VIII/2026',
    poDate: '2026-08-10',
    projectStatus: 'CLOSED',
    notes: 'UAT source-based scenario from the supplied customer PO. The source PO states material Rp22,000,000, service Rp6,377,500, PPN 11% Rp3,121,525, grand total Rp31,500,000, 50% DP and 50% final after work completion with BAP.',
    sections: [
      {
        code: 'SS3',
        name: 'TERMINASI PENARIKAN KABEL POWER',
        description: 'Material and cable termination service to NPK-2.',
        items: [
          { category: 'MATERIAL', description: 'Material electrical package', qty: 1, unit: 'LOT', unitPrice: 22000000 },
          { category: 'SERVICE', description: 'Jasa terminasi penarikan kabel power SS3 ke NPK-2', qty: 1, unit: 'LOT', unitPrice: 6377500 },
        ],
      },
    ],
    paymentStages: [
      {
        sequence: 1,
        name: 'DP 50% setelah PO terbit',
        percentage: 50,
        triggerCode: 'PO_RELEASED',
        triggerDescription: 'DP 50% dari PO terbit; pembayaran 7 hari setelah invoice masuk.',
        dueDays: 7,
      },
      {
        sequence: 2,
        name: 'Pelunasan 50% setelah pekerjaan selesai + BAP',
        percentage: 50,
        triggerCode: 'BAP_COMPLETED',
        triggerDescription: 'Pelunasan 50% setelah pekerjaan selesai dengan BAP.',
        conditions: [
          { label: 'BAP / BAST completed', executionCode: 'BAP_BAST', conditionType: 'EXECUTION' },
          { label: 'BAP / BAST evidence', documentCategory: 'BAP_BAST', conditionType: 'DOCUMENT' },
        ],
      },
    ],
  },
  {
    key: 'CIKARANG-STALLED',
    sourceType: 'SYNTHETIC_ENGINEERING_CASE',
    client: {
      name: 'PT Nusantara Properti Sentosa',
      category: 'PROPERTY / INDUSTRIAL',
      offerings: 'Industrial facilities and property management',
      email: 'procurement@nusantaraproperti.example.invalid',
      phone: '+62 21 555 2600',
      picName: 'Andi Pratama',
      address: 'Kawasan Industri Jababeka, Cikarang, Jawa Barat',
    },
    vendor: {
      name: 'PT Cipta Material Engineering',
      category: 'ELECTRICAL SUPPLIER',
      offerings: 'Panel listrik, ATS, protection devices, cable and electrical material',
    },
    proposalNumber: 'PR-UAT-CIKARANG-STALLED-2026',
    quotationReference: 'QTN/UAT/FINORA/IX/2026',
    proposalDate: '2026-09-01',
    projectCode: 'FIN-UAT-CIKARANG-STALLED-2026',
    projectName: 'Upgrade Panel Listrik & Backup Power — Cikarang',
    location: 'Cikarang, Jawa Barat',
    contractValue: 438450000,
    revenueBasisValue: 395000000,
    taxAmount: 43450000,
    taxIncluded: true,
    overhead: 0,
    rounding: 0,
    roundedTotal: 438450000,
    proposalStatus: 'WON',
    poNumber: 'PO-UAT-CIKARANG-2026-001',
    poDate: '2026-09-05',
    projectStatus: 'ON_HOLD',
    notes: 'Synthetic scenario based on common industrial electrical retrofit workflow patterns. This is not a copy of the supplied customer documents. It intentionally represents a project stalled after mobilization/procurement because long-lead material and site shutdown access are not confirmed.',
    sections: [
      {
        code: 'A',
        name: 'MATERIAL PANEL & ATS',
        description: 'Panel LVMDP retrofit, ATS-genset, busbar and power accessories.',
        items: [
          { category: 'MATERIAL', description: 'Panel LVMDP Retrofit 1600A', brand: 'Schneider', itemType: 'MVS / Equivalent', specification: 'ACB 4P 1600A', qty: 1, unit: 'SET', unitPrice: 145000000 },
          { category: 'MATERIAL', description: 'Automatic Transfer Switch 1600A', brand: 'Schneider', itemType: 'ATS', specification: '4P PLN-Genset interlock', qty: 1, unit: 'SET', unitPrice: 78000000 },
          { category: 'MATERIAL', description: 'Busbar and power accessories', qty: 1, unit: 'LOT', unitPrice: 22000000 },
        ],
      },
      {
        code: 'B',
        name: 'INSTALLATION, INTEGRATION & COMMISSIONING',
        description: 'Dismantling existing panel, installation, wiring, testing and commissioning.',
        items: [
          { category: 'SERVICE', description: 'Dismantling and re-arrangement panel existing', qty: 1, unit: 'LOT', unitPrice: 18000000 },
          { category: 'SERVICE', description: 'Install panel retrofit and ATS', qty: 1, unit: 'LOT', unitPrice: 32000000 },
          { category: 'SERVICE', description: 'Control wiring and genset integration', qty: 1, unit: 'LOT', unitPrice: 24000000 },
          { category: 'SERVICE', description: 'Testing, commissioning and as-built', qty: 1, unit: 'LOT', unitPrice: 14000000 },
        ],
      },
    ],
    paymentStages: [
      {
        sequence: 1,
        name: 'DP 30% setelah PO/SPK',
        percentage: 30,
        triggerCode: 'PO_RELEASED',
        triggerDescription: 'DP 30% setelah PO/SPK terbit.',
        dueDays: 7,
      },
      {
        sequence: 2,
        name: 'Progress 60% setelah FAT + material siap',
        percentage: 60,
        triggerCode: 'FAT_AND_MATERIAL_READY',
        triggerDescription: '60% setelah FAT dan material long-lead siap untuk delivery.',
        conditions: [
          { label: 'Procurement completed', executionCode: 'PROCUREMENT', conditionType: 'EXECUTION' },
          { label: 'FAT completed', executionCode: 'FAT', conditionType: 'EXECUTION' },
          { label: 'FAT evidence', documentCategory: 'FAT', conditionType: 'DOCUMENT' },
        ],
      },
      {
        sequence: 3,
        name: 'Retention 10% setelah handover',
        percentage: 10,
        triggerCode: 'RETENTION_END',
        triggerDescription: 'Retensi 10% setelah handover dan masa retensi.',
        retentionMonths: 1,
        retentionPercent: 10,
        conditions: [
          { label: 'BAP / BAST completed', executionCode: 'BAP_BAST', conditionType: 'EXECUTION' },
          { label: 'BAP / BAST evidence', documentCategory: 'BAP_BAST', conditionType: 'DOCUMENT' },
        ],
      },
    ],
  },
]

async function ownerContext() {
  const owner = await prisma.user.findFirst({
    where: { email: { in: ownerEmails } },
    orderBy: { createdAt: 'asc' },
  })
  if (!owner) throw new Error('Owner tidak ditemukan.')
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: owner.id, role: 'OWNER' },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!membership) throw new Error('Workspace OWNER tidak ditemukan.')
  return { owner, workspace: membership.workspace }
}

function sourceSnapshot(s: Scenario) {
  const subtotal = s.sections.flatMap((x) => x.items).reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  return {
    subtotal,
    commercialNote:
      s.key === 'RSPAD-ONGOING'
        ? 'Source snapshot: subtotal Rp3.338.506.000 + overhead Rp66.770.120 + rounding Rp3.880 = rounded Rp3.405.280.000. PPN not included.'
        : s.key === 'SS3-COMPLETED'
          ? 'Source snapshot: material Rp22.000.000 + service Rp6.377.500 = subtotal Rp28.377.500; PPN 11% Rp3.121.525; grand total Rp31.500.000, tax included.'
          : 'Synthetic UAT commercial case; not a supplied customer document.',
  }
}

async function ensureClient(workspaceId: string, data: Scenario['client']) {
  const existing = await prisma.clientVendor.findFirst({
    where: { workspaceId, name: data.name, type: 'CLIENT' },
  })
  if (existing) {
    return prisma.clientVendor.update({
      where: { id: existing.id },
      data: {
        category: data.category,
        offerings: data.offerings,
        email: data.email,
        phone: data.phone ?? null,
        picName: data.picName ?? null,
        address: data.address,
        isActive: true,
      },
    })
  }
  return prisma.clientVendor.create({
    data: {
      workspaceId,
      name: data.name,
      type: 'CLIENT',
      category: data.category,
      offerings: data.offerings,
      email: data.email,
      phone: data.phone ?? null,
      picName: data.picName ?? null,
      address: data.address,
      isActive: true,
    },
  })
}

async function ensureVendor(workspaceId: string, data: Scenario['vendor']) {
  const existing = await prisma.clientVendor.findFirst({ where: { workspaceId, name: data.name, type: 'VENDOR' } })
  if (existing) return existing
  return prisma.clientVendor.create({
    data: {
      workspaceId,
      name: data.name,
      type: 'VENDOR',
      category: data.category,
      offerings: data.offerings,
      isActive: true,
    },
  })
}

async function ensureProposal(workspaceId: string, ownerId: string, scenario: Scenario, clientId: string) {
  const existing = await prisma.proposal.findUnique({ where: { proposalNumber: scenario.proposalNumber } })
  if (existing) {
    if (existing.clientId !== clientId) throw new Error(`Proposal ${scenario.proposalNumber} terhubung ke client yang berbeda.`)
    if (existing.status !== scenario.proposalStatus) {
      await prisma.proposal.update({ where: { id: existing.id }, data: { status: scenario.proposalStatus } })
    }
    return existing
  }

  const snapshot = sourceSnapshot(scenario)
  const row = await prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.create({
      data: {
        clientId,
        proposalNumber: scenario.proposalNumber,
        quotationReference: scenario.quotationReference,
        projectName: scenario.projectName,
        projectLocation: scenario.location,
        scopeSummary: scenario.sections.map((x) => x.name).join('; '),
        status: scenario.proposalStatus,
        subtotalAmount: money(scenario.key === 'RSPAD-ONGOING' ? 3338506000 : scenario.key === 'SS3-COMPLETED' ? 28377500 : 395000000),
        discountPercent: '0',
        discountAmount: '0',
        taxPercent: scenario.taxAmount > 0 ? '11' : '0',
        taxAmount: money(scenario.taxAmount),
        totalAmount: money(scenario.roundedTotal),
        currency: 'IDR',
        taxIncluded: scenario.taxIncluded,
        overheadAmount: money(scenario.overhead),
        roundingAmount: money(scenario.rounding),
        roundedTotalAmount: money(scenario.roundedTotal),
        pricingMode: 'COMMERCIAL_SNAPSHOT',
        commercialNotes: `${scenario.notes} ${snapshot.commercialNote}`,
        termsAndConditions: [
          scenario.key === 'RSPAD-ONGOING' ? 'PPN 11% belum termasuk.' : 'PPN 11% termasuk dalam grand total.',
          ...scenario.paymentStages.map((x) => x.name),
          'Scenario dibuat untuk UAT full deployment.',
        ].join('\n'),
        validUntil: date(scenario.proposalDate),
      },
    })

    for (let s = 0; s < scenario.sections.length; s += 1) {
      const section = scenario.sections[s]
      const createdSection = await tx.proposalSection.create({
        data: {
          proposalId: proposal.id,
          code: section.code,
          name: section.name,
          description: section.description,
          sortOrder: s,
        },
      })
      for (const item of section.items) {
        await tx.proposalItem.create({
          data: {
            proposalId: proposal.id,
            sectionId: createdSection.id,
            description: item.description,
            category: item.category,
            brand: item.brand ?? null,
            itemType: item.itemType ?? null,
            specification: item.specification ?? null,
            qty: item.qty,
            unit: item.unit,
            unitPrice: money(item.unitPrice),
          },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: ownerId,
        action: 'CREATE_UAT_THREE_PROJECTS',
        entityType: 'PROPOSAL',
        entityId: proposal.id,
        metadata: { scenario: scenario.key, sourceType: scenario.sourceType, proposalNumber: scenario.proposalNumber },
      },
    })

    return proposal
  })

  return row
}

async function ensurePO(workspaceId: string, ownerId: string, scenario: Scenario, clientId: string, proposalId: string) {
  const existing = await prisma.customerPO.findFirst({ where: { workspaceId, poNumber: scenario.poNumber } })
  if (existing) {
    if (existing.clientId !== clientId || existing.quotationId !== proposalId) throw new Error(`PO ${scenario.poNumber} relasinya tidak cocok.`)
    if (existing.status !== 'VERIFIED') {
      return prisma.customerPO.update({
        where: { id: existing.id },
        data: { status: 'VERIFIED', verifiedAt: existing.verifiedAt ?? new Date(), verifiedByUserId: existing.verifiedByUserId ?? ownerId },
      })
    }
    return existing
  }

  return prisma.customerPO.create({
    data: {
      workspaceId,
      clientId,
      quotationId: proposalId,
      poNumber: scenario.poNumber,
      poDate: date(scenario.poDate),
      receivedDate: date(scenario.poDate),
      reference: scenario.quotationReference,
      status: 'VERIFIED',
      totalAmount: money(scenario.roundedTotal - scenario.taxAmount),
      taxAmount: money(scenario.taxAmount),
      grandTotal: money(scenario.contractValue),
      currency: 'IDR',
      taxIncluded: scenario.taxIncluded,
      overheadAmount: money(scenario.overhead),
      roundingAmount: money(scenario.rounding),
      roundedGrandTotal: money(scenario.roundedTotal),
      pricingMode: 'COMMERCIAL_SNAPSHOT',
      paymentTermsSnapshot: {
        stages: scenario.paymentStages.map((x) => ({
          sequence: x.sequence,
          name: x.name,
          percentage: x.percentage,
          triggerCode: x.triggerCode,
          triggerDescription: x.triggerDescription,
          dueDays: x.dueDays ?? null,
          retentionMonths: x.retentionMonths ?? null,
          retentionPercent: x.retentionPercent ?? null,
        })),
      },
      quotationSubtotalSnapshot: money(scenario.key === 'RSPAD-ONGOING' ? 3338506000 : scenario.key === 'SS3-COMPLETED' ? 28377500 : 395000000),
      quotationTaxSnapshot: money(scenario.taxAmount),
      quotationGrandTotalSnapshot: money(scenario.roundedTotal),
      commercialVarianceAmount: '0',
      commercialVarianceReason: null,
      verifiedAt: new Date(),
      verifiedByUserId: ownerId,
      remarks: scenario.notes,
    },
  })
}

async function ensureExecutionFoundation(projectId: string, proposalId: string, poId: string) {
  const sectionCount = await prisma.projectBOQSection.count({ where: { projectId } })
  if (sectionCount === 0) {
    const { snapshotProposalBOQ } = await import('../lib/project-execution.ts')
    await prisma.$transaction(async (tx) => snapshotProposalBOQ(tx, projectId, proposalId))
  }
  const executionCount = await prisma.projectExecutionMilestone.count({ where: { projectId } })
  if (executionCount === 0) {
    const { createProjectExecutionFoundation } = await import('../lib/project-execution.ts')
    await prisma.$transaction(async (tx) => createProjectExecutionFoundation(tx, projectId))
  }
  const versionCount = await prisma.projectContractVersion.count({ where: { projectId } })
  if (versionCount === 0) {
    await prisma.projectContractVersion.create({
      data: {
        projectId,
        versionNumber: 1,
        sourceType: 'CUSTOMER_PO',
        sourceId: poId,
        effectiveDate: new Date(),
        contractValue: money((await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { contractValue: true } })).contractValue as any),
        notes: 'Initial UAT contract snapshot from Customer PO.',
      },
    })
  }
}

async function ensureBillingAndPayment(workspaceId: string, scenario: Scenario, projectId: string, mode: 'ONGOING' | 'COMPLETED' | 'STALLED') {
  const existing = await prisma.billingMilestone.count({ where: { projectId } })
  if (existing > 0) return

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { contractValue: true } })
  const contractValue = Number(project.contractValue)

  for (const stage of scenario.paymentStages) {
    const amount = contractValue * stage.percentage / 100
    const billing = await prisma.billingMilestone.create({
      data: {
        projectId,
        sequence: stage.sequence,
        name: stage.name,
        percentage: money(stage.percentage),
        amount: money(amount),
        status: 'PLANNED',
        triggerCode: stage.triggerCode,
        triggerDescription: stage.triggerDescription,
        plannedDate: date(scenario.poDate),
      },
    })

    for (const condition of stage.conditions ?? []) {
      const em = condition.executionCode
        ? await prisma.projectExecutionMilestone.findFirst({ where: { projectId, code: condition.executionCode } })
        : null
      await prisma.billingMilestoneCondition.create({
        data: {
          billingMilestoneId: billing.id,
          executionMilestoneId: em?.id ?? null,
          requiredDocumentCategory: condition.documentCategory ?? null,
          label: condition.label,
          conditionType: condition.conditionType,
          required: true,
        },
      })
    }

    await prisma.paymentMilestone.create({
      data: {
        projectId,
        billingMilestoneId: billing.id,
        sequence: stage.sequence,
        name: stage.name,
        percentage: money(stage.percentage),
        amount: money(amount),
        status: 'PLANNED',
        triggerCode: stage.triggerCode,
        dueDays: stage.dueDays ?? null,
        retentionMonths: stage.retentionMonths ?? null,
        retentionPercent: stage.retentionPercent ?? null,
        conditionNotes: stage.triggerDescription,
      },
    })
  }
}

async function addDocument(workspaceId: string, ownerId: string, projectId: string, key: string, category: string, title: string, documentDate: string) {
  const existing = await prisma.projectDocument.findFirst({ where: { projectId, documentKey: key, version: 1 } })
  if (existing) return existing
  return prisma.projectDocument.create({
    data: {
      workspaceId,
      projectId,
      title,
      category,
      documentKey: key,
      version: 1,
      documentDate: date(documentDate),
      tags: { uat: true, source: 'three-projects' },
      source: 'UAT fixture',
      isCurrent: true,
      fileName: `${key}.txt`,
      mimeType: 'text/plain',
      sizeBytes: 200,
      data: textBytes(`FINORA UAT EVIDENCE\n${title}\nScenario: ${key}\n`),
      uploadedById: ownerId,
    },
  })
}

async function addExpense(workspaceId: string, ownerId: string, vendorId: string, projectId: string, key: string, amount: number, category: string, status: 'PENDING' | 'APPROVED', paid: boolean, expenseDate: string, description: string) {
  const existing = await prisma.expense.findFirst({ where: { workspaceId, description } })
  if (existing) return existing
  const expense = await prisma.expense.create({
    data: {
      workspaceId,
      vendorId,
      projectId,
      payeeName: null,
      category,
      allocationType: 'DIRECT',
      description,
      paymentMethod: paid ? 'BANK_TRANSFER' : 'BANK_TRANSFER',
      settlementStatus: paid ? 'PAID' : 'UNPAID',
      paidAt: paid ? date(expenseDate) : null,
      paidBy: paid ? ownerId : null,
      amount: money(amount),
      expenseDate: date(expenseDate),
      status,
      receiptUrl: null,
    },
  })

  await prisma.expenseItem.create({
    data: {
      expenseId: expense.id,
      description: description,
      quantity: '1',
      unit: 'LOT',
      unitPrice: money(amount),
      totalAmount: money(amount),
    },
  })

  await prisma.expenseAllocation.create({
    data: {
      expenseId: expense.id,
      projectId,
      percentage: '100',
      amount: money(amount),
      note: 'UAT direct project cost',
    },
  })

  if (paid) {
    await prisma.cashflowTransaction.create({
      data: {
        workspaceId,
        type: 'EXPENSE',
        category,
        amount: money(amount),
        transactionDate: date(expenseDate),
        sourceRef: key,
        expenseId: expense.id,
      },
    })
  }

  return expense
}

async function addInvoiceWithPayment(
  workspaceId: string,
  ownerId: string,
  clientId: string,
  projectId: string,
  billingMilestoneId: string,
  invoiceNumber: string,
  amount: number,
  status: 'PAID' | 'PARTIAL',
  paidAmount: number,
  dueDate: string,
) {
  const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } })
  if (existing) return existing

  await prisma.billingMilestone.update({
    where: { id: billingMilestoneId },
    data: { status: 'BILLED' },
  })

  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      projectId,
      billingMilestoneId,
      invoiceNumber,
      status,
      projectName: undefined,
      dueDate: date(dueDate),
      subtotalAmount: money(amount),
      discountPercent: '0',
      discountAmount: '0',
      taxPercent: '0',
      taxAmount: '0',
      totalAmount: money(amount),
      termsAndConditions: 'UAT fixture: amount follows billing milestone canonical amount.',
      items: {
        create: [{
          description: 'Billing milestone UAT',
          category: 'SERVICE',
          qty: 1,
          unit: 'LOT',
          unitPrice: money(amount),
        }],
      },
    },
  })

  if (paidAmount > 0) {
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: money(paidAmount),
        paymentDate: date(dueDate),
        method: 'BANK_TRANSFER',
      },
    })
    await prisma.cashflowTransaction.create({
      data: {
        workspaceId,
        type: 'INCOME',
        category: 'Payment',
        amount: money(paidAmount),
        transactionDate: date(dueDate),
        sourceRef: invoiceNumber,
        paymentId: payment.id,
      },
    })
  }

  await prisma.billingMilestone.update({
    where: { id: billingMilestoneId },
    data: { status: paidAmount >= amount ? 'PAID' : 'BILLED' },
  })

  return invoice
}

async function addChangeOrder(workspaceId: string, ownerId: string, projectId: string) {
  const exists = await prisma.contractChangeOrder.findFirst({ where: { workspaceId, projectId, changeNumber: 'CO-UAT-001' } })
  if (exists) return exists
  return prisma.contractChangeOrder.create({
    data: {
      workspaceId,
      projectId,
      changeNumber: 'CO-UAT-001',
      status: 'SUBMITTED',
      requestedAmount: money(55000000),
      approvedAmount: '0',
      changeType: 'INCREASE',
      effectiveDate: date('2026-09-15'),
      reason: 'Customer requested additional feeder and panel labeling, but shutdown window and technical approval are still pending.',
      notes: 'UAT stalled scenario: change order must not alter contract/billing until approved and explicitly rebaselined.',
      requestedByUserId: ownerId,
    },
  })
}

async function applyScenarioState(workspaceId: string, ownerId: string, vendorId: string, scenario: Scenario, projectId: string) {
  const mode = scenario.key === 'RSPAD-ONGOING' ? 'ONGOING' : scenario.key === 'SS3-COMPLETED' ? 'COMPLETED' : 'STALLED'

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { executionMilestones: true, billingMilestones: { orderBy: { sequence: 'asc' } }, paymentMilestones: { orderBy: { sequence: 'asc' } } },
  })

  const em = Object.fromEntries(project.executionMilestones.map((x) => [x.code, x]))
  const mark = async (code: string, status: string, progress: number, notes: string) => {
    const row = em[code]
    if (!row) return
    await prisma.projectExecutionMilestone.update({
      where: { id: row.id },
      data: { status, progressPct: money(progress), actualDate: status === 'COMPLETED' ? new Date() : row.actualDate, notes },
    })
  }

  if (mode === 'ONGOING') {
    await mark('MOBILIZATION', 'COMPLETED', 100, 'Site mobilization completed.')
    await mark('PROCUREMENT', 'COMPLETED', 100, 'Major electrical material received in warehouse.')
    await mark('FAT', 'COMPLETED', 100, 'FAT completed and approved for site delivery.')
    await mark('DELIVERY', 'IN_PROGRESS', 80, 'Partial delivery completed; remaining cable drums scheduled.')
    await mark('INSTALLATION', 'IN_PROGRESS', 55, 'Cable pulling and panel installation in progress.')
    await addDocument(workspaceId, ownerId, projectId, 'RSPAD-FAT-001', 'FAT', 'FAT Report — Panel TM / Trafo', '2026-09-05')
    await addDocument(workspaceId, ownerId, projectId, 'RSPAD-DELIVERY-001', 'DELIVERY', 'Delivery Note — Phase 1 Material', '2026-09-08')

    if (project.billingMilestones[0]) {
      await addInvoiceWithPayment(workspaceId, ownerId, scenario.client.name ? project.clientId : project.clientId, projectId, project.billingMilestones[0].id, 'INV-UAT-RSPAD-001', Number(project.billingMilestones[0].amount), 'PAID', Number(project.billingMilestones[0].amount), '2026-08-28')
      await prisma.paymentMilestone.update({ where: { id: project.paymentMilestones[0].id }, data: { status: 'PAID' } })
    }
    if (project.billingMilestones[1]) {
      await addInvoiceWithPayment(workspaceId, ownerId, project.clientId, projectId, project.billingMilestones[1].id, 'INV-UAT-RSPAD-002', Number(project.billingMilestones[1].amount), 'PARTIAL', 1000000000, '2026-09-15')
      await prisma.paymentMilestone.update({ where: { id: project.paymentMilestones[1].id }, data: { status: 'PARTIAL' } })
    }

    await addExpense(workspaceId, ownerId, vendorId, projectId, 'RSPAD-EXP-MATERIAL', 1650000000, 'MATERIAL', 'APPROVED', true, '2026-09-06', '[UAT][RSPAD] Major electrical material procurement')
    await addExpense(workspaceId, ownerId, vendorId, projectId, 'RSPAD-EXP-SUBCON', 350000000, 'SUBCON', 'APPROVED', true, '2026-09-08', '[UAT][RSPAD] Installation subcontractor progress')
    await addExpense(workspaceId, ownerId, vendorId, projectId, 'RSPAD-EXP-TRANSPORT', 120000000, 'TRANSPORT', 'APPROVED', true, '2026-09-09', '[UAT][RSPAD] Logistics and site delivery')
    await addExpense(workspaceId, ownerId, vendorId, projectId, 'RSPAD-EXP-SAFETY', 230000000, 'OPERASIONAL', 'APPROVED', true, '2026-09-10', '[UAT][RSPAD] Site safety and temporary facilities')
  }

  if (mode === 'COMPLETED') {
    for (const [code, label] of executionFoundation) {
      await mark(code, 'COMPLETED', 100, `${label} completed — final project state.`)
    }
    await addDocument(workspaceId, ownerId, projectId, 'SS3-DELIVERY-001', 'DELIVERY', 'Delivery / Work Completion Evidence', '2026-08-20')
    await addDocument(workspaceId, ownerId, projectId, 'SS3-TESTING-001', 'TESTING', 'Testing and Resistance Report', '2026-08-22')
    await addDocument(workspaceId, ownerId, projectId, 'SS3-BAP-001', 'BAP_BAST', 'BAP / BAST — Jasa Terminasi Kabel SS3', '2026-08-25')
    await addDocument(workspaceId, ownerId, projectId, 'SS3-CLOSEOUT-001', 'CLOSEOUT', 'Closeout Package', '2026-08-28')

    for (let i = 0; i < project.billingMilestones.length; i += 1) {
      const bm = project.billingMilestones[i]
      const inv = `INV-UAT-SS3-${String(i + 1).padStart(3, '0')}`
      await addInvoiceWithPayment(workspaceId, ownerId, project.clientId, projectId, bm.id, inv, Number(bm.amount), 'PAID', Number(bm.amount), i === 0 ? '2026-08-12' : '2026-08-28')
      await prisma.billingMilestone.update({ where: { id: bm.id }, data: { status: 'PAID' } })
      await prisma.paymentMilestone.update({ where: { id: project.paymentMilestones[i].id }, data: { status: 'PAID' } })
    }

    await addExpense(workspaceId, ownerId, vendorId, projectId, 'SS3-EXP-MATERIAL', 12500000, 'MATERIAL', 'APPROVED', true, '2026-08-12', '[UAT][SS3] Material electrical package')
    await addExpense(workspaceId, ownerId, vendorId, projectId, 'SS3-EXP-SERVICE', 3500000, 'SUBCON', 'APPROVED', true, '2026-08-20', '[UAT][SS3] Termination and site labor')
    await addExpense(workspaceId, ownerId, vendorId, projectId, 'SS3-EXP-LOGISTICS', 2000000, 'TRANSPORT', 'APPROVED', true, '2026-08-21', '[UAT][SS3] Logistics and site mobilization')
  }

  if (mode === 'STALLED') {
    await mark('MOBILIZATION', 'COMPLETED', 100, 'Site survey and mobilization completed.')
    await mark('PROCUREMENT', 'BLOCKED', 35, 'Blocked: long-lead ATS/panel material and site shutdown approval are not confirmed.')
    await mark('FAT', 'PLANNED', 0, 'Cannot schedule until long-lead material is available.')
    await mark('DELIVERY', 'PLANNED', 0, 'Waiting for procurement release.')
    await mark('INSTALLATION', 'PLANNED', 0, 'Waiting for delivery and shutdown window.')
    await mark('TESTING', 'PLANNED', 0, 'Waiting for installation.')
    await mark('COMMISSIONING', 'PLANNED', 0, 'Waiting for testing.')
    await mark('BAP_BAST', 'PLANNED', 0, 'Waiting for commissioning.')
    await mark('CLOSEOUT', 'PLANNED', 0, 'Waiting for project completion.')

    if (project.billingMilestones[0]) {
      await addInvoiceWithPayment(workspaceId, ownerId, project.clientId, projectId, project.billingMilestones[0].id, 'INV-UAT-CIKARANG-001', Number(project.billingMilestones[0].amount), 'PAID', Number(project.billingMilestones[0].amount), '2026-09-12')
      await prisma.billingMilestone.update({ where: { id: project.billingMilestones[0].id }, data: { status: 'PAID' } })
      await prisma.paymentMilestone.update({ where: { id: project.paymentMilestones[0].id }, data: { status: 'PAID' } })
    }

    await addExpense(workspaceId, ownerId, vendorId, projectId, 'CIK-EXP-DESIGN', 20000000, 'ENGINEERING', 'APPROVED', true, '2026-09-10', '[UAT][CIKARANG] Engineering and site survey cost')
    await addExpense(workspaceId, ownerId, vendorId, projectId, 'CIK-EXP-MATERIAL-PENDING', 35000000, 'MATERIAL', 'PENDING', false, '2026-09-18', '[UAT][CIKARANG] Long-lead material commitment pending approval')
    await addChangeOrder(workspaceId, ownerId, projectId)
  }
}

async function ensureProject(workspaceId: string, ownerId: string, scenario: Scenario, clientId: string, proposalId: string, poId: string) {
  const linkedProject = await prisma.project.findUnique({ where: { customerPoId: poId } })
  if (linkedProject && linkedProject.projectCode !== scenario.projectCode) {
    throw new Error(`PO ${scenario.poNumber} sudah terhubung ke project ${linkedProject.projectCode}; seed dihentikan agar tidak membuat duplicate project.`)
  }
  let project = await prisma.project.findFirst({ where: { workspaceId, projectCode: scenario.projectCode } })
  if (!project) {
    project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          workspaceId,
          clientId,
          proposalId,
          customerPoId: poId,
          projectCode: scenario.projectCode,
          projectName: scenario.projectName,
          location: scenario.location,
          startDate: scenario.key === 'SS3-COMPLETED' ? date('2026-08-11') : date(scenario.key === 'RSPAD-ONGOING' ? '2026-08-20' : '2026-09-06'),
          targetEndDate: scenario.key === 'SS3-COMPLETED' ? date('2026-08-28') : scenario.key === 'RSPAD-ONGOING' ? date('2026-12-20') : date('2026-10-30'),
          contractValue: money(scenario.contractValue),
          revenueBasisValue: money(scenario.revenueBasisValue),
          contractVersion: 1,
          status: scenario.projectStatus,
          notes: scenario.notes,
        },
      })
      const { snapshotProposalBOQ, createProjectExecutionFoundation } = await import('../lib/project-execution.ts')
      await snapshotProposalBOQ(tx, created.id, proposalId)
      await createProjectExecutionFoundation(tx, created.id)
      await tx.projectContractVersion.create({
        data: {
          projectId: created.id,
          versionNumber: 1,
          sourceType: 'CUSTOMER_PO',
          sourceId: poId,
          effectiveDate: date(scenario.poDate),
          contractValue: money(scenario.contractValue),
          notes: 'Initial UAT contract snapshot from customer PO.',
        },
      })
      return created
    })
  }
  return project
}

async function main() {
  const { owner, workspace } = await ownerContext()
  console.log(`Workspace: ${workspace.name}`)

  for (const scenario of scenarios) {
    console.log(`\n=== ${scenario.key} ===`)
    const client = await ensureClient(workspace.id, scenario.client)
    const vendor = await ensureVendor(workspace.id, scenario.vendor)
    const proposal = await ensureProposal(workspace.id, owner.id, scenario, client.id)
    const po = await ensurePO(workspace.id, owner.id, scenario, client.id, proposal.id)
    const project = await ensureProject(workspace.id, owner.id, scenario, client.id, proposal.id, po.id)
    await ensureExecutionFoundation(project.id, proposal.id, po.id)

    const count = await prisma.billingMilestone.count({ where: { projectId: project.id } })
    if (count === 0) await ensureBillingAndPayment(workspace.id, scenario, project.id, scenario.key === 'RSPAD-ONGOING' ? 'ONGOING' : scenario.key === 'SS3-COMPLETED' ? 'COMPLETED' : 'STALLED')

    // Reassert final scenario status without modifying unrelated project data.
    await prisma.project.update({ where: { id: project.id }, data: { status: scenario.projectStatus, notes: scenario.notes } })

    await applyScenarioState(workspace.id, owner.id, vendor.id, scenario, project.id)

    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: owner.id,
        action: 'UAT_SCENARIO_READY',
        entityType: 'PROJECT',
        entityId: project.id,
        metadata: {
          scenario: scenario.key,
          sourceType: scenario.sourceType,
          projectCode: scenario.projectCode,
          status: scenario.projectStatus,
        },
      },
    })

    console.log(`READY project: ${project.projectCode} | ${project.projectName} | ${scenario.projectStatus}`)
  }

  console.log('\n=== THREE-PROJECT UAT DATASET READY ===')
  for (const scenario of scenarios) {
    console.log(`${scenario.key}: ${scenario.projectCode} | ${scenario.projectStatus} | ${scenario.projectName}`)
  }
  console.log('\nSource note:')
  console.log('- RSPAD and SS3 scenarios are reconstructed from the supplied real documents.')
  console.log('- Cikarang stalled scenario is synthetic but follows the same project-engineering/commercial workflow patterns.')
}

main()
  .catch((error) => {
    console.error('\n=== THREE-PROJECT UAT SEED FAILED ===')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
