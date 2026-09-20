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

const date = (value: string) => new Date(`${value}T00:00:00.000Z`)
const money = (value: number) => value.toFixed(2)
const pct = (value: number) => value.toFixed(2)

async function getOwnerContext() {
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

const EMPLOYEES = [
  { employeeNo: 'EMP-001', name: 'Andi Pratama', position: 'Project Manager', department: 'Project', employmentType: 'FULL_TIME', salary: 18_000_000, bank: 'BCA', account: '3901000001' },
  { employeeNo: 'EMP-002', name: 'Budi Santoso', position: 'Site Engineer', department: 'Engineering', employmentType: 'FULL_TIME', salary: 12_000_000, bank: 'BCA', account: '3901000002' },
  { employeeNo: 'EMP-003', name: 'Citra Lestari', position: 'Finance Officer', department: 'Finance', employmentType: 'FULL_TIME', salary: 10_000_000, bank: 'Mandiri', account: '1409000003' },
  { employeeNo: 'EMP-004', name: 'Dedi Kurniawan', position: 'Procurement Officer', department: 'Procurement', employmentType: 'FULL_TIME', salary: 9_000_000, bank: 'BCA', account: '3901000004' },
  { employeeNo: 'EMP-005', name: 'Eko Saputra', position: 'Electrical Engineer', department: 'Engineering', employmentType: 'FULL_TIME', salary: 11_000_000, bank: 'BCA', account: '3901000005' },
  { employeeNo: 'EMP-006', name: 'Fajar Hidayat', position: 'HSE Officer', department: 'HSE', employmentType: 'FULL_TIME', salary: 8_500_000, bank: 'BCA', account: '3901000006' },
  { employeeNo: 'EMP-007', name: 'Guntur Wijaya', position: 'Electrical Technician', department: 'Engineering', employmentType: 'CONTRACT', salary: 7_500_000, bank: 'Mandiri', account: '1409000007' },
  { employeeNo: 'EMP-008', name: 'Hendra', position: 'Electrical Technician', department: 'Engineering', employmentType: 'CONTRACT', salary: 7_000_000, bank: 'BCA', account: '3901000008' },
] as const

type PayrollLineSeed = {
  employeeNo: string
  gross: number
  pph21: number
  bpjs: number
  other: number
  allocations: Array<{ projectCode: string; percentage: number }>
}

const PAYROLL_LINES: PayrollLineSeed[] = [
  { employeeNo: 'EMP-001', gross: 18_000_000, pph21: 900_000, bpjs: 450_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 60 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 40 }] },
  { employeeNo: 'EMP-002', gross: 12_000_000, pph21: 450_000, bpjs: 300_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 80 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 20 }] },
  { employeeNo: 'EMP-003', gross: 10_000_000, pph21: 300_000, bpjs: 250_000, other: 100_000, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 50 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 50 }] },
  { employeeNo: 'EMP-004', gross: 9_000_000, pph21: 225_000, bpjs: 225_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 70 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 30 }] },
  { employeeNo: 'EMP-005', gross: 11_000_000, pph21: 350_000, bpjs: 275_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 80 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 20 }] },
  { employeeNo: 'EMP-006', gross: 8_500_000, pph21: 175_000, bpjs: 200_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 60 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 40 }] },
  { employeeNo: 'EMP-007', gross: 7_500_000, pph21: 100_000, bpjs: 175_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 80 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 20 }] },
  { employeeNo: 'EMP-008', gross: 7_000_000, pph21: 100_000, bpjs: 175_000, other: 0, allocations: [{ projectCode: 'FIN-UAT-RSPAD-ONGOING-2026', percentage: 50 }, { projectCode: 'FIN-UAT-CIKARANG-STALLED-2026', percentage: 50 }] },
]

