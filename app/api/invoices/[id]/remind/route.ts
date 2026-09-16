import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  const { id } = await params
  const invoice = await prisma.invoice.findFirst({
    where: { id, client: { workspaceId: c.workspace.id } },
    include: { payments: true, client: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
  const total = Number(invoice.totalAmount)
  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  if (paid >= total) return NextResponse.json({ error: 'Invoice sudah lunas, tidak perlu pengingat.' }, { status: 409 })
  const today = new Date(new Date().toISOString().slice(0, 10))
  if (invoice.dueDate >= today) return NextResponse.json({ error: 'Pengingat overdue hanya tersedia setelah jatuh tempo.' }, { status: 409 })

  await writeAuditLog({
    workspaceId: c.workspace.id,
    actorUserId: c.user.id,
    action: 'REMINDER_SENT',
    entityType: 'INVOICE',
    entityId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, clientId: invoice.clientId },
  })

  return NextResponse.json({ ok: true, message: `Pengingat untuk ${invoice.invoiceNumber} dicatat.` })
}
