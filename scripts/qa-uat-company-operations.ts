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

function money(value: unknown) {
  return Math.round(n(value) * 100) / 100
}

async function getOwnerWorkspace() {
  const ownerEmails = String(process.env.FINORA_OWNER_EMAILS || '')
    .split(/[;,]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

  const owner = await prisma.user.findFirst({ where: { email: { in: ownerEmails } }, orderBy: { createdAt: 'asc' } })
  assert(owner, 'Owner tidak ditemukan.')
  if (!owner) return null

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: owner.id, role: 'OWNER' },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })
  assert(membership, 'Workspace OWNER tidak ditemukan.')
  return membership ? { owner, workspace: membership.workspace } : null
}

async function main() {
  const context = await getOwnerWorkspace()
  if (!context) throw new Error('Workspace context tidak dapat dibaca.')
  const { owner, workspace } = context

  const employees = await prisma.employee.findMany({ where: { workspaceId: workspace.id } })
  const seededEmployeeNos = ['EMP-001','EMP-002','EMP-003','EMP-004','EMP-005','EMP-006','EMP-007','EMP-008']
  assert(seededEmployeeNos.every(no => employees.some(x => x.employeeNo === no)), '8 employee UAT belum lengkap.')

  for (const employee of employees.filter((x) => seededEmployeeNos.includes(x.employeeNo))) {
    assert(!!employee.position, `Employee ${employee.employeeNo} belum memiliki position.`)
    assert(!!employee.department, `Employee ${employee.employeeNo} belum memiliki department.`)
    assert(['FULL_TIME','CONTRACT','DAILY_WORKER','INTERN'].includes(employee.employmentType), `Employee ${employee.employeeNo} memiliki employmentType invalid.`)
    assert(!!employee.joinDate, `Employee ${employee.employeeNo} belum memiliki joinDate.`)
  }

  const payroll = await prisma.payrollRun.findFirst({
    where: { workspaceId: workspace.id, period: '2026-09', runNumber: 'PAY-2026-09-001' },
    include: { lines: { include: { employee: true, allocations: true } } },
  })
  assert(payroll, 'Payroll September 2026 tidak ditemukan.')
  if (payroll) {
    assert(payroll.status === 'PAID', `Payroll status expected PAID, got ${payroll.status}`)
    assert(money(payroll.grossAmount) === 83_000_000, `Payroll gross expected 83m, got ${payroll.grossAmount}`)
    assert(money(payroll.deductionAmount) === 4_750_000, `Payroll deductions expected 4.75m, got ${payroll.deductionAmount}`)
    assert(money(payroll.netAmount) === 78_250_000, `Payroll net expected 78.25m, got ${payroll.netAmount}`)
    assert(payroll.lines.length === 8, `Payroll line count expected 8, got ${payroll.lines.length}`)
    for (const line of payroll.lines) {
      const allocationPct = line.allocations.reduce((s, x) => s + n(x.percentage), 0)
      assert(Math.abs(allocationPct - 100) < 0.001, `Payroll allocation for ${line.employee.employeeNo} is ${allocationPct}%`)
    }
    const payrollCashflows = await prisma.cashflowTransaction.findMany({ where: { payrollRunId: payroll.id } })
    assert(payrollCashflows.length === 1, `Payroll cashflow expected 1, got ${payrollCashflows.length}`)
    assert(payrollCashflows[0] && money(payrollCashflows[0].amount) === 78_250_000, 'Payroll cashflow amount mismatch.')
  }

  const banks = await prisma.bankAccount.findMany({ where: { workspaceId: workspace.id } })
  const bca = banks.find(x => x.name === 'BCA Operasional UAT')
  const mandiri = banks.find(x => x.name === 'Mandiri Project UAT')
  assert(!!bca && !!mandiri, '2 rekening bank UAT belum lengkap.')
  assert(bca?.isDefault === true, 'BCA Operasional UAT harus menjadi rekening default.')

  const vendor = await prisma.clientVendor.findFirst({ where: { workspaceId: workspace.id, type: 'VENDOR', name: 'PT Maju Teknik Nusantara' } })
  assert(!!vendor, 'Vendor PT Maju Teknik Nusantara belum ada.')

  const bills = await prisma.vendorBill.findMany({
    where: { workspaceId: workspace.id, billNumber: { in: ['VB-UAT-RSPAD-001', 'VB-UAT-RSPAD-002'] } },
    include: { payments: true, project: true },
  })
  const paidBill = bills.find(x => x.billNumber === 'VB-UAT-RSPAD-001')
  const openBill = bills.find(x => x.billNumber === 'VB-UAT-RSPAD-002')
  assert(!!paidBill && paidBill.status === 'PAID', 'Vendor bill paid UAT tidak valid.')
  assert(!!paidBill && money(paidBill.totalAmount) === 125_000_000, 'Vendor bill paid amount mismatch.')
  assert(!!openBill && openBill.status === 'APPROVED', 'Vendor bill unpaid UAT harus APPROVED.')
  assert(!!openBill && money(openBill.totalAmount) === 40_000_000, 'Vendor bill unpaid amount mismatch.')
  if (paidBill) {
    const billCashflow = await prisma.cashflowTransaction.findFirst({ where: { vendorBillPaymentId: { not: null }, sourceRef: { startsWith: 'VENDOR_BILL_PAYMENT:' } } })
    assert(!!billCashflow && money(billCashflow?.amount) === 125_000_000, 'Vendor bill payment cashflow mismatch.')
  }

  const seededExpenses = await prisma.expense.findMany({
    where: { workspaceId: workspace.id, description: { startsWith: 'UAT-CO-EXPENSE:' } },
    include: { allocations: true, cashflow: true },
  })
  const approvedExpenses = seededExpenses.filter(x => x.status === 'APPROVED')
  const pendingExpenses = seededExpenses.filter(x => x.status === 'PENDING')
  assert(approvedExpenses.length === 6, `Expected 6 approved company UAT expenses, got ${approvedExpenses.length}`)
  assert(pendingExpenses.length === 1, `Expected 1 pending company UAT expense, got ${pendingExpenses.length}`)
  assert(money(approvedExpenses.reduce((s,x)=>s+n(x.amount),0)) === 66_500_000, 'Approved expense total should be 66.5m.')
  assert(money(pendingExpenses.reduce((s,x)=>s+n(x.amount),0)) === 18_000_000, 'Pending expense total should be 18m.')
  assert(approvedExpenses.every(x => x.cashflow.length === 1), 'Setiap approved UAT expense harus memiliki 1 cashflow.')
  assert(pendingExpenses.every(x => x.cashflow.length === 0), 'Pending UAT expense tidak boleh memiliki cashflow otomatis.')

  const budgets = await prisma.budget.findMany({ where: { workspaceId: workspace.id, period: '2026-09' } })
  const budgetCategories = ['PAYROLL','VENDOR_BILL','MATERIAL','TRANSPORT','JASA_SUBKON','OPERASIONAL_UMUM','LOGISTIK','SEWA_PERALATAN']
  assert(budgetCategories.every(category => budgets.some(x => x.category === category)), 'Budget September belum lengkap untuk semua kategori UAT.')

  const periods = await prisma.accountingPeriod.findMany({ where: { workspaceId: workspace.id, period: { in: ['2026-08','2026-09'] } } })
  assert(periods.length === 2 && periods.every(x => x.status === 'OPEN'), 'Accounting period Agustus/September harus OPEN.')

  if (bca) {
    const statements = await prisma.bankStatementTransaction.findMany({ where: { workspaceId: workspace.id, bankAccountId: bca.id, externalId: { startsWith: 'UAT-BCA-SEP-2026-' } } })
    const matched = statements.filter(x => x.matchStatus === 'MATCHED')
    const unmatched = statements.filter(x => x.matchStatus === 'UNMATCHED')
    assert(matched.length > 0, 'Bank statement matched belum terbentuk.')
    assert(unmatched.length === 1 && money(unmatched[0].amount) === 750_000, 'Bank statement unmatched UAT harus 750 ribu.')

    const reconciliation = await prisma.bankReconciliation.findUnique({
      where: {
        workspaceId_bankAccountId_periodStart_periodEnd: {
          workspaceId: workspace.id,
          bankAccountId: bca.id,
          periodStart: new Date('2026-09-01T00:00:00.000Z'),
          periodEnd: new Date('2026-09-30T00:00:00.000Z'),
        },
      },
    })
    assert(!!reconciliation, 'Bank reconciliation September belum ada.')
    if (reconciliation) {
      assert(reconciliation.status === 'DRAFT', `Bank reconciliation expected DRAFT, got ${reconciliation.status}`)
      assert(money(reconciliation.difference) === -750_000, `Bank reconciliation difference expected -750k, got ${reconciliation.difference}`)
    }
  }

  const creditNote = await prisma.creditNote.findFirst({ where: { workspaceId: workspace.id, number: 'CN-UAT-RSPAD-DRAFT-001' } })
  assert(!!creditNote && creditNote.status === 'DRAFT', 'Draft credit note UAT belum ada.')

  const rspad = await prisma.project.findFirst({ where: { workspaceId: workspace.id, projectCode: 'FIN-UAT-RSPAD-ONGOING-2026' } })
  const cikarang = await prisma.project.findFirst({ where: { workspaceId: workspace.id, projectCode: 'FIN-UAT-CIKARANG-STALLED-2026' } })
  const ss3 = await prisma.project.findFirst({ where: { workspaceId: workspace.id, projectCode: 'FIN-UAT-SS3-COMPLETED-2026' } })
  assert(!!rspad && !!cikarang && !!ss3, '3 project backbone tidak lengkap.')
  if (ss3) {
    const ss3PayrollAllocations = await prisma.payrollAllocation.count({ where: { projectId: ss3.id } })
    const ss3UatExpenses = await prisma.expenseAllocation.count({ where: { projectId: ss3.id, expense: { description: { startsWith: 'UAT-CO-EXPENSE:' } } } })
    const ss3VendorBills = await prisma.vendorBill.count({ where: { projectId: ss3.id, workspaceId: workspace.id, billNumber: { startsWith: 'VB-UAT-RSPAD-' } } })
    assert(ss3PayrollAllocations === 0 && ss3UatExpenses === 0 && ss3VendorBills === 0, 'Completed SS3 tidak boleh terkena biaya company-wide UAT baru.')
  }

  if (failures.length) {
    console.error('=== COMPANY-WIDE UAT FAILED ===')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log('=== COMPANY-WIDE UAT PASSED ===')
  console.log(`Workspace: ${workspace.name}`)
  console.log(`Owner: ${owner.email}`)
  console.log(`Employees: ${employees.length}`)
  console.log('Payroll September: PAID / gross 83m / net 78.25m')
  console.log('Expenses: 6 APPROVED + 1 PENDING')
  console.log('Vendor Bills: 1 PAID 125m + 1 APPROVED UNPAID 40m')
  console.log('Banks: BCA default + Mandiri project')
  console.log('Budgets: 8 September categories')
  console.log('Accounting periods: 2026-08 and 2026-09 OPEN')
  console.log('Bank reconciliation: DRAFT with intentional 750k unmatched bank item')
}

main()
  .catch((error) => {
    console.error('COMPANY-WIDE UAT QA CRASHED')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