async function ensureVendor(workspaceId: string) {
  const existing = await prisma.clientVendor.findFirst({
    where: { workspaceId, type: 'VENDOR', name: 'PT Maju Teknik Nusantara' },
  })
  if (existing) {
    return prisma.clientVendor.update({
      where: { id: existing.id },
      data: {
        category: 'SUBKONTRAKTOR ELECTRICAL',
        offerings: 'Subcontractor electrical installation, cable pulling, testing and site support',
        isActive: true,
      },
    })
  }

  return prisma.clientVendor.create({
    data: {
      workspaceId,
      name: 'PT Maju Teknik Nusantara',
      type: 'VENDOR',
      category: 'SUBKONTRAKTOR ELECTRICAL',
      offerings: 'Subcontractor electrical installation, cable pulling, testing and site support',
      isActive: true,
    },
  })
}

async function ensureBank(workspaceId: string, name: string, bankName: string, accountNumber: string, openingBalance: number, isDefault: boolean) {
  const existing = await prisma.bankAccount.findFirst({ where: { workspaceId, name } })
  if (existing) {
    if (isDefault) {
      await prisma.bankAccount.updateMany({ where: { workspaceId, id: { not: existing.id } }, data: { isDefault: false } })
    }
    return prisma.bankAccount.update({
      where: { id: existing.id },
      data: { bankName, accountNumber, openingBalance: money(openingBalance), currency: 'IDR', isActive: true, isDefault },
    })
  }

  if (isDefault) await prisma.bankAccount.updateMany({ where: { workspaceId }, data: { isDefault: false } })

  return prisma.bankAccount.create({
    data: {
      workspaceId,
      name,
      bankName,
      accountNumber,
      openingBalance: money(openingBalance),
      currency: 'IDR',
      isActive: true,
      isDefault,
    },
  })
}

async function ensurePeriods(workspaceId: string) {
  for (const period of ['2026-08', '2026-09', '2026-10']) {
    await prisma.accountingPeriod.upsert({
      where: { workspaceId_period: { workspaceId, period } },
      update: { status: 'OPEN', closedAt: null, closedByUserId: null },
      create: { workspaceId, period, status: 'OPEN' },
    })
  }
}

async function seedEmployees(workspaceId: string) {
  for (const item of EMPLOYEES) {
    await prisma.employee.upsert({
      where: { workspaceId_employeeNo: { workspaceId, employeeNo: item.employeeNo } },
      update: {
        name: item.name,
        email: `${item.employeeNo.toLowerCase()}@finora-uat.invalid`,
        maritalStatus: 'TK/0',
        position: item.position,
        department: item.department,
        employmentType: item.employmentType,
        joinDate: date(item.employeeNo === 'EMP-007' || item.employeeNo === 'EMP-008' ? '2026-01-15' : '2024-03-01'),
        baseSalary: money(item.salary),
        bankName: item.bank,
        bankAccount: item.account,
        isActive: true,
      },
      create: {
        workspaceId,
        employeeNo: item.employeeNo,
        name: item.name,
        email: `${item.employeeNo.toLowerCase()}@finora-uat.invalid`,
        maritalStatus: 'TK/0',
        baseSalary: money(item.salary),
        bankName: item.bank,
        bankAccount: item.account,
        isActive: true,
      },
    })
  }
}

