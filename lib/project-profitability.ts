import { prisma } from '@/lib/db/prisma'

type InvoiceLike = {
  status: string
  totalAmount: number
  payments: { amount: number }[]
  creditNotes?: { amount: number }[]
}

type AllocationLike = {
  amount: number
  expense: {
    id: string
    status: string
    category: string
    allocationType: string
  }
}

export type ProjectProfitability = {
  projectId: string
  projectCode: string
  projectName: string
  clientName: string
  contractValue: number
  billedAmount: number
  collectedAmount: number
  outstandingAmount: number
  billedPct: number
  collectedPct: number
  actualCost: number
  pendingCost: number
  grossProfit: number
  grossMarginPct: number | null
  invoiceCount: number
  approvedExpenseCount: number
  pendingExpenseCount: number
  costByCategory: { category: string; amount: number; pctOfCost: number }[]
  costByAllocationType: { type: string; amount: number }[]
  basis: 'PO_GRAND_TOTAL' | 'PROJECT_CONTRACT_VALUE'
}

const EXCLUDED_INVOICE_STATUSES = new Set(['CANCELLED', 'VOID'])

export function calculateProjectProfitability(input: {
  project: {
    id: string
    projectCode: string
    projectName: string
    clientName: string
    contractValue: number
    poGrandTotal?: number | null
  }
  invoices: InvoiceLike[]
  allocations: AllocationLike[]
  payrollCosts?: { amount: number; status: string }[]
  vendorBillCosts?: { amount: number; status: string }[]
}): ProjectProfitability {
  const hasPoValue = input.project.poGrandTotal != null && Number(input.project.poGrandTotal) > 0
  const contractValue = hasPoValue ? Number(input.project.poGrandTotal) : Number(input.project.contractValue)
  const basis = hasPoValue ? 'PO_GRAND_TOTAL' : 'PROJECT_CONTRACT_VALUE'
  const activeInvoices = input.invoices.filter((invoice) => !EXCLUDED_INVOICE_STATUSES.has(invoice.status))
  const billedAmount = activeInvoices.reduce((sum, invoice) => { const credits = (invoice.creditNotes ?? []).reduce((cs, c) => cs + Number(c.amount), 0); return sum + Math.max(Number(invoice.totalAmount) - credits, 0) }, 0)
  const collectedAmount = activeInvoices.reduce((sum, invoice) => sum + invoice.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0), 0)
  const outstandingAmount = Math.max(billedAmount - collectedAmount, 0)

  const approved = input.allocations.filter((row) => row.expense.status === 'APPROVED')
  const pending = input.allocations.filter((row) => row.expense.status === 'PENDING')
  const actualCost = approved.reduce((sum, row) => sum + Number(row.amount), 0)
  const pendingCost = pending.reduce((sum, row) => sum + Number(row.amount), 0)
  const payrollActual = (input.payrollCosts ?? []).filter((x) => x.status === 'PAID').reduce((s, x) => s + Number(x.amount), 0)
  const vendorBillActual = (input.vendorBillCosts ?? []).filter((x) => ['APPROVED','PARTIAL','PAID'].includes(x.status)).reduce((s, x) => s + Number(x.amount), 0)
  const totalActualCost = actualCost + payrollActual + vendorBillActual
  const grossProfit = contractValue - totalActualCost
  const grossMarginPct = contractValue > 0 ? (grossProfit / contractValue) * 100 : null

  const categoryTotals = new Map<string, number>()
  for (const row of approved) {
    const key = row.expense.category || 'LAINNYA'
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Number(row.amount))
  }
  const costByCategory = [...categoryTotals.entries()]
    .map(([category, amount]) => ({ category, amount, pctOfCost: actualCost > 0 ? (amount / actualCost) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)

  const allocationTotals = new Map<string, number>()
  for (const row of approved) {
    const key = row.expense.allocationType || 'UNALLOCATED'
    allocationTotals.set(key, (allocationTotals.get(key) ?? 0) + Number(row.amount))
  }
  const costByAllocationType = [...allocationTotals.entries()]
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => b.amount - a.amount)

  return {
    projectId: input.project.id,
    projectCode: input.project.projectCode,
    projectName: input.project.projectName,
    clientName: input.project.clientName,
    contractValue,
    billedAmount,
    collectedAmount,
    outstandingAmount,
    billedPct: contractValue > 0 ? (billedAmount / contractValue) * 100 : 0,
    collectedPct: contractValue > 0 ? (collectedAmount / contractValue) * 100 : 0,
    actualCost: totalActualCost,
    pendingCost,
    grossProfit,
    grossMarginPct,
    invoiceCount: activeInvoices.length,
    approvedExpenseCount: new Set(approved.map((row) => row.expense.id)).size,
    pendingExpenseCount: new Set(pending.map((row) => row.expense.id)).size,
    costByCategory,
    costByAllocationType: [...costByAllocationType, ...(payrollActual ? [{ type: 'PAYROLL', amount: payrollActual }] : []), ...(vendorBillActual ? [{ type: 'VENDOR_BILL', amount: vendorBillActual }] : [])],
    basis,
  }
}

export async function getProjectProfitability(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      id: true,
      projectCode: true,
      projectName: true,
      contractValue: true,
      client: { select: { name: true } },
      customerPO: { select: { grandTotal: true } },
    },
  })
  if (!project) return null

  const [invoices, allocations, payroll, vendorBills] = await Promise.all([
    prisma.invoice.findMany({
      where: { projectId: project.id },
      select: {
        status: true,
        totalAmount: true,
        payments: { select: { amount: true } },
        creditNotes: { where: { status: 'ISSUED' }, select: { totalAmount: true } },
      },
    }),
    prisma.expenseAllocation.findMany({
      where: {
        projectId: project.id,
        expense: { workspaceId, status: { in: ['APPROVED', 'PENDING'] } },
      },
      select: {
        amount: true,
        expense: { select: { id: true, status: true, category: true, allocationType: true } },
      },
    }),
    prisma.payrollAllocation.findMany({ where: { projectId: project.id, payrollLine: { payrollRun: { workspaceId } } }, select: { amount: true, payrollLine: { select: { payrollRun: { select: { status: true } } } } } }),
    prisma.vendorBill.findMany({ where: { projectId: project.id, workspaceId }, select: { totalAmount: true, status: true, expenseId: true } }),
  ])

  return calculateProjectProfitability({
    project: {
      id: project.id,
      projectCode: project.projectCode,
      projectName: project.projectName,
      clientName: project.client.name,
      contractValue: Number(project.contractValue),
      poGrandTotal: project.customerPO ? Number(project.customerPO.grandTotal) : null,
    },
    invoices: invoices.map((invoice) => ({
      status: invoice.status,
      totalAmount: Number(invoice.totalAmount),
      payments: invoice.payments.map((payment) => ({ amount: Number(payment.amount) })),
      creditNotes: invoice.creditNotes.map((note) => ({ amount: Number(note.totalAmount) })),
    })),
    allocations: allocations.map((allocation) => ({ amount: Number(allocation.amount), expense: allocation.expense })),
    payrollCosts: payroll.map((row) => ({ amount: Number(row.amount), status: row.payrollLine.payrollRun.status })),
    vendorBillCosts: vendorBills.filter((x) => !x.expenseId).map((row) => ({ amount: Number(row.totalAmount), status: row.status })),
  })
}
