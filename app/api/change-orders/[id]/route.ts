import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { positiveMoney, optionalText, parseMoneyCents, centsToDecimal } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    const action = String(body.action ?? '').toUpperCase()
    const row = await prisma.contractChangeOrder.findFirst({
      where: { id, workspaceId: c.workspace.id },
      include: { project: { include: { invoices: { select: { status: true, totalAmount: true } } } } },
    })
    if (!row) return NextResponse.json({ error: 'Change order tidak ditemukan.' }, { status: 404 })

    if (action === 'SUBMIT') {
      if (row.status !== 'DRAFT') return NextResponse.json({ error: 'Hanya DRAFT yang dapat disubmit.' }, { status: 409 })
      const updated = await prisma.contractChangeOrder.update({ where: { id }, data: { status: 'SUBMITTED' } })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'CHANGE_ORDER', entityId: id })
      return NextResponse.json({ changeOrder: updated })
    }

    if (action === 'APPROVE') {
      if (row.status !== 'SUBMITTED') return NextResponse.json({ error: 'Change order harus SUBMITTED.' }, { status: 409 })
      const approvedCents = positiveMoney(body.approvedAmount ?? row.requestedAmount.toString(), 'Nilai approved').cents
      const approved = centsToDecimal(approvedCents)
      const changeType = row.changeType === 'DECREASE' ? 'DECREASE' : 'INCREASE'
      const currentContractCents = parseMoneyCents(row.project.contractValue.toString())
      const signedApprovedCents = changeType === 'DECREASE' ? -approvedCents : approvedCents
      const activeInvoicedCents = row.project.invoices.filter((x) => !['CANCELLED', 'VOID'].includes(x.status)).reduce((s, x) => s + parseMoneyCents(x.totalAmount.toString()), 0n)
      const revisedCents = currentContractCents + signedApprovedCents
      if (revisedCents <= 0n) return NextResponse.json({ error: 'Nilai kontrak hasil change order harus lebih besar dari nol.' }, { status: 409 })
      if (revisedCents < activeInvoicedCents) return NextResponse.json({ error: 'Nilai kontrak hasil change order tidak boleh di bawah nilai invoice aktif.' }, { status: 409 })

      const updated = await prisma.$transaction(async (tx) => {
        const nextVersion = row.project.contractVersion + 1
        const contractVersion = await tx.projectContractVersion.create({ data: { projectId: row.projectId, versionNumber: nextVersion, sourceType: 'CHANGE_ORDER', effectiveDate: row.effectiveDate, contractValue: centsToDecimal(revisedCents), notes: `Contract version dari change order ${row.changeNumber}.` } })
        const co = await tx.contractChangeOrder.update({ where: { id }, data: { status: 'APPROVED', approvedAmount: approved, decidedAt: new Date(), decidedByUserId: c.user.id, contractVersionId: contractVersion.id } })
        await tx.project.update({ where: { id: row.projectId }, data: { contractValue: centsToDecimal(revisedCents), revenueBasisValue: centsToDecimal(revisedCents), contractVersion: nextVersion } })
        return co
      })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'CHANGE_ORDER', entityId: id, metadata: { changeType, approvedAmount: approved.toString(), signedAmount: centsToDecimal(signedApprovedCents) } })
      return NextResponse.json({ changeOrder: updated })
    }

    if (action === 'REJECT' || action === 'CANCEL') {
      const allowed = action === 'REJECT' ? ['SUBMITTED'] : ['DRAFT', 'SUBMITTED']
      if (!allowed.includes(row.status)) return NextResponse.json({ error: `Status ${row.status} tidak dapat ${action}.` }, { status: 409 })
      const updated = await prisma.contractChangeOrder.update({ where: { id }, data: { status: action === 'REJECT' ? 'REJECTED' : 'CANCELLED', decidedAt: new Date(), decidedByUserId: c.user.id, notes: optionalText(body.notes, 2000) ?? row.notes } })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'CHANGE_ORDER', entityId: id })
      return NextResponse.json({ changeOrder: updated })
    }

    return NextResponse.json({ error: 'Action tidak didukung.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memproses change order.' }, { status: 400 })
  }
}
