import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengelola bukti biaya.' }, { status: 403 })
  const { id } = await params
  const expense = await prisma.expense.findFirst({ where: { id, workspaceId: c.workspace.id }, select: { id: true, status: true } })
  if (!expense) return NextResponse.json({ error: 'Biaya tidak ditemukan.' }, { status: 404 })
  if (expense.status === 'APPROVED') return NextResponse.json({ error: 'Biaya yang sudah disetujui tidak dapat ditambah bukti baru.' }, { status: 409 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File bukti tidak ditemukan.' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Bukti harus berupa PDF, JPG/JPEG, PNG, atau WebP.' }, { status: 400 })
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Ukuran bukti maksimal 5 MB per file.' }, { status: 400 })

  const count = await prisma.expenseAttachment.count({ where: { expenseId: id } })
  if (count >= 5) return NextResponse.json({ error: 'Maksimal 5 file bukti per transaksi.' }, { status: 400 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const attachment = await prisma.expenseAttachment.create({ data: { expenseId: id, fileName: file.name.slice(0, 240), mimeType: file.type, sizeBytes: file.size, data: bytes } })
  await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'UPLOAD_EVIDENCE', entityType: 'EXPENSE', entityId: id, metadata: { attachmentId: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes } })
  return NextResponse.json({ attachment: { id: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, createdAt: attachment.createdAt } }, { status: 201 })
}