async function seedPayroll(workspaceId: string, ownerId: string) {
  const projectRows = await prisma.project.findMany({
    where: {
      workspaceId,
      projectCode: { in: ['FIN-UAT-RSPAD-ONGOING-2026', 'FIN-UAT-CIKARANG-STALLED-2026'] },
    },
    select: { id: true, projectCode: true },
  })

  const projects = new Map(projectRows.map((x) => [x.projectCode, x.id]))
  for (const code of ['FIN-UAT-RSPAD-ONGOING-2026', 'FIN-UAT-CIKARANG-STALLED-2026']) {
    if (!projects.has(code)) throw new Error(`Project payroll tidak ditemukan: ${code}`)
  }

  const existingRun = await prisma.payrollRun.findFirst({ where: { workspaceId, period: '2026-09' } })
  if (existingRun) {
    await prisma.cashflowTransaction.deleteMany({ where: { payrollRunId: existingRun.id } })
    await prisma.payrollRun.delete({ where: { id: existingRun.id } })
  }

  const employees = await prisma.employee.findMany({ where: { workspaceId, employeeNo: { in: EMPLOYEES.map((x) => x.employeeNo) } } })
  const byNo = new Map(employees.map((x) => [x.employeeNo, x.id]))

  const grossTotal = PAYROLL_LINES.reduce((s, x) => s + x.gross, 0)
  const deductionTotal = PAYROLL_LINES.reduce((s, x) => s + x.pph21 + x.bpjs + x.other, 0)
  const netTotal = grossTotal - deductionTotal

  const run = await prisma.payrollRun.create({
    data: {
      workspaceId,
      runNumber: 'PAY-2026-09-001',
      period: '2026-09',
      status: 'PAID',
      payDate: date('2026-09-19'),
      grossAmount: money(grossTotal),
      deductionAmount: money(deductionTotal),
      netAmount: money(netTotal),
      approvedAt: date('2026-09-20'),
      approvedByUserId: ownerId,
      paidAt: date('2026-09-19'),
      paidByUserId: ownerId,
      lines: {
        create: PAYROLL_LINES.map((line) => {
          const employeeId = byNo.get(line.employeeNo)
          if (!employeeId) throw new Error(`Employee payroll tidak ditemukan: ${line.employeeNo}`)
          const net = line.gross - line.pph21 - line.bpjs - line.other
          return {
            employeeId,
            grossAmount: money(line.gross),
            taxableAmount: money(line.gross),
            pph21Amount: money(line.pph21),
            bpjsAmount: money(line.bpjs),
            otherDeduction: money(line.other),
            netAmount: money(net),
            allocations: {
              create: line.allocations.map((allocation) => ({
                projectId: projects.get(allocation.projectCode)!,
                percentage: pct(allocation.percentage),
                amount: money((line.gross * allocation.percentage) / 100),
              })),
            },
          }
        }),
      },
    },
    include: { lines: true },
  })

  await prisma.cashflowTransaction.create({
    data: {
      workspaceId,
      type: 'EXPENSE',
      category: 'PAYROLL',
      amount: money(netTotal),
      transactionDate: date('2026-09-25'),
      sourceRef: `PAYROLL:${run.id}`,
      payrollRunId: run.id,
    },
  })

  return { grossTotal, deductionTotal, netTotal, runId: run.id }
}

async function removeSeedExpense(workspaceId: string, key: string) {
  const rows = await prisma.expense.findMany({ where: { workspaceId, description: { startsWith: key } }, select: { id: true } })
  if (!rows.length) return
  const ids = rows.map((x) => x.id)
  await prisma.cashflowTransaction.deleteMany({ where: { expenseId: { in: ids } } })
  await prisma.expense.deleteMany({ where: { id: { in: ids } } })
}

async function createExpense(input: {
  workspaceId: string
  ownerId: string
  projectId?: string | null
  vendorId?: string | null
  payeeName?: string | null
  category: string
  descriptionKey: string
  description: string
  amount: number
  expenseDate: string
  allocations: Array<{ projectId: string; percentage: number; note?: string }>
  status?: 'APPROVED' | 'PENDING'
}) {
  await removeSeedExpense(input.workspaceId, input.descriptionKey)

  const amount = input.amount
  const status = input.status ?? 'APPROVED'
  const expense = await prisma.expense.create({
    data: {
      workspaceId: input.workspaceId,
      vendorId: input.vendorId ?? null,
      projectId: input.projectId ?? null,
      payeeName: input.payeeName ?? null,
      category: input.category,
      allocationType: input.allocations.length > 1 ? 'SHARED' : 'DIRECT',
      description: `${input.descriptionKey} ${input.description}`,
      paymentMethod: status === 'APPROVED' ? 'BANK_TRANSFER' : null,
      settlementStatus: status === 'APPROVED' ? 'PAID' : 'UNPAID',
      paidAt: status === 'APPROVED' ? date(input.expenseDate) : null,
      paidBy: status === 'APPROVED' ? input.ownerId : null,
      amount: money(amount),
      expenseDate: date(input.expenseDate),
      status,
      approvedBy: status === 'APPROVED' ? input.ownerId : null,
      items: {
        create: [{
          description: input.description,
          quantity: '1',
          unit: 'LOT',
          unitPrice: money(amount),
          totalAmount: money(amount),
        }],
      },
      allocations: {
        create: input.allocations.map((allocation) => ({
          projectId: allocation.projectId,
          percentage: pct(allocation.percentage),
          amount: money((amount * allocation.percentage) / 100),
          note: allocation.note ?? null,
        })),
      },
    },
  })

  if (status === 'APPROVED') {
    await prisma.cashflowTransaction.create({
      data: {
        workspaceId: input.workspaceId,
        type: 'EXPENSE',
        category: input.category,
        amount: money(amount),
        transactionDate: date(input.expenseDate),
        sourceRef: `UAT-CO-EXPENSE:${expense.id}`,
        expenseId: expense.id,
      },
    })
  }

  return expense
}

