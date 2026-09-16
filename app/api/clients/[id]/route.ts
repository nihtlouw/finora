import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canDeleteClients, canManageClients, getCurrentFinoraContext } from '@/lib/auth/current-user'
import { validateClientVendorPayload } from '@/lib/validation/client-vendor'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function getOwnedClient(id: string, workspaceId: string) {
  return prisma.clientVendor.findFirst({ where: { id, workspaceId } })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })

  const { id } = await params
  const client = await prisma.clientVendor.findFirst({
    where: { id, workspaceId: context.workspace.id },
    include: {
      proposals: {
        select: { id: true, proposalNumber: true, status: true, totalAmount: true, validUntil: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          dueDate: true,
          totalAmount: true,
          createdAt: true,
          payments: { select: { id: true, amount: true, paymentDate: true, method: true, createdAt: true }, orderBy: { paymentDate: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      expenses: {
        select: { id: true, category: true, amount: true, expenseDate: true, status: true, createdAt: true },
        orderBy: { expenseDate: 'desc' },
      },
    },
  })

  if (!client) return NextResponse.json({ error: 'Kontak tidak ditemukan.' }, { status: 404 })

  const proposals = client.proposals.map((item) => ({ ...item, totalAmount: Number(item.totalAmount) }))
  const invoices = client.invoices.map((invoice) => {
    const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return {
      ...invoice,
      totalAmount: Number(invoice.totalAmount),
      paidAmount,
      outstandingAmount: Math.max(Number(invoice.totalAmount) - paidAmount, 0),
      payments: invoice.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
    }
  })
  const expenses = client.expenses.map((item) => ({ ...item, amount: Number(item.amount) }))

  const invoiceTotal = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
  const paidTotal = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0)
  const outstandingTotal = invoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const approvedExpenseTotal = expenses.filter((expense) => expense.status === 'APPROVED').reduce((sum, expense) => sum + expense.amount, 0)
  const pendingExpenseTotal = expenses.filter((expense) => expense.status === 'PENDING').reduce((sum, expense) => sum + expense.amount, 0)

  const history = [
    ...proposals.map((proposal) => ({
      id: `proposal-${proposal.id}`,
      kind: 'PROPOSAL',
      date: proposal.createdAt,
      title: proposal.proposalNumber,
      description: `Proposal ${proposal.status.toLowerCase()}`,
      amount: proposal.totalAmount,
      href: `/proposals?focus=${proposal.id}`,
    })),
    ...invoices.flatMap((invoice) => [
      {
        id: `invoice-${invoice.id}`,
        kind: 'INVOICE',
        date: invoice.createdAt,
        title: invoice.invoiceNumber,
        description: `Invoice ${invoice.status.toLowerCase()}`,
        amount: invoice.totalAmount,
        href: `/invoices?focus=${invoice.id}`,
      },
      ...invoice.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        kind: 'PAYMENT',
        date: payment.paymentDate,
        title: invoice.invoiceNumber,
        description: `Pembayaran ${payment.method}`,
        amount: payment.amount,
        href: `/payments?focus=${payment.id}`,
      })),
    ]),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      kind: 'EXPENSE',
      date: expense.expenseDate,
      title: expense.category,
      description: `Expense ${expense.status.toLowerCase()}`,
      amount: expense.amount,
      href: `/expenses?focus=${expense.id}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      type: client.type,
      category: client.category,
      offerings: client.offerings,
      email: client.email,
      phone: client.phone,
      picName: client.picName,
      address: client.address,
      npwp: client.npwp,
      isActive: client.isActive,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    },
    summary: {
      proposalCount: proposals.length,
      invoiceCount: invoices.length,
      paymentCount: invoices.reduce((sum, invoice) => sum + invoice.payments.length, 0),
      invoiceTotal,
      paidTotal,
      outstandingTotal,
      expenseCount: expenses.length,
      expenseTotal,
      approvedExpenseTotal,
      pendingExpenseTotal,
    },
    history,
    proposals,
    invoices,
    expenses,
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })
  if (!canManageClients(context.user.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengubah kontak.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getOwnedClient(id, context.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Kontak tidak ditemukan.' }, { status: 404 })

  try {
    const payload = validateClientVendorPayload(await request.json())
    const duplicate = await prisma.clientVendor.findFirst({
      where: {
        workspaceId: context.workspace.id,
        id: { not: id },
        name: { equals: payload.name, mode: 'insensitive' },
        type: payload.type,
      },
    })

    if (duplicate) return NextResponse.json({ error: 'Kontak dengan nama dan tipe tersebut sudah ada.' }, { status: 409 })

    const client = await prisma.clientVendor.update({ where: { id }, data: payload })
    await writeAuditLog({ workspaceId: context.workspace.id, actorUserId: context.user.id, action: 'UPDATE', entityType: 'CLIENT_VENDOR', entityId: client.id, metadata: { type: client.type, name: client.name } })
    return NextResponse.json({ client })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui kontak.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })
  if (!canDeleteClients(context.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner atau Finance yang dapat menonaktifkan kontak.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getOwnedClient(id, context.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Kontak tidak ditemukan.' }, { status: 404 })

  const linkedCounts = await prisma.$transaction([
    prisma.proposal.count({ where: { clientId: id } }),
    prisma.invoice.count({ where: { clientId: id } }),
    prisma.expense.count({ where: { vendorId: id } }),
  ])

  const hasHistory = linkedCounts.some((count) => count > 0)
  const client = hasHistory
    ? await prisma.clientVendor.update({ where: { id }, data: { isActive: false } })
    : await prisma.clientVendor.delete({ where: { id } })

  await writeAuditLog({ workspaceId: context.workspace.id, actorUserId: context.user.id, action: hasHistory ? 'ARCHIVE' : 'DELETE', entityType: 'CLIENT_VENDOR', entityId: client.id, metadata: { hadHistory: hasHistory } })
  return NextResponse.json({ client, action: hasHistory ? 'archived' : 'deleted' })
}
