import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 })
const prisma = new PrismaClient({ adapter })
const failures: string[] = []

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function n(value: unknown) {
  return Number(value || 0)
}

async function readiness(projectId: string, milestoneId: string) {
  const conditions = await prisma.billingMilestoneCondition.findMany({
    where: { billingMilestoneId: milestoneId },
    include: { executionMilestone: true },
  })
  const missing: string[] = []
  for (const condition of conditions.filter((x) => x.required)) {
    if (condition.executionMilestoneId && (!condition.executionMilestone || condition.executionMilestone.status !== 'COMPLETED')) {
      missing.push(condition.label)
    }
    if (condition.requiredDocumentCategory) {
      const count = await prisma.projectDocument.count({ where: { projectId, category: condition.requiredDocumentCategory, isCurrent: true } })
      if (!count) missing.push(condition.label)
    }
  }
  return { ready: missing.length === 0, missing }
}

async function verifyScenario(code: string, expected: { status: string; contract: number; revenueBasis: number; invoiceCount: number; collected: number; execution?: Record<string, string>; documentCategories?: string[] }) {
  const project = await prisma.project.findFirst({
    where: { projectCode: code },
    include: {
      client: true,
      customerPO: true,
      proposal: true,
      executionMilestones: { orderBy: { sequence: 'asc' } },
      invoices: { include: { payments: true } },
      expenses: { include: { allocations: true } },
      documents: true,
      changeOrders: true,
    },
  })
  assert(project, code + ': project tidak ditemukan')
  if (!project) return

  assert(project.status === expected.status, code + ': status ' + project.status + ' != ' + expected.status)
  assert(Math.abs(n(project.contractValue) - expected.contract) < 0.01, code + ': contract value mismatch')
  assert(Math.abs(n(project.revenueBasisValue) - expected.revenueBasis) < 0.01, code + ': revenue basis mismatch')
  assert(!!project.customerPO, code + ': Customer PO missing')
  assert(!!project.proposal && project.proposal.status === 'WON', code + ': proposal must be WON')

  const collected = project.invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((p, row) => p + n(row.amount), 0), 0)
  assert(Math.abs(collected - expected.collected) < 0.01, code + ': collected mismatch')
  assert(project.invoices.length === expected.invoiceCount, code + ': invoice count mismatch')

  for (const [milestoneCode, status] of Object.entries(expected.execution || {})) {
    const row = project.executionMilestones.find((x) => x.code === milestoneCode)
    assert(!!row, code + ': execution milestone ' + milestoneCode + ' missing')
    if (row) assert(row.status === status, code + ': ' + milestoneCode + ' status ' + row.status + ' != ' + status)
  }

  for (const category of expected.documentCategories || []) {
    assert(project.documents.some((doc) => doc.category === category && doc.isCurrent), code + ': current document category ' + category + ' missing')
  }

  console.log('PASS ' + code + ': ' + project.projectName)
}

async function main() {
  await verifyScenario('FIN-UAT-RSPAD-ONGOING-2026', {
    status: 'ACTIVE',
    contract: 3405280000,
    revenueBasis: 3405280000,
    invoiceCount: 2,
    collected: 2702640000,
    execution: {
      MOBILIZATION: 'COMPLETED',
      PROCUREMENT: 'COMPLETED',
      FAT: 'COMPLETED',
      DELIVERY: 'IN_PROGRESS',
      INSTALLATION: 'IN_PROGRESS',
      TESTING: 'PLANNED',
      BAP_BAST: 'PLANNED',
    },
    documentCategories: ['FAT', 'DELIVERY'],
  })

  await verifyScenario('FIN-UAT-SS3-COMPLETED-2026', {
    status: 'CLOSED',
    contract: 31500000,
    revenueBasis: 28377500,
    invoiceCount: 2,
    collected: 31500000,
    execution: {
      MOBILIZATION: 'COMPLETED',
      PROCUREMENT: 'COMPLETED',
      FAT: 'COMPLETED',
      DELIVERY: 'COMPLETED',
      INSTALLATION: 'COMPLETED',
      TESTING: 'COMPLETED',
      COMMISSIONING: 'COMPLETED',
      BAP_BAST: 'COMPLETED',
      CLOSEOUT: 'COMPLETED',
    },
    documentCategories: ['BAP_BAST', 'CLOSEOUT'],
  })

  await verifyScenario('FIN-UAT-CIKARANG-STALLED-2026', {
    status: 'ON_HOLD',
    contract: 438450000,
    revenueBasis: 395000000,
    invoiceCount: 1,
    collected: 131535000,
    execution: {
      MOBILIZATION: 'COMPLETED',
      PROCUREMENT: 'BLOCKED',
      FAT: 'PLANNED',
      DELIVERY: 'PLANNED',
    },
  })

  const stalled = await prisma.project.findUnique({
    where: { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026' },
    include: { billingMilestones: { orderBy: { sequence: 'asc' } }, expenses: true, changeOrders: true },
  })

  if (stalled) {
    assert(stalled.billingMilestones.length === 3, 'STALLED: expected 3 billing milestones')
    const target = stalled.billingMilestones[1]
    if (target) {
      const result = await readiness(stalled.id, target.id)
      assert(!result.ready, 'STALLED: 60% billing must be blocked')
      assert(result.missing.length >= 2, 'STALLED: readiness should report multiple missing conditions')
      console.log('PASS STALLED billing gate: blocked (' + result.missing.join(', ') + ')')
    }
    assert(stalled.expenses.some((expense) => expense.status === 'PENDING'), 'STALLED: expected pending expense')
    assert(stalled.changeOrders.some((order) => order.status === 'SUBMITTED' && n(order.approvedAmount) === 0), 'STALLED: expected submitted unapproved change order')
  }

  const completed = await prisma.project.findUnique({
    where: { projectCode: 'FIN-UAT-SS3-COMPLETED-2026' },
    include: { expenses: true },
  })
  if (completed) {
    const totalCost = completed.expenses.filter((x) => x.status === 'APPROVED').reduce((sum, x) => sum + n(x.amount), 0)
    const grossProfit = n(completed.revenueBasisValue) - totalCost
    assert(Math.abs(totalCost - 18000000) < 0.01, 'COMPLETED: actual cost mismatch')
    assert(Math.abs(grossProfit - 10377500) < 0.01, 'COMPLETED: gross profit mismatch')
    console.log('PASS COMPLETED profitability: Rp' + grossProfit.toLocaleString('id-ID'))
  }

  if (failures.length) {
    console.error('=== THREE-PROJECT UAT FAILED ===')
    for (const failure of failures) console.error(' - ' + failure)
    process.exitCode = 1
    return
  }

  console.log('=== THREE-PROJECT UAT PASSED ===')
  console.log('RSPAD   : ACTIVE')
  console.log('SS3     : CLOSED')
  console.log('Cikarang: ON_HOLD')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
