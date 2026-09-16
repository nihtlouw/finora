import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return new NextResponse('Unauthenticated', { status: 401 })
  const { id, attachmentId } = await params
  const attachment = await prisma.expenseAttachment.findFirst({
    where: { id: attachmentId, expenseId: id, expense: { workspaceId: c.workspace.id } },
    select: { fileName: true, mimeType: true, data: true },
  })
  if (!attachment) return new NextResponse('Bukti tidak ditemukan.', { status: 404 })
  return new NextResponse(attachment.data, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat menghapus bukti biaya.' }, { status: 403 })
  const { id, attachmentId } = await params
  const expense = await prisma.expense.findFirst({ where: { id, workspaceId: c.workspace.id }, select: { id: true, status: true } })
  if (!expense) return NextResponse.json({ error: 'Biaya tidak ditemukan.' }, { status: 404 })
  if (expense.status === 'APPROVED') return NextResponse.json({ error: 'Bukti expense yang sudah disetujui tidak dapat diubah.' }, { status: 409 })
  const attachment = await prisma.expenseAttachment.findFirst({ where: { id: attachmentId, expenseId: id }, select: { id: true, fileName: true } })
  if (!attachment) return NextResponse.json({ error: 'Bukti tidak ditemukan.' }, { status: 404 })
  await prisma.expenseAttachment.delete({ where: { id: attachment.id } })
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'DELETE_EVIDENCE', entityType: 'EXPENSE', entityId: id, metadata: { attachmentId, fileName: attachment.fileName } })
  return NextResponse.json({ ok: true })
}
