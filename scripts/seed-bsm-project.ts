import { config } from 'dotenv'

// Load environment variables before importing the Prisma singleton.
// This is important because lib/db/prisma.ts reads DATABASE_URL at module load time.
config({ path: '.env.local' })
config({ path: '.env' })

// Finora's Prisma 7 setup uses @prisma/adapter-pg in lib/db/prisma.ts.
// Reuse that configured singleton instead of instantiating PrismaClient directly.
const { prisma } = await import('../lib/db/prisma')

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
}

async function main() {
  console.log('=== BSM PROJECT FOUNDATION UAT SEED ===')

  const email = parseCsv(process.env.FINORA_OWNER_EMAILS)[0]
  if (!email) {
    throw new Error('FINORA_OWNER_EMAILS belum dikonfigurasi.')
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  })

  if (!user) {
    throw new Error(`Owner ${email} tidak ditemukan.`)
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: user.id,
      role: 'OWNER',
    },
    include: {
      workspace: true,
    },
  })

  if (!membership) {
    throw new Error('Workspace OWNER tidak ditemukan.')
  }

  const client = await prisma.clientVendor.findFirst({
    where: {
      workspaceId: membership.workspaceId,
      name: 'PT.KLIK UTAMA SYSTEM',
      type: 'CLIENT',
    },
  })

  if (!client) {
    throw new Error(
      'PT.KLIK UTAMA SYSTEM belum ada. Jalankan `npm run seed:bsm-complex-quotation` terlebih dahulu.',
    )
  }

  const proposal = await prisma.proposal.findFirst({
    where: {
      proposalNumber: 'PR-BSM-UAT-2026-001',
      clientId: client.id,
    },
  })

  if (!proposal) {
    throw new Error(
      'Proposal UAT belum ada. Jalankan `npm run seed:bsm-complex-quotation` terlebih dahulu.',
    )
  }

  if (proposal.status !== 'WON') {
    throw new Error('Proposal UAT harus WON sebelum PO dibuat.')
  }

  const poNumber = 'PO-BSM-UAT-2026-001'
  const projectCode = 'BSM-UAT-2026-001'

  let po = await prisma.customerPO.findFirst({
    where: {
      workspaceId: membership.workspaceId,
      poNumber,
    },
  })

  if (po) {
    // Never silently reuse a PO number belonging to another client/proposal.
    if (po.clientId !== client.id || po.quotationId !== proposal.id) {
      throw new Error(
        `PO ${poNumber} sudah ada tetapi relasinya tidak cocok dengan client/proposal BSM yang diharapkan. Seed dihentikan untuk mencegah perubahan data yang salah.`,
      )
    }

    console.log(`PO       : ${po.poNumber} (${po.status}) [existing]`)
  } else {
    po = await prisma.customerPO.create({
      data: {
        workspaceId: membership.workspaceId,
        clientId: client.id,
        quotationId: proposal.id,
        poNumber,
        poDate: new Date('2026-09-14'),
        receivedDate: new Date('2026-09-14'),
        reference: proposal.quotationReference,
        status: 'VERIFIED',
        totalAmount: proposal.subtotalAmount,
        taxAmount: proposal.taxAmount,
        grandTotal: proposal.totalAmount,
        remarks:
          'UAT simulation: PO customer yang mengkonfirmasi quotation BSM kompleks.',
      },
    })

    console.log(`PO       : ${po.poNumber} (${po.status}) [created]`)
  }

  let project = await prisma.project.findFirst({
    where: {
      workspaceId: membership.workspaceId,
      projectCode,
    },
  })

  if (project) {
    // Never silently reuse a project code belonging to another business object.
    if (
      project.clientId !== client.id ||
      project.proposalId !== proposal.id ||
      project.customerPoId !== po.id
    ) {
      throw new Error(
        `Project ${projectCode} sudah ada tetapi relasinya tidak cocok dengan BSM UAT yang diharapkan. Seed dihentikan untuk mencegah perubahan data yang salah.`,
      )
    }

    console.log(
      `Project  : ${project.projectCode} (${project.status}) [existing]`,
    )
  } else {
    project = await prisma.project.create({
      data: {
        workspaceId: membership.workspaceId,
        clientId: client.id,
        proposalId: proposal.id,
        customerPoId: po.id,
        projectCode,
        projectName:
          proposal.projectName ||
          'GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD',
        location: proposal.projectLocation || 'Jakarta Pusat',
        contractValue: proposal.totalAmount,
        status: 'PLANNED',
        notes: 'UAT simulation project foundation dari PO customer.',
      },
    })

    console.log(
      `Project  : ${project.projectCode} (${project.status}) [created]`,
    )
  }

  console.log(`Proposal : ${proposal.proposalNumber}`)
  console.log(
    `Value    : Rp${Number(project.contractValue).toLocaleString('id-ID')}`,
  )
  console.log('=== SEED COMPLETED ===')
}

try {
  await main()
} catch (error) {
  console.error('=== SEED FAILED ===')
  console.error(error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
