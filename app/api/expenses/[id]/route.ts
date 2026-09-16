import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { dateOnly, optionalText, requireText, positiveMoney } from '@/lib/validation/finance'
import { centsToDecimalString, EXPENSE_CATEGORY_OPTIONS, normalizeExpenseAllocations, normalizeExpenseItems } from '@/lib/expenses'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

const ROLES = ['OWNER', 'FINANCE']
const VALID_CATEGORIES = new Set<string>(EXPENSE_CATEGORY_OPTIONS.map((x) => x.value))

const includeExpense = {
  vendor: true,
  project: { select: { id: true, projectCode: true, projectName: true, status: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
  attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  allocations: { include: { project: { select: { id: true, projectCode: true, projectName: true } } }, orderBy: { percentage: 'desc' as const } },
  cashflow: true,
}

async function getOwned(id: string, workspaceId: string) {
  return prisma.expense.findFirst({ where: { id, workspaceId }, include: includeExpense })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id } = await params

  try {
    const expense = await prisma.expense.findFirst({
      where: { id, workspaceId: c.workspace.id },
      select: {
        id: true,
        vendorId: true,
        projectId: true,
        category: true,
        amount: true,
        expenseDate: true,
        status: true,
        description: true,
        paymentMethod: true,
        payeeName: true,
      },
    })

    if (!expense) return NextResponse.json({ error: 'Biaya tidak ditemukan.' }, { status: 404 })

    const [vendor, project, items, attachments, cashflow] = await Promise.all([
      expense.vendorId
        ? prisma.clientVendor.findFirst({
            where: { id: expense.vendorId, workspaceId: c.workspace.id, type: 'VENDOR' },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      expense.projectId
        ? prisma.project.findFirst({
            where: { id: expense.projectId, workspaceId: c.workspace.id },
            select: { id: true, projectCode: true, projectName: true, status: true },
          })
        : Promise.resolve(null),
      prisma.expenseItem.findMany({
        where: { expenseId: id },
        select: { id: true, description: true, quantity: true, unit: true, unitPrice: true, totalAmount: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.expenseAttachment.findMany({
        where: { expenseId: id },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.cashflowTransaction.findMany({
        where: { expenseId: id, workspaceId: c.workspace.id },
        select: { id: true, type: true, category: true, amount: true, transactionDate: true, sourceRef: true },
        orderBy: { transactionDate: 'desc' },
      }),
    ])

    return NextResponse.json({
      expense: {
        id: expense.id,
        category: expense.category,
        amount: Number(expense.amount),
        expenseDate: expense.expenseDate.toISOString(),
        status: expense.status,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
        payeeName: expense.payeeName,
        vendor,
        project,
        items: items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalAmount: Number(item.totalAmount),
        })),
        attachments: attachments.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          createdAt: file.createdAt.toISOString(),
        })),
        cashflow: cashflow.map((row) => ({
          id: row.id,
          type: row.type,
          category: row.category,
          amount: Number(row.amount),
          transactionDate: row.transactionDate.toISOString(),
          sourceRef: row.sourceRef,
        })),
      },
    })
  } catch (e) {
    console.error('[expenses/:id][GET]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gagal memuat detail expense.' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!ROLES.includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengelola biaya.' }, { status: 403 })
  const { id } = await params
  const existing = await getOwned(id, c.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Biaya tidak ditemukan.' }, { status: 404 })
  if (existing.status === 'APPROVED') return NextResponse.json({ error: 'Biaya yang sudah disetujui dikunci dan tidak dapat diubah. Gunakan proses koreksi/void untuk perubahan setelah approval.' }, { status: 409 })

  try {
    const b = await req.json()
    const projectId = requireText(b.projectId, 'Project', 100)
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: c.workspace.id }, select: { id: true, status: true } })
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan di workspace aktif.' }, { status: 404 })
    if (project.status === 'CANCELLED') return NextResponse.json({ error: 'Project yang dibatalkan tidak dapat menerima biaya baru.' }, { status: 409 })

    const vendorId = b.vendorId ? String(b.vendorId) : ''
    const vendor = vendorId
      ? await prisma.clientVendor.findFirst({ where: { id: vendorId, workspaceId: c.workspace.id, type: 'VENDOR', isActive: true } })
      : null
    const payeeName = optionalText(b.payeeName, 200)
    if (!vendor && !payeeName) return NextResponse.json({ error: 'Isi Vendor master atau Pihak / penerima.' }, { status: 400 })
    const category = requireText(b.category, 'Kategori', 80).toUpperCase()
    if (!VALID_CATEGORIES.has(category)) throw new Error('Kategori biaya tidak valid.')
    const description = optionalText(b.description, 1000)
    const paymentMethod = optionalText(b.paymentMethod, 50)
    const receiptUrl = optionalText(b.receiptUrl, 2000)
    const expenseDate = dateOnly(b.expenseDate, 'Tanggal biaya')
    await assertAccountingPeriodOpen(c.workspace.id, expenseDate)
    const normalized = normalizeExpenseItems(b.items)
    const amount = positiveMoney(centsToDecimalString(normalized.totalCents), 'Total biaya')
    const allocations = normalizeExpenseAllocations('DIRECT', [{ projectId, percentage: 100, note: null }], amount.decimal)

    const row = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.update({
        where: { id },
        data: {
          vendorId: vendor?.id || null,
          projectId,
          payeeName,
          category,
          allocationType: 'DIRECT',
          description,
          paymentMethod,
          receiptUrl,
          amount: amount.decimal,
          expenseDate,
        },
      })
      await tx.expenseItem.deleteMany({ where: { expenseId: id } })
      await tx.expenseItem.createMany({
        data: normalized.items.map((item) => ({ expenseId: id, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, totalAmount: item.totalAmount })),
      })
      await tx.expenseAllocation.deleteMany({ where: { expenseId: id } })
      await tx.expenseAllocation.createMany({ data: allocations.map((a) => ({ expenseId: id, projectId: a.projectId, percentage: a.percentage, amount: centsToDecimalString(a.amountCents), note: a.note })) })
      return tx.expense.findUnique({ where: { id }, include: includeExpense })
    })

    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE', entityType: 'EXPENSE', entityId: id, metadata: { projectId, amount: amount.decimal, category, itemCount: normalized.items.length } })
    return NextResponse.json({ expense: row })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui biaya.' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!ROLES.includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat menghapus biaya.' }, { status: 403 })
  const { id } = await params
  const existing = await getOwned(id, c.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Biaya tidak ditemukan.' }, { status: 404 })
  if (existing.status === 'APPROVED') return NextResponse.json({ error: 'Biaya yang sudah disetujui tidak dapat dihapus. Gunakan proses koreksi/void agar jejak audit tetap terjaga.' }, { status: 409 })
  try { await assertAccountingPeriodOpen(c.workspace.id, existing.expenseDate) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Periode terkunci.' }, { status: 409 }) }
  await prisma.$transaction(async tx => {
    await tx.cashflowTransaction.deleteMany({ where: { expenseId: id } })
    await tx.expense.delete({ where: { id } })
  })
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'DELETE', entityType: 'EXPENSE', entityId: id, metadata: { status: existing.status } })
  return NextResponse.json({ ok: true })
}
