import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'
import { createProjectExecutionFoundation, snapshotProposalBOQ } from '@/lib/project-execution'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengubah PO customer.' }, { status: 403 })
  const { id } = await params
  const existing = await prisma.customerPO.findFirst({ where: { id, workspaceId: c.workspace.id }, include: { quotation: true, project: true } })
  if (!existing) return NextResponse.json({ error: 'PO customer tidak ditemukan.' }, { status: 404 })

  try {
    const b = await req.json()

    if (b.action === 'CREATE_PROJECT') {
      if (existing.status !== 'VERIFIED') return NextResponse.json({ error: 'PO harus VERIFIED sebelum project dibuat.' }, { status: 409 })
      if (!existing.quotationId || !existing.quotation || existing.quotation.status !== 'WON') return NextResponse.json({ error: 'PO yang membentuk project harus memiliki proposal WON.' }, { status: 409 })
      if (existing.project) return NextResponse.json({ error: 'PO ini sudah memiliki project.' }, { status: 409 })
      if (Number(existing.commercialVarianceAmount) !== 0 && !existing.commercialVarianceReason) {
        return NextResponse.json({ error: 'PO memiliki commercial variance tanpa alasan yang terdokumentasi. Batalkan PO ini dan buat PO baru yang sudah memiliki alasan perubahan nilai.' }, { status: 409 })
      }

      const projectCode = String(b.projectCode || '').trim()
      const projectName = String(b.projectName || existing.quotation.projectName || '').trim()
      if (!projectCode || !projectName) return NextResponse.json({ error: 'Kode dan nama project wajib diisi.' }, { status: 400 })

      const project = await prisma.$transaction(async (tx) => {
        const duplicate = await tx.project.findFirst({ where: { workspaceId: c.workspace.id, projectCode } })
        if (duplicate) throw new Error('Kode project sudah digunakan.')
        const project = await tx.project.create({
          data: {
            workspaceId: c.workspace.id,
            clientId: existing.clientId,
            proposalId: existing.quotationId,
            customerPoId: existing.id,
            projectCode,
            projectName,
            location: String(b.location || existing.quotation?.projectLocation || '').trim() || null,
            startDate: b.startDate ? new Date(`${b.startDate}T00:00:00.000Z`) : null,
            targetEndDate: b.targetEndDate ? new Date(`${b.targetEndDate}T00:00:00.000Z`) : null,
            contractValue: existing.grandTotal,
            revenueBasisValue: existing.grandTotal.sub(existing.taxAmount),
            status: 'PLANNED',
            notes: b.notes ? String(b.notes).trim() : null,
          },
          include: { client: true, proposal: true, customerPO: true },
        })
        await snapshotProposalBOQ(tx, project.id, existing.quotationId!)
        await createProjectExecutionFoundation(tx, project.id)
        await tx.projectContractVersion.create({ data: { projectId: project.id, versionNumber: 1, sourceType: 'CUSTOMER_PO', sourceId: existing.id, effectiveDate: project.startDate ?? existing.poDate, contractValue: project.contractValue, notes: 'Initial contract snapshot saat project dibuat.' } })
        return project
      })

      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE_PROJECT_FROM_PO', entityType: 'PROJECT', entityId: project.id, metadata: { customerPoId: existing.id, projectCode, contractValue: existing.grandTotal.toString() } })
      return NextResponse.json({ project }, { status: 201 })
    }

    const status = String(b.status || '')
    if (!['RECEIVED', 'VERIFIED', 'REJECTED', 'CANCELLED'].includes(status)) return NextResponse.json({ error: 'Status PO tidak valid.' }, { status: 400 })

    const transitionOk =
      (existing.status === 'RECEIVED' && ['VERIFIED', 'REJECTED'].includes(status)) ||
      (existing.status === 'VERIFIED' && status === 'CANCELLED') ||
      existing.status === status
    if (!transitionOk) return NextResponse.json({ error: `PO tidak dapat berpindah dari ${existing.status} ke ${status}.` }, { status: 409 })
    if (existing.project && status === 'CANCELLED') return NextResponse.json({ error: 'PO yang sudah membentuk project tidak dapat dibatalkan.' }, { status: 409 })

    const row = await prisma.customerPO.update({
      where: { id },
      data: status === 'VERIFIED'
        ? { status, verifiedAt: new Date(), verifiedByUserId: c.user.id }
        : status === 'CANCELLED'
          ? { status, cancelledAt: new Date(), cancelledByUserId: c.user.id }
          : { status },
      include: { client: true, quotation: true, project: true, verifiedBy: { select: { id: true, name: true, email: true } }, cancelledBy: { select: { id: true, name: true, email: true } } },
    })
    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPDATE_STATUS', entityType: 'CUSTOMER_PO', entityId: id, metadata: { from: existing.status, to: status, verifiedAt: row.verifiedAt, cancelledAt: row.cancelledAt } })
    return NextResponse.json({ customerPO: row })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui PO customer.' }, { status: 400 })
  }
}
