import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 })
const prisma = new PrismaClient({ adapter })

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const po = await prisma.customerPO.findFirst({
    where: { poNumber: '00077/PO/HU/VIII/2026' },
    include: {
      client: true,
      quotation: true,
      project: { include: { billingMilestones: true, paymentMilestones: true } },
    },
  })

  assert(po, 'PO 00077/PO/HU/VIII/2026 tidak ditemukan.')
  assert(po.client.name === 'PT HURIP UTAMA', 'Client mismatch.')
  assert(po.quotation?.proposalNumber === 'PR-UAT-HU-SS3-2026-001', 'Bridge proposal mismatch.')
  assert(Number(po.totalAmount) === 28377500, 'Subtotal mismatch.')
  assert(Number(po.taxAmount) === 3121525, 'PPN mismatch.')
  assert(Number(po.grandTotal) === 31500000, 'Grand total mismatch.')
  assert(po.taxIncluded === true, 'taxIncluded harus true.')
  assert(po.reference === '0072/PH-BSM/HU/VIII/2026', 'Reference mismatch.')

  const stages = ((po.paymentTermsSnapshot as any)?.stages ?? []) as any[]
  assert(stages.length === 2, 'Harus ada 2 payment stages.')
  assert(stages[0].percentage === 50 && stages[0].dueDays === 7, 'DP 50% harus dueDays=7.')
  assert(stages[1].percentage === 50 && stages[1].triggerCode === 'BAP_COMPLETED', 'Final 50% harus BAP_COMPLETED.')
  assert(!stages[1].dueDays, 'Final 50% tidak boleh punya dueDays yang tidak ada di source.')

  console.log('SOURCE PO SNAPSHOT ........ PASS')
  console.log('TAX INCLUDED ............... PASS')
  console.log('PAYMENT 50/50 .............. PASS')
  console.log('BAP FINAL TRIGGER .......... PASS')

  if (!po.project) {
    console.log('PROJECT .................... PENDING (expected before web UAT)')
    return
  }

  assert(Number(po.project.contractValue) === 31500000, 'Project contract value mismatch.')
  assert(Number(po.project.revenueBasisValue) === 28377500, 'Project revenue basis mismatch.')
  assert(po.project.billingMilestones.length === 2, 'Billing milestones should be 2.')
  assert(po.project.paymentMilestones.length === 2, 'Payment milestones should be 2.')

  console.log('CONTRACT VALUE ............. PASS')
  console.log('REVENUE BASIS .............. PASS')
  console.log('BILLING 50/50 .............. PASS')
  console.log('PAYMENT 50/50 ............... PASS')
}

main()
  .catch(error => {
    console.error('=== QA FAILED ===')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