async function seedVendorBills(workspaceId: string, ownerId: string, vendorId: string, bankId: string) {
  const project = await prisma.project.findFirst({ where: { workspaceId, projectCode: 'FIN-UAT-RSPAD-ONGOING-2026' } })
  if (!project) throw new Error('Project RSPAD tidak ditemukan.')

  const old = await prisma.vendorBill.findMany({
    where: { workspaceId, billNumber: { in: ['VB-UAT-RSPAD-001', 'VB-UAT-RSPAD-002'] } },
    select: { id: true },
  })
  if (old.length) {
    const oldIds = old.map((x) => x.id)
    const payments = await prisma.vendorBillPayment.findMany({ where: { vendorBillId: { in: oldIds } }, select: { id: true } })
    const paymentIds = payments.map((x) => x.id)
    if (paymentIds.length) await prisma.cashflowTransaction.deleteMany({ where: { vendorBillPaymentId: { in: paymentIds } } })
    await prisma.vendorBillPayment.deleteMany({ where: { vendorBillId: { in: oldIds } } })
    await prisma.vendorBill.deleteMany({ where: { id: { in: oldIds } } })
  }

  const paidBill = await prisma.vendorBill.create({
    data: {
      workspaceId,
      vendorId,
      projectId: project.id,
      billNumber: 'VB-UAT-RSPAD-001',
      supplierInvoiceNo: 'MTN/INV/089/IX/2026',
      billDate: date('2026-09-08'),
      dueDate: date('2026-09-15'),
      status: 'PAID',
      subtotalAmount: money(112_612_613),
      taxAmount: money(12_387_387),
      totalAmount: money(125_000_000),
      approvedAt: date('2026-09-09'),
      approvedByUserId: ownerId,
      notes: 'Subcontractor electrical installation and site support; paid from BCA Operasional.',
    },
  })

  const payment = await prisma.vendorBillPayment.create({
    data: {
      vendorBillId: paidBill.id,
      bankAccountId: bankId,
      paymentDate: date('2026-09-10'),
      amount: money(125_000_000),
      method: 'TRANSFER',
      reference: 'TRF-MTN-20260910-001',
    },
  })

  await prisma.cashflowTransaction.create({
    data: {
      workspaceId,
      type: 'EXPENSE',
      category: 'VENDOR_BILL',
      amount: money(125_000_000),
      transactionDate: date('2026-09-10'),
      sourceRef: `VENDOR_BILL_PAYMENT:${payment.id}`,
      vendorBillPaymentId: payment.id,
      bankAccountId: bankId,
    },
  })

  const openBill = await prisma.vendorBill.create({
    data: {
      workspaceId,
      vendorId,
      projectId: project.id,
      billNumber: 'VB-UAT-RSPAD-002',
      supplierInvoiceNo: 'MTN/INV/103/IX/2026',
      billDate: date('2026-09-16'),
      dueDate: date('2026-09-30'),
      status: 'APPROVED',
      subtotalAmount: money(36_036_036),
      taxAmount: money(3_963_964),
      totalAmount: money(40_000_000),
      approvedAt: date('2026-09-17'),
      approvedByUserId: ownerId,
      notes: 'Approved vendor bill awaiting settlement; intentionally remains unpaid for AP UAT.',
    },
  })

  return { paidBillId: paidBill.id, openBillId: openBill.id }
}

