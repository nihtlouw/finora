import { prisma } from '@/lib/db/prisma'

export const DEFAULT_EXECUTION_MILESTONES = [
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

export async function createProjectExecutionFoundation(tx: any, projectId: string) {
  for (let i = 0; i < DEFAULT_EXECUTION_MILESTONES.length; i += 1) {
    const [code, name] = DEFAULT_EXECUTION_MILESTONES[i]
    await tx.projectExecutionMilestone.create({
      data: { projectId, sequence: i + 1, code, name, status: 'PLANNED', progressPct: 0 },
    })
  }
}

export async function snapshotProposalBOQ(tx: any, projectId: string, proposalId: string) {
  const proposal = await tx.proposal.findUnique({
    where: { id: proposalId },
    include: { sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { id: 'asc' } } } } },
  })
  if (!proposal) throw new Error('Proposal sumber BOQ tidak ditemukan.')
  for (const section of proposal.sections) {
    const createdSection = await tx.projectBOQSection.create({
      data: {
        projectId,
        sourceSectionId: section.id,
        code: section.code,
        name: section.name,
        description: section.description,
        sortOrder: section.sortOrder,
      },
    })
    for (const item of section.items) {
      const plannedQty = Number(item.qty)
      const plannedAmount = plannedQty * Number(item.unitPrice)
      await tx.projectBOQItem.create({
        data: {
          projectId,
          sectionId: createdSection.id,
          sourceItemId: item.id,
          description: item.description,
          category: item.category,
          brand: item.brand,
          itemType: item.itemType,
          specification: item.specification,
          plannedQty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          plannedAmount,
          actualQty: 0,
          actualAmount: 0,
          progressPct: 0,
          notes: item.notes,
        },
      })
    }
  }
}

export async function getBillingReadiness(projectId: string, billingMilestoneId: string) {
  const conditions = await prisma.billingMilestoneCondition.findMany({
    where: { billingMilestoneId },
    include: { executionMilestone: true },
    orderBy: { label: 'asc' },
  })
  const missing: string[] = []
  for (const condition of conditions.filter((x) => x.required)) {
    if (condition.executionMilestoneId) {
      const milestone = condition.executionMilestone
      if (!milestone || milestone.status !== 'COMPLETED') {
        missing.push(`${condition.label}: execution milestone belum COMPLETED`)
      }
    }
    if (condition.requiredDocumentCategory) {
      const count = await prisma.projectDocument.count({
        where: {
          projectId,
          category: condition.requiredDocumentCategory,
          isCurrent: true,
        },
      })
      if (count < 1) missing.push(`${condition.label}: dokumen ${condition.requiredDocumentCategory} belum tersedia`)
    }
  }
  return { ready: missing.length === 0, missing, conditions }
}
