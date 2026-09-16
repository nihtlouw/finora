import { NextResponse } from 'next/server'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { getProjectProfitability } from '@/lib/project-profitability'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })

  const { id } = await params
  const profitability = await getProjectProfitability(c.workspace.id, id)
  if (!profitability) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 })

  return NextResponse.json({ profitability })
}