async function seedBudgets(workspaceId: string) {
  const categories = [
    ['PAYROLL', 90_000_000],
    ['VENDOR_BILL', 150_000_000],
    ['MATERIAL', 30_000_000],
    ['TRANSPORT', 12_000_000],
    ['JASA_SUBKON', 10_000_000],
    ['OPERASIONAL_UMUM', 8_000_000],
    ['LOGISTIK', 15_000_000],
    ['SEWA_PERALATAN', 12_000_000],
  ] as const

  await prisma.budget.deleteMany({
    where: {
      workspaceId,
      period: '2026-09',
      category: { in: categories.map(([category]) => category) },
    },
  })

  await prisma.budget.createMany({
    data: categories.map(([category, plannedAmount]) => ({
      workspaceId,
      category,
      period: '2026-09',
      plannedAmount: money(plannedAmount),
    })),
  })
}

async function seedCreditNote(workspaceId: string, ownerId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { project: { workspaceId, projectCode: 'FIN-UAT-RSPAD-ONGOING-2026' } },
    orderBy: { createdAt: 'asc' },
  })
  if (!invoice) return null

  const number = 'CN-UAT-RSPAD-DRAFT-001'
  await prisma.creditNote.deleteMany({ where: { workspaceId, number } })

  return prisma.creditNote.create({
    data: {
      workspaceId,
      invoiceId: invoice.id,
      number,
      status: 'DRAFT',
      issueDate: date('2026-09-18'),
      reason: 'Draft credit note for UAT only: minor commercial adjustment under review; not issued and does not reduce revenue.',
      subtotalAmount: money(1_800_000),
      taxAmount: money(0),
      totalAmount: money(1_800_000),
      issuedByUserId: ownerId,
      notes: 'UAT draft only.',
    },
  })
}

async function linkExistingCashflowsToBank(workspaceId: string, bankId: string) {
  await prisma.cashflowTransaction.updateMany({
    where: {
      workspaceId,
      bankAccountId: null,
      transactionDate: { gte: date('2026-08-01'), lt: date('2026-10-01') },
    },
    data: { bankAccountId: bankId },
  })
}

async function seedBankStatementsAndReconciliation(workspaceId: string, bankId: string, ownerId: string) {
  await prisma.bankStatementTransaction.deleteMany({
    where: {
      workspaceId,
      externalId: { startsWith: 'UAT-BCA-SEP-2026-' },
    },
  })

  const cashflows = await prisma.cashflowTransaction.findMany({
    where: {
      workspaceId,
      bankAccountId: bankId,
      transactionDate: { gte: date('2026-09-01'), lt: date('2026-10-01') },
    },
    orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
  })

  let running = 1_850_000_000
  for (let i = 0; i < cashflows.length; i += 1) {
    const flow = cashflows[i]
    const amount = Number(flow.amount)
    running += flow.type === 'INCOME' ? amount : -amount
    await prisma.bankStatementTransaction.create({
      data: {
        workspaceId,
        bankAccountId: bankId,
        transactionDate: flow.transactionDate,
        direction: flow.type === 'INCOME' ? 'CREDIT' : 'DEBIT',
        amount: money(amount),
        description: flow.sourceRef ? `Matching UAT book transaction ${flow.sourceRef}` : 'UAT book transaction',
        reference: flow.sourceRef || `UAT-BOOK-${i + 1}`,
        externalId: `UAT-BCA-SEP-2026-${String(i + 1).padStart(3, '0')}`,
        matchStatus: 'MATCHED',
        matchedCashflowId: flow.id,
      },
    })
  }

  const unmatchedAmount = 750_000
  running -= unmatchedAmount
  await prisma.bankStatementTransaction.create({
    data: {
      workspaceId,
      bankAccountId: bankId,
      transactionDate: date('2026-09-29'),
      direction: 'DEBIT',
      amount: money(unmatchedAmount),
      description: 'Biaya administrasi bank yang belum dicatat sebagai cashflow buku.',
      reference: 'ADM-BCA-202609-001',
      externalId: 'UAT-BCA-SEP-2026-UNMATCHED-001',
      matchStatus: 'UNMATCHED',
    },
  })

  await prisma.bankReconciliation.upsert({
    where: {
      workspaceId_bankAccountId_periodStart_periodEnd: {
        workspaceId,
        bankAccountId: bankId,
        periodStart: date('2026-09-01'),
        periodEnd: date('2026-09-30'),
      },
    },
    update: {
      status: 'DRAFT',
      statementEndingBalance: money(running),
      bookBalance: money(running + unmatchedAmount),
      difference: money(-unmatchedAmount),
      reconciledAt: null,
      reconciledByUserId: null,
    },
    create: {
      workspaceId,
      bankAccountId: bankId,
      periodStart: date('2026-09-01'),
      periodEnd: date('2026-09-30'),
      status: 'DRAFT',
      statementEndingBalance: money(running),
      bookBalance: money(running + unmatchedAmount),
      difference: money(-unmatchedAmount),
    },
  })

  return { statementCount: cashflows.length + 1, bookBalance: running + unmatchedAmount, statementBalance: running, difference: -unmatchedAmount }
}

