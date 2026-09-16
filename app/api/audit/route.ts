import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  const logs = await prisma.auditLog.findMany({
    where: { workspaceId: c.workspace.id },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ logs })
}
