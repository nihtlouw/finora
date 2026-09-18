import { config } from 'dotenv'

// Load environment variables before importing the Prisma singleton.
// This is important because lib/db/prisma.ts reads DATABASE_URL at module load time.
config({ path: '.env.local' })
config({ path: '.env' })

// Finora's Prisma 7 setup uses @prisma/adapter-pg in lib/db/prisma.ts.
// Reuse that configured singleton instead of instantiating PrismaClient directly.
const { prisma } = await import('../lib/db/prisma')
const { createProjectExecutionFoundation, snapshotProposalBOQ } = await import('../lib/project-execution')

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
        grandTotal: proposal.roundedTotalAmount || proposal.totalAmount,
        currency: proposal.currency,
        taxIncluded: proposal.taxIncluded,
        overheadAmount: proposal.overheadAmount,
        roundingAmount: proposal.roundingAmount,
        roundedGrandTotal: proposal.roundedTotalAmount,
        paymentTermsSnapshot: {
          stages: [
            { name: 'DP', percentage: 50, trigger: 'PO_RELEASED', dueDays: 7 },
            { name: 'Progress', percentage: 45, trigger: 'FAT_AND_PRE_DELIVERY' },
            { name: 'Retention', percentage: 5, trigger: 'RETENTION_END', retentionMonths: 2 },
          ],
        },
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
    project = await prisma.$transaction(async tx => {
      const created = await tx.project.create({
        data: {
          workspaceId: membership.workspaceId, clientId: client.id, proposalId: proposal.id, customerPoId: po.id, projectCode,
          projectName: proposal.projectName || 'GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD',
          location: proposal.projectLocation || 'Jakarta Pusat', contractValue: po.grandTotal, revenueBasisValue: po.grandTotal.sub(po.taxAmount), status: 'PLANNED', notes: 'UAT simulation project foundation dari PO customer.',
        },
      })
      await snapshotProposalBOQ(tx, created.id, proposal.id)
      await createProjectExecutionFoundation(tx, created.id)
      await tx.projectContractVersion.create({ data: { projectId: created.id, versionNumber: 1, sourceType: 'CUSTOMER_PO', sourceId: po.id, effectiveDate: po.poDate, contractValue: created.contractValue, notes: 'Initial contract snapshot dari PO UAT.' } })
      return created
    })

    console.log(
      `Project  : ${project.projectCode} (${project.status}) [created]`,
    )
  }

  const boqCount = await prisma.projectBOQSection.count({ where: { projectId: project.id } })
  if (boqCount === 0) await prisma.$transaction(async tx => snapshotProposalBOQ(tx, project.id, proposal.id))
  const executionCount = await prisma.projectExecutionMilestone.count({ where: { projectId: project.id } })
  if (executionCount === 0) await prisma.$transaction(async tx => createProjectExecutionFoundation(tx, project.id))
  const versionCount = await prisma.projectContractVersion.count({ where: { projectId: project.id } })
  if (versionCount === 0) await prisma.projectContractVersion.create({ data: { projectId: project.id, versionNumber: 1, sourceType: 'CUSTOMER_PO', sourceId: po.id, effectiveDate: po.poDate, contractValue: project.contractValue, notes: 'Initial contract snapshot dari PO UAT.' } })

  const billingCount = await prisma.billingMilestone.count({ where: { projectId: project.id } })
  if (billingCount === 0) {
    const stages = [
      { sequence: 1, name: 'DP 50% — setelah PO terbit', percentage: 50, triggerCode: 'PO_RELEASED', triggerDescription: 'DP 50% dari PO terbit; pembayaran 7 hari setelah invoice masuk.', conditions: [] },
      { sequence: 2, name: 'Progress 45% — FAT + material sebelum delivery', percentage: 45, triggerCode: 'FAT_AND_PRE_DELIVERY', triggerDescription: 'Progress 45% setelah FAT dan material kabel dll sebelum delivery onsite.', conditions: [{ label: 'FAT completed', executionMilestoneCode: 'FAT' }, { label: 'FAT evidence', documentCategory: 'FAT' }] },
      { sequence: 3, name: 'Retention 5% — masa retensi 2 bulan', percentage: 5, triggerCode: 'RETENTION_END', triggerDescription: 'Pelunasan 5% setelah masa retensi 2 bulan.', conditions: [{ label: 'BAP / BAST completed', executionMilestoneCode: 'BAP_BAST' }, { label: 'BAP / BAST evidence', documentCategory: 'BAP_BAST' }] },
    ]
    for (const stage of stages) {
      const amount = Number(project.contractValue) * stage.percentage / 100
      const bm = await prisma.billingMilestone.create({ data: { projectId: project.id, sequence: stage.sequence, name: stage.name, percentage: stage.percentage.toFixed(2), amount: amount.toFixed(2), status: 'PLANNED', triggerCode: stage.triggerCode, triggerDescription: stage.triggerDescription } })
      for (const condition of stage.conditions) {
        const em = condition.executionMilestoneCode ? await prisma.projectExecutionMilestone.findFirst({ where: { projectId: project.id, code: condition.executionMilestoneCode } }) : null
        await prisma.billingMilestoneCondition.create({ data: { billingMilestoneId: bm.id, executionMilestoneId: em?.id ?? null, requiredDocumentCategory: condition.documentCategory ?? null, label: condition.label, conditionType: condition.executionMilestoneCode && condition.documentCategory ? 'EXECUTION_AND_DOCUMENT' : condition.executionMilestoneCode ? 'EXECUTION' : 'DOCUMENT', required: true } })
      }
      await prisma.paymentMilestone.create({ data: { projectId: project.id, billingMilestoneId: bm.id, sequence: stage.sequence, name: stage.name, percentage: stage.percentage.toFixed(2), amount: amount.toFixed(2), status: 'PLANNED', triggerCode: stage.triggerCode, dueDays: stage.sequence === 1 ? 7 : null, retentionMonths: stage.sequence === 3 ? 2 : null, retentionPercent: stage.sequence === 3 ? 5 : null, conditionNotes: stage.triggerDescription } })
    }
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
