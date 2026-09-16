import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })
  try {
    const { id } = await params
    const body = await req.json()
    const action = String(body.action ?? '').toUpperCase()
    const row = await prisma.creditNote.findFirst({ where: { id, workspaceId: c.workspace.id } })
    if (!row) return NextResponse.json({ error: 'Credit note tidak ditemukan.' }, { status: 404 })
    if (action === 'ISSUE') {
      if (row.status !== 'DRAFT') return NextResponse.json({ error: 'Hanya DRAFT yang dapat diterbitkan.' }, { status: 409 })
      const updated = await prisma.creditNote.update({ where: { id }, data: { status: 'ISSUED', issuedByUserId: c.user.id } })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'CREDIT_NOTE', entityId: id })
      return NextResponse.json({ creditNote: updated })
    }
    if (action === 'VOID') {
      if (row.status !== 'ISSUED') return NextResponse.json({ error: 'Hanya ISSUED yang dapat di-void.' }, { status: 409 })
      const updated = await prisma.creditNote.update({ where: { id }, data: { status: 'VOID', voidedByUserId: c.user.id, voidedAt: new Date() } })
      await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action, entityType: 'CREDIT_NOTE', entityId: id })
      return NextResponse.json({ creditNote: updated })
    }
    return NextResponse.json({ error: 'Action tidak didukung.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memproses credit note.' }, { status: 400 })
  }
}
