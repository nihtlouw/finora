import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

function splitEmails(value) {
  return String(value || '')
    .split(/[;,]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
}

function futureDate(days) {
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

const CLIENT_NAME = 'PT.KLIK UTAMA SYSTEM'
const PROPOSAL_NUMBER = 'PR-BSM-UAT-2026-001'
const QUOTATION_REFERENCE = '0072/PH-BSM/KUS/VII/2026'

const sectionData = [
  {
    code: 'A',
    name: 'MOBILISASI & DEMOBILISASI',
    description: 'Pekerjaan persiapan, mobilisasi, fasilitas sementara, dokumentasi, testing, keselamatan kerja, dan kebutuhan site.',
    items: [
      ['SERVICE', 'Pekerjaan Persiapan, Visit Site, Pengukuran, dll', '', '', '', 1, 'LOT', 11500000],
      ['SERVICE', 'Facility, Temporary Office, Workshop, Gudang Material, Listrik dan Air', '', '', '', 1, 'LOT', 11500000],
      ['SERVICE', 'Koordinasi Lingkungan dan Keamanan Setempat', '', '', '', 1, 'LOT', 5750000],
      ['SERVICE', 'Transportasi dan Akomodasi Site, Material dan Man Power', '', '', '', 1, 'LOT', 9775000],
      ['SERVICE', 'Forklift 10 Ton Loading / Unloading Trafo, Panel dan Material On Site', '', '', '', 1, 'LOT', 13800000],
      ['SERVICE', 'Dokumentasi, Asbuilt Drawing dan Test Report', '', '', '', 1, 'LOT', 6900000],
      ['SERVICE', 'Testing & Commissioning', '', '', '', 1, 'LOT', 7475000],
      ['SERVICE', 'APD, Safety, Tool Alat Kerja, Scaffolding dan Power Temporary (Genset)', '', '', '', 1, 'LOT', 17250000],
      ['SERVICE', 'SLO dan NIDI Panel Tegangan Menengah TM', '', '', 'Sertifikat Laik Operasi dan Nomor Identitas Instalasi', 1, 'LOT', 55200000],
    ],
  },
  {
    code: 'B',
    name: 'PANEL, TRAFO, LVMDP & JASA INSTALASI',
    description: 'Pengadaan panel TM 24kV, LVMDP utama, capacitor bank, trafo distribusi 1000kVA, material pendukung, dan jasa instalasi.',
    items: [
      ['MATERIAL', 'Panel Cubicle TM 24kV', 'Schneider', 'F-SM6R-IM-A1-C', '24kV, 630A, IK 16kA-1 sec', 1, 'CUBICLE', 54600000],
      ['MATERIAL', 'SF6 GCB Circuit Breaker', 'Schneider', 'F-SM6R-DM1A-A25-C', '24kV, 630A, IK 16kA-1 sec', 1, 'CUBICLE', 290325000],
      ['MATERIAL', 'Relay / Metering', 'Schneider', 'R/L', 'Proteksi dan metering panel', 1, 'SET', 7350000],
      ['MATERIAL', 'Transformer Distribusi 1000kVA', 'B&D Trafindo', 'Indoor', '20kV/400V, ONAN, Dyn-5, CU-CU', 1, 'UNIT', 415500000],
      ['MATERIAL', 'Cable Multi Core TM 20kV', 'Sutrado/Kabelindo/KMI', 'NA2AXSBY', '3 x 240mm, Gardu PLN ke Gardu Pelanggan', 150, 'MTR', 1007800],
      ['MATERIAL', 'Cable Single Core TM 20kV', 'Sutrado/Kabelindo/KMI', 'N2XSY', '1 x 3 x 70mm, Panel TM ke Trafo 1000kVA', 60, 'MTR', 300400],
      ['MATERIAL', 'Terminasi Kit Indoor', 'Raychem', 'Multi Core 20kV', 'Panel TM PLN dan Panel Pelanggan', 2, 'SET', 9285600],
      ['MATERIAL', 'Terminasi Kit Indoor', 'Raychem', 'Single Core 20kV', 'Panel Pelanggan ke Trafo 1000kVA', 1, 'SET', 5241500],
      ['MATERIAL', 'Terminasi Elastimold', 'Raychem', 'Single Core 20kV', 'Outgoing Trafo 1000kVA', 1, 'SET', 6062900],
      ['MATERIAL', 'Pagar BRC Safety Trafo 1000kVA', 'BRC', '', 'Tinggi 170cm termasuk accessories', 1, 'LOT', 6101900],
      ['MATERIAL', 'Base Frame dan Plate Dudukan Panel TM', '', '', 'Untuk panel TM 20kV dan trafo', 1, 'LOT', 9571700],
      ['MATERIAL', 'Ladder Tray + Cover + Jointing', 'Lokal', 'Galvanized', '600 x 50 x 3000mm', 1, 'LOT', 13917200],
      ['MATERIAL', 'Consumable & Supporting Material', '', '', 'Painting, wiring accessories dan material bantu', 1, 'LOT', 11964600],
      ['MATERIAL', 'LVMDP Panel Utama Incoming PLN', 'Schneider', 'MVS16H3MF2A', 'ACB 4P 1600A, 65kA, fixed type', 1, 'CELL', 194177500],
      ['MATERIAL', 'LVMDP Panel Incoming Generator', 'Schneider', 'MVS16H3MF2A', 'ACB 4P 1600A, interlock PLN-GENSET', 1, 'CELL', 205677500],
      ['MATERIAL', 'Feeder Outgoing LVMDP', 'Schneider', 'CVS Series', 'MCCB feeder dan enclosure', 1, 'CELL', 124885700],
      ['MATERIAL', 'Capacitor Bank 400kVAR 12 Step', 'Himel / Zez Silko', '12 x 50kVAR', 'APFC 100-415VAC', 1, 'CELL', 159498700],
      ['SERVICE', 'Pemasangan, Setting dan Instal Panel Cubicle TM 24kV', 'Schneider', 'F-SM6R', '', 1, 'LOT', 2575000],
      ['SERVICE', 'Pemasangan, Setting dan Instal GCB / Relay', 'Schneider', 'F-SM6R', '', 1, 'LOT', 2575000],
      ['SERVICE', 'Pemasangan Transformer Distribusi 1000kVA', 'B&D Trafindo', 'Indoor', '', 1, 'UNIT', 4291700],
      ['SERVICE', 'Pemasangan LVMDP Panel Utama ATS-AMF', '', 'LVMDP PUTR', 'Interlock PLN-GENSET', 3, 'CELL', 6008300],
      ['SERVICE', 'Setting dan Instal Capacitor Bank 400kVAR', '', 'LV-CAP BANK', '', 2, 'CELL', 2575000],
      ['SERVICE', 'Galian Kabel Kedalaman 40cm + Perapihan', '', '', 'Jalur dari gardu PLN ke gardu pelanggan', 150, 'MTR', 60100],
      ['SERVICE', 'Pulling dan Gelar Kabel TM 24kV', '', '', '', 210, 'MTR', 92700],
      ['SERVICE', 'Terminasi dan Koneksi Kabel Panel TM', '', '', 'Panel PLN dan Panel pelanggan', 2, 'SET', 2575000],
      ['SERVICE', 'Terminasi dan Koneksi Kabel Panel ke Trafo', '', '', '', 2, 'SET', 2575000],
      ['SERVICE', 'Pemasangan Pagar BRC Safety Trafo', '', '', '', 1, 'LOT', 15020800],
      ['SERVICE', 'Pemasangan Base Frame dan Plate', '', '', '', 1, 'LOT', 4291700],
      ['SERVICE', 'Pemasangan Ladder Tray', '', '', 'Include cover dan jointing', 1, 'LOT', 5579100],
    ],
  },
  {
    code: 'C',
    name: 'PENGADAAN KABEL & JASA INSTALASI KABEL',
    description: 'Pengadaan kabel power berbagai lantai, jalur genset/trafo, ladder tray, material pendukung, dan jasa instalasi kabel.',
    items: [
      ['MATERIAL', 'Kabel Power Multi Core Panel Radiologi', 'Sutrado/KMI', 'NYY', '4 x 25mm, MCCB 125A', 1, 'LOT', 150000000],
      ['MATERIAL', 'Kabel Power Multi Core SDP Lantai 1-3', 'Sutrado/KMI', 'NYY', 'Berbagai ukuran 16-50mm', 1, 'LOT', 180000000],
      ['MATERIAL', 'Kabel Power Multi Core SDP Lantai 4-7', 'Sutrado/KMI', 'NYY', 'Berbagai ukuran 25-240mm', 1, 'LOT', 250000000],
      ['MATERIAL', 'Kabel Power Jalur Genset - Panel', 'Sutrado/KMI', 'NYY / NYYHY', 'Single/Double/Multi Core', 1, 'LOT', 302000000],
      ['MATERIAL', 'Kabel Power Jalur Trafo', 'Sutrado/KMI', 'NYY / NYYHY', 'Single/Multi Core', 1, 'LOT', 168000000],
      ['MATERIAL', 'Ladder Tray dan Material Pendukung', 'Lokal', 'Galvanized', 'Berbagai ukuran + cover/jointing', 1, 'LOT', 95000000],
      ['MATERIAL', 'Consumable, Supporting Material & Wiring Accessories', '', '', 'Material bantu pekerjaan kabel', 1, 'LOT', 46642100],
      ['SERVICE', 'Penarikan / Pulling Kabel', '', '', 'Total panjang pekerjaan ±1.632 Mtr', 1632, 'MTR', 46300],
      ['SERVICE', 'Terminasi dan Koneksi Kabel', '', '', '', 1, 'LOT', 5150000],
      ['SERVICE', 'Install Ladder Tray & Jointing', '', '', '', 1, 'LOT', 16909100],
      ['SERVICE', 'Pemasangan Support Ladder Tray', '', '', '', 1, 'LOT', 13389900],
    ],
  },
  {
    code: 'D',
    name: 'GROUNDING SYSTEM & JASA INSTALASI',
    description: 'Pengadaan material grounding, cable BC, rod, accessories, pekerjaan bor/pantek, koneksi, pulling dan pengukuran tahanan tanah.',
    items: [
      ['MATERIAL', 'Grounding Rod Copper 5/8 x 3000mm', '', '', 'Full copper', 10, 'BTG', 15848000],
      ['MATERIAL', 'Kabel BC 70mm Grounding Utama', '', '', '', 196, 'MTR', 213000],
      ['MATERIAL', 'Kabel BC 50mm Grounding Panel', '', '', '', 80, 'MTR', 162300],
      ['MATERIAL', 'Grounding Rod / Clamp / Coupling Accessories', '', '', 'Material instalasi grounding', 1, 'LOT', 361000],
      ['MATERIAL', 'Cable Lug Copper 50-70mm', '', '', '', 20, 'PCS', 69800],
      ['MATERIAL', 'Busbar Grounding 30 x 5mm', '', '', '', 10, 'PCS', 213000],
      ['MATERIAL', 'Bak Kontrol Grounding / Main Hole', '', '', 'Include accessories', 2, 'PCS', 1014300],
      ['MATERIAL', 'Box Grounding 4 Point', '', '', '', 10, 'PCS', 348700],
      ['MATERIAL', 'Material Bantu dan Accessories Grounding', '', '', '', 10, 'PCS', 950900],
      ['MATERIAL', 'Material Pendukung Grounding Lainnya', '', '', '', 1, 'LOT', 4437600],
      ['SERVICE', 'Pantek Grounding / Bor Tanah ±10m, 4 Point', '', '', '', 1, 'LOT', 9900000],
      ['SERVICE', 'Terminasi dan Koneksi Kabel BC Grounding', '', '', '', 1, 'LOT', 2887500],
      ['SERVICE', 'Pulling / Gelar Kabel BC', '', '', '', 1, 'LOT', 7969500],
      ['SERVICE', 'Pengukuran Resistance Pertanahan Grounding', '', '', 'Target 0,1 - 0,5 Ohm', 1, 'LOT', 3300000],
    ],
  },
  {
    code: 'E',
    name: 'OVERHEAD & ROUNDING',
    description: 'Komponen overhead proyek dan penyesuaian pembulatan untuk simulasi quotation.',
    items: [
      ['OTHER', 'Overhead proyek', '', '', 'Simulasi berdasarkan quotation sumber', 1, 'LOT', 66770120],
      ['OTHER', 'Rounding adjustment', '', '', 'Penyesuaian pembulatan terhadap total quotation sumber', 1, 'LOT', 3880],
    ],
  },
]

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
        picName: 'IBU RONTING PONGSIMBONG',
        email: 'procurement@example.invalid',
        phone: null,
        address: 'Harco Mangga Dua Plaza Blok B Lt.3 No.31, Jakarta Pusat - 10730',
        isActive: true,
      },
    })
  }

  const existing = await prisma.proposal.findUnique({
    where: { proposalNumber: PROPOSAL_NUMBER },
    include: { invoice: true, sections: true },
  })

  if (existing?.invoice) {
    console.log(`Proposal ${PROPOSAL_NUMBER} sudah memiliki invoice. Tidak diubah agar data UAT aman.`)
    return
  }
  if (existing && existing.status !== 'DRAFT') {
    console.log(`Proposal ${PROPOSAL_NUMBER} sudah berstatus ${existing.status}. Tidak diubah agar data UAT aman.`)
    return
  }

  const subtotal = sectionData.flatMap((s) => s.items).reduce((sum, item) => sum + Number(item[7]), 0)
  const expected = 3405280000
  if (subtotal !== expected) {
    throw new Error(`Guard harga gagal. Seed menghasilkan Rp${subtotal.toLocaleString('id-ID')}, expected Rp${expected.toLocaleString('id-ID')}.`)
  }

  const validUntil = futureDate(7)

  const proposal = await prisma.$transaction(async (tx) => {
    let row
    if (existing) {
      await tx.proposalItem.deleteMany({ where: { proposalId: existing.id } })
      await tx.proposalSection.deleteMany({ where: { proposalId: existing.id } })
      row = await tx.proposal.update({
        where: { id: existing.id },
        data: {
          clientId: client.id,
          quotationReference: QUOTATION_REFERENCE,
          projectName: 'GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD',
          projectLocation: 'Jakarta Pusat',
          scopeSummary: 'Pengadaan trafo, cubicle, LVMDP, panel capacitor bank, kabel power, grounding system, dan jasa instalasi listrik.',
          status: 'DRAFT',
          subtotalAmount: String(expected),
          discountPercent: '0',
          discountAmount: '0',
          taxPercent: '0',
          taxAmount: '0',
          totalAmount: String(expected),
          termsAndConditions: [
            'Harga penawaran belum termasuk PPN 11%.',
            'Penawaran berlaku selama 7 hari kalender.',
            'Garansi material utama panel listrik dan trafo distribusi 1 tahun.',
            'Simulasi termin: DP 50% setelah SPK/PO terbit; progress 45% setelah FAT dan material sebelum delivery onsite; retensi 5% setelah masa retensi 2 bulan.',
            'Mohon dukungan proses ijin di site mengingat project prioritas.',
            'Catatan: data ini adalah simulasi UAT berbasis struktur dokumen BSM, bukan salinan quotation customer secara penuh.',
          ].join('\n'),
          validUntil,
        },
      })
    } else {
      row = await tx.proposal.create({
        data: {
          clientId: client.id,
          proposalNumber: PROPOSAL_NUMBER,
          quotationReference: QUOTATION_REFERENCE,
          projectName: 'GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD',
          projectLocation: 'Jakarta Pusat',
          scopeSummary: 'Pengadaan trafo, cubicle, LVMDP, panel capacitor bank, kabel power, grounding system, dan jasa instalasi listrik.',
          status: 'DRAFT',
          subtotalAmount: String(expected),
          discountPercent: '0',
          discountAmount: '0',
          taxPercent: '0',
          taxAmount: '0',
          totalAmount: String(expected),
          termsAndConditions: [
            'Harga penawaran belum termasuk PPN 11%.',
            'Penawaran berlaku selama 7 hari kalender.',
            'Garansi material utama panel listrik dan trafo distribusi 1 tahun.',
            'Simulasi termin: DP 50% setelah SPK/PO terbit; progress 45% setelah FAT dan material sebelum delivery onsite; retensi 5% setelah masa retensi 2 bulan.',
            'Mohon dukungan proses ijin di site mengingat project prioritas.',
            'Catatan: data ini adalah simulasi UAT berbasis struktur dokumen BSM, bukan salinan quotation customer secara penuh.',
          ].join('\n'),
          validUntil,
        },
      })
    }

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
          sourceStyle: 'BSM quotation / BOQ simulation',
          total: String(expected),
          sectionCount: sectionData.length,
          itemCount: sectionData.reduce((n, s) => n + s.items.length, 0),
        },
      },
    })

    return row
  })

  console.log('=== BSM COMPLEX QUOTATION UAT SEED ===')
  console.log(`Workspace : ${membership.workspace.name}`)
  console.log(`Client    : ${client.name}`)
  console.log(`Proposal  : ${proposal.proposalNumber}`)
  console.log(`Reference : ${QUOTATION_REFERENCE}`)
  console.log('Project   : GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD')
  console.log(`Subtotal  : Rp${subtotal.toLocaleString('id-ID')}`)
  console.log(`Total     : Rp${expected.toLocaleString('id-ID')}`)
  console.log(`Sections  : ${sectionData.length}`)
  console.log(`Items     : ${sectionData.reduce((n, s) => n + s.items.length, 0)}`)
  console.log('Status    : DRAFT')
  console.log('')
  console.log('UAT berikutnya: DRAFT → SENT → WON → Customer PO → Project → Billing → Invoice')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
