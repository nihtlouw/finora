import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { syncProjectFinancialStatuses } from '@/lib/project-financial-sync'
import { getBillingReadiness } from '@/lib/project-execution'

export const dynamic = 'force-dynamic'

function invoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat membuat invoice dari billing milestone.' }, { status: 403 })

  const { id: projectId, milestoneId } = await params
  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: c.workspace.id },
      include: { client: true },
    })
    if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })

    const milestone = await prisma.billingMilestone.findFirst({
      where: { id: milestoneId, projectId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
        paymentMilestones: { select: { dueDate: true }, orderBy: { sequence: 'asc' }, take: 1 },
      },
    })
    if (!milestone) return NextResponse.json({ error: 'Billing milestone tidak ditemukan.' }, { status: 404 })
    if (milestone.invoice) return NextResponse.json({ error: `Billing milestone ini sudah memiliki invoice ${milestone.invoice.invoiceNumber}.`, invoice: milestone.invoice }, { status: 409 })
    if (!['READY'].includes(milestone.status)) return NextResponse.json({ error: 'Billing milestone harus berstatus READY sebelum dibuatkan invoice.' }, { status: 409 })
    const readiness = await getBillingReadiness(projectId, milestoneId)
    if (!readiness.ready) return NextResponse.json({ error: 'Billing milestone belum memenuhi execution/evidence gate.', missing: readiness.missing }, { status: 409 })

    const dueSource = milestone.paymentMilestones[0]?.dueDate ?? milestone.plannedDate ?? new Date()
    const dueDate = dateOnly(new Date(dueSource).toISOString().slice(0, 10), 'Jatuh tempo invoice')
    const totalAmount = milestone.amount
    const number = invoiceNumber()

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.billingMilestone.findFirst({ where: { id: milestoneId, projectId }, select: { invoice: { select: { id: true, invoiceNumber: true } } } })
      if (existing?.invoice) throw new Error(`Billing milestone ini sudah memiliki invoice ${existing.invoice.invoiceNumber}.`)

      return tx.invoice.create({
        data: {
          clientId: project.clientId,
          projectId,
          billingMilestoneId: milestoneId,
          invoiceNumber: number,
          status: 'UNPAID',
          projectName: project.projectName,
          projectLocation: project.location,
          dueDate,
          subtotalAmount: totalAmount,
          discountPercent: 0,
          discountAmount: 0,
          taxPercent: 0,
          taxAmount: 0,
          totalAmount,
          termsAndConditions: milestone.notes || null,
          items: {
            create: [{
              description: milestone.name,
              qty: 1,
              unit: 'PROJECT_MILESTONE',
              unitPrice: totalAmount,
              category: 'SERVICE',
            }],
          },
        },
        include: { client: true, items: true, payments: true, project: true, billingMilestone: true },
      })
    })

    await syncProjectFinancialStatuses(projectId)
    await writeAuditLog({
      workspaceId: c.workspace.id,
      actorUserId: c.user.id,
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: invoice.id,
      metadata: { projectId, billingMilestoneId: milestoneId, invoiceNumber: invoice.invoiceNumber, total: invoice.totalAmount.toString() },
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat invoice dari billing milestone.' }, { status: 400 })
  }
}
