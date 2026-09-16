import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, optionalText, requireText } from '@/lib/validation/finance'
import { centsToDecimalString, EXPENSE_CATEGORY_OPTIONS, normalizeExpenseAllocations, normalizeExpenseItems } from '@/lib/expenses'
import { positiveMoney } from '@/lib/validation/finance'

export const dynamic = 'force-dynamic'

const ROLES = ['OWNER', 'FINANCE']
const VALID_CATEGORIES = new Set<string>(EXPENSE_CATEGORY_OPTIONS.map((x) => x.value))

const expenseInclude = {
  vendor: true,
  project: { select: { id: true, projectCode: true, projectName: true, status: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
  attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  allocations: { include: { project: { select: { id: true, projectCode: true, projectName: true } } }, orderBy: { percentage: 'desc' as const } },
}

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const rows = await prisma.expense.findMany({
    where: { workspaceId: c.workspace.id },
    include: expenseInclude,
    orderBy: { expenseDate: 'desc' },
  })
  return NextResponse.json({ expenses: rows, categories: EXPENSE_CATEGORY_OPTIONS })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!ROLES.includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengelola biaya.' }, { status: 403 })

  try {
    const b = await req.json()
    const projectId = requireText(b.projectId, 'Project', 100)
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: c.workspace.id },
      select: { id: true, projectCode: true, projectName: true, status: true },
    })
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan di workspace aktif.' }, { status: 404 })
    if (project.status === 'CANCELLED') return NextResponse.json({ error: 'Project yang dibatalkan tidak dapat menerima biaya baru.' }, { status: 409 })

    const vendorId = b.vendorId ? String(b.vendorId) : ''
    const vendor = vendorId
      ? await prisma.clientVendor.findFirst({ where: { id: vendorId, workspaceId: c.workspace.id, type: 'VENDOR', isActive: true } })
      : null
    const payeeName = optionalText(b.payeeName, 200)
    if (!vendor && !payeeName) return NextResponse.json({ error: 'Isi Vendor master atau Pihak / penerima.' }, { status: 400 })

    const category = requireText(b.category, 'Kategori', 80).toUpperCase()
    if (!VALID_CATEGORIES.has(category)) return NextResponse.json({ error: 'Kategori biaya tidak valid.' }, { status: 400 })
    const description = optionalText(b.description, 1000)
    const paymentMethod = optionalText(b.paymentMethod, 50)
    const receiptUrl = optionalText(b.receiptUrl, 2000)
    const expenseDate = dateOnly(b.expenseDate, 'Tanggal biaya')
    const itemsNormalized = normalizeExpenseItems(b.items)
    const amount = positiveMoney(centsToDecimalString(itemsNormalized.totalCents), 'Total biaya')

    const threshold = BigInt(process.env.FINORA_EXPENSE_APPROVAL_THRESHOLD_CENTS || '500000000')
    const status = amount.cents > threshold ? 'PENDING' : 'APPROVED'
    const allocationType = 'DIRECT'
    const allocations = normalizeExpenseAllocations('DIRECT', [{ projectId, percentage: 100, note: null }], amount.decimal)

    const row = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          workspaceId: c.workspace.id,
          vendorId: vendor?.id || null,
          projectId,
          payeeName,
          category,
          allocationType,
          description,
          paymentMethod,
          receiptUrl,
          amount: amount.decimal,
          expenseDate,
          status,
          settlementStatus: 'UNPAID',
          items: {
            create: itemsNormalized.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalAmount: item.totalAmount,
            })),
          },
        },
      })
      await tx.expenseAllocation.createMany({
        data: allocations.map((a) => ({ expenseId: expense.id, projectId: a.projectId, percentage: a.percentage, amount: centsToDecimalString(a.amountCents), note: a.note })),
      })
      // Approval is an accounting/authorization event, not a cash settlement.
      // Cashflow is created only when the expense is explicitly paid.
      return tx.expense.findUnique({ where: { id: expense.id }, include: expenseInclude })
    })

    await writeAuditLog({
      workspaceId: c.workspace.id,
      actorUserId: c.user.id,
      action: 'CREATE',
      entityType: 'EXPENSE',
      entityId: row!.id,
      metadata: { vendorId: vendor?.id || null, payeeName, projectId, amount: amount.decimal, category, status, itemCount: itemsNormalized.items.length },
    })

    return NextResponse.json({ expense: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal mencatat biaya.' }, { status: 400 })
  }
}
