import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { resolveReportRange } from '@/lib/reports'
import { reconcileWorkspace } from '@/lib/reconciliation'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })

  const params = Object.fromEntries(new URL(req.url).searchParams.entries())
  try {
    const range = resolveReportRange(params)
    const result = await reconcileWorkspace(c.workspace.id, range)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal menjalankan rekonsiliasi.' }, { status: 400 })
  }
}
