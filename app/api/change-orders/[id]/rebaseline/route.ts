import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { parseMoneyCents, centsToDecimal, optionalText } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function amountAtPercentage(contractCents: bigint, percentage: string) {
  return centsToDecimal((contractCents * parseMoneyCents(percentage)) / 10000n)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  const { id } = await params
  try {
    const b = await req.json().catch(() => ({}))
    const co = await prisma.contractChangeOrder.findFirst({ where: { id, workspaceId: c.workspace.id }, include: { project: true, contractVersion: true } })
    if (!co) return NextResponse.json({ error: 'Change order tidak ditemukan.' }, { status: 404 })
    if (co.status !== 'APPROVED' || !co.contractVersion) return NextResponse.json({ error: 'Change order harus APPROVED dan memiliki contract version sebelum rebaseline.' }, { status: 409 })
    const contractVersion = co.contractVersion
    const existing = await prisma.billingRebaseline.findFirst({ where: { changeOrderId: id, status: 'APPLIED' } })
    if (existing) return NextResponse.json({ error: 'Rebaseline change order ini sudah diterapkan.', billingRebaseline: existing }, { status: 409 })

    const previousVersion = await prisma.projectContractVersion.findFirst({ where: { projectId: co.projectId, versionNumber: contractVersion.versionNumber - 1 }, select: { contractValue: true } })
    if (!previousVersion) return NextResponse.json({ error: 'Contract version sebelumnya tidak ditemukan; rebaseline dibatalkan.' }, { status: 409 })

    const billing = await prisma.billingMilestone.findMany({ where: { projectId: co.projectId }, orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, name: true, percentage: true, amount: true, status: true } })
    const payments = await prisma.paymentMilestone.findMany({ where: { projectId: co.projectId }, orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, name: true, percentage: true, amount: true, status: true } })
    const oldValue = parseMoneyCents(previousVersion.contractValue.toString())
    const newValue = parseMoneyCents(contractVersion.contractValue.toString())
    const billSnap = billing.map(x => ({ id: x.id, sequence: x.sequence, name: x.name, percentage: x.percentage.toString(), oldAmount: x.amount.toString(), newAmount: amountAtPercentage(newValue, x.percentage.toString()), status: x.status }))
    const paySnap = payments.map(x => ({ id: x.id, sequence: x.sequence, name: x.name, percentage: x.percentage.toString(), oldAmount: x.amount.toString(), newAmount: amountAtPercentage(newValue, x.percentage.toString()), status: x.status }))
    const reason = optionalText(b.reason, 2000) ?? `Explicit billing rebaseline dari change order ${co.changeNumber}.`

    const result = await prisma.$transaction(async tx => {
      for (const x of billing) {
        if (!['PLANNED', 'READY'].includes(x.status)) continue
        await tx.billingMilestone.update({ where: { id: x.id }, data: { amount: amountAtPercentage(newValue, x.percentage.toString()) } })
      }
      for (const x of payments) {
        if (!['PLANNED', 'DUE'].includes(x.status)) continue
        await tx.paymentMilestone.update({ where: { id: x.id }, data: { amount: amountAtPercentage(newValue, x.percentage.toString()) } })
      }
      return tx.billingRebaseline.create({ data: { projectId: co.projectId, contractVersionId: contractVersion.id, changeOrderId: id, oldContractValue: centsToDecimal(oldValue), newContractValue: centsToDecimal(newValue), status: 'APPLIED', reason, billingSnapshot: billSnap, paymentSnapshot: paySnap, appliedAt: new Date(), appliedByUserId: c.user.id } })
    })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'APPLY_REBASELINE', entityType: 'BILLING_REBASELINE', entityId: result.id, metadata: { projectId: co.projectId, changeOrderId: id, contractVersionId: contractVersion.id } })
    return NextResponse.json({ billingRebaseline: result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal menerapkan billing rebaseline.' }, { status: 400 })
  }
}