async function main() {
  const { owner, workspace } = await getOwnerContext()

  const projectCheck = await prisma.project.findMany({
    where: {
      workspaceId: workspace.id,
      projectCode: { in: ['FIN-UAT-RSPAD-ONGOING-2026', 'FIN-UAT-SS3-COMPLETED-2026', 'FIN-UAT-CIKARANG-STALLED-2026'] },
    },
    select: { id: true, projectCode: true, status: true },
  })
  if (projectCheck.length < 3) {
    throw new Error('UAT THREE PROJECTS belum lengkap. Jalankan seed:uat-three-projects terlebih dahulu.')
  }

  await ensurePeriods(workspace.id)
  const bca = await ensureBank(workspace.id, 'BCA Operasional UAT', 'BCA', '390100009999', 1_850_000_000, true)
  await ensureBank(workspace.id, 'Mandiri Project UAT', 'Mandiri', '140900009999', 350_000_000, false)
  await ensureVendor(workspace.id)
  await seedEmployees(workspace.id)

  const payroll = await seedPayroll(workspace.id, owner.id)

  const vendor = await prisma.clientVendor.findFirst({
    where: { workspaceId: workspace.id, type: 'VENDOR', name: 'PT Maju Teknik Nusantara' },
  })
  if (!vendor) throw new Error('Vendor UAT tidak ditemukan.')

  const rspad = projectCheck.find((x) => x.projectCode === 'FIN-UAT-RSPAD-ONGOING-2026')!
  const cikarang = projectCheck.find((x) => x.projectCode === 'FIN-UAT-CIKARANG-STALLED-2026')!

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: rspad.id,
    category: 'TRANSPORT',
    descriptionKey: 'UAT-CO-EXPENSE:RSPAD-TRANSPORT',
    description: 'Transportasi site, tol, dan parkir selama delivery/installasi.',
    amount: 8_500_000,
    expenseDate: '2026-09-03',
    allocations: [{ projectId: rspad.id, percentage: 100, note: 'Direct RSPAD site cost' }],
  })

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: rspad.id,
    category: 'MATERIAL',
    descriptionKey: 'UAT-CO-EXPENSE:RSPAD-MATERIAL',
    description: 'Material tambahan protection and termination accessories.',
    amount: 24_000_000,
    expenseDate: '2026-09-05',
    allocations: [{ projectId: rspad.id, percentage: 100, note: 'Direct RSPAD material cost' }],
  })

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: cikarang.id,
    category: 'JASA_SUBKON',
    descriptionKey: 'UAT-CO-EXPENSE:CIKARANG-SURVEY',
    description: 'Engineering survey dan site shutdown preparation.',
    amount: 5_000_000,
    expenseDate: '2026-09-08',
    allocations: [{ projectId: cikarang.id, percentage: 100, note: 'Direct stalled-project engineering cost' }],
  })

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: rspad.id,
    category: 'OPERASIONAL_UMUM',
    descriptionKey: 'UAT-CO-EXPENSE:SHARED-OPERATIONS',
    description: 'Koordinasi operasional, meeting vendor, dan dokumentasi lintas proyek.',
    amount: 6_000_000,
    expenseDate: '2026-09-10',
    allocations: [
      { projectId: rspad.id, percentage: 70, note: 'Primary operating project' },
      { projectId: cikarang.id, percentage: 30, note: 'Shared stalled-project support' },
    ],
  })

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: rspad.id,
    category: 'LOGISTIK',
    descriptionKey: 'UAT-CO-EXPENSE:RSPAD-LOGISTICS',
    description: 'Pengiriman equipment dan material ke site.',
    amount: 12_500_000,
    expenseDate: '2026-09-12',
    allocations: [{ projectId: rspad.id, percentage: 100, note: 'Direct delivery cost' }],
  })

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: cikarang.id,
    category: 'SEWA_PERALATAN',
    descriptionKey: 'UAT-CO-EXPENSE:CIKARANG-EQUIPMENT',
    description: 'Sewa alat lifting dan test equipment untuk pekerjaan awal.',
    amount: 10_500_000,
    expenseDate: '2026-09-15',
    allocations: [{ projectId: cikarang.id, percentage: 100, note: 'Direct site equipment cost' }],
  })

  await createExpense({
    workspaceId: workspace.id,
    ownerId: owner.id,
    projectId: cikarang.id,
    category: 'MATERIAL',
    descriptionKey: 'UAT-CO-EXPENSE:CIKARANG-PENDING',
    description: 'Long-lead protection relay and spare parts, waiting for commercial release.',
    amount: 18_000_000,
    expenseDate: '2026-09-18',
    allocations: [{ projectId: cikarang.id, percentage: 100, note: 'Pending stalled-project material' }],
    status: 'PENDING',
  })

  await seedVendorBills(workspace.id, owner.id, vendor.id, bca.id)
  await seedBudgets(workspace.id)

  await linkExistingCashflowsToBank(workspace.id, bca.id)
  const bankRecon = await seedBankStatementsAndReconciliation(workspace.id, bca.id, owner.id)
  const creditNote = await seedCreditNote(workspace.id, owner.id)

  const totals = await prisma.expense.aggregate({
    where: { workspaceId: workspace.id, description: { startsWith: 'UAT-CO-EXPENSE:' } },
    _sum: { amount: true },
  })

  console.log('=== COMPANY-WIDE UAT SEEDED ===')
  console.log(`Workspace: ${workspace.name}`)
  console.log(`Employees: ${await prisma.employee.count({ where: { workspaceId: workspace.id } })}`)
  console.log(`Payroll gross: Rp ${payroll.grossTotal.toLocaleString('id-ID')} | deductions: Rp ${payroll.deductionTotal.toLocaleString('id-ID')} | net: Rp ${payroll.netTotal.toLocaleString('id-ID')}`)
  console.log(`UAT expenses: Rp ${Number(totals._sum.amount ?? 0).toLocaleString('id-ID')} (approved + pending)`)
  console.log('Vendor bills: 1 PAID + 1 APPROVED UNPAID')
  console.log('Budgets: September 2026 seeded for 8 cashflow categories')
  console.log(`Bank statements: ${bankRecon.statementCount} matched/unmatched rows`)
  console.log(`Bank reconciliation draft difference: Rp ${Math.abs(bankRecon.difference).toLocaleString('id-ID')}`)
  console.log(`Draft credit note: ${creditNote ? creditNote.number : 'not created (no invoice found)'}`)
  console.log('Study case is synthetic at company-wide layer; it is not a claim of a real customer payroll or bank ledger.')
}

main()
  .catch((error) => {
    console.error('COMPANY-WIDE UAT SEED FAILED')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
