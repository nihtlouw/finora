import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { buildFinancialExport } from '@/lib/financial-export'
import { resolveReportRange } from '@/lib/reports'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner/Finance yang dapat mengexport laporan.' }, { status: 403 })
  }

  try {
    const params = Object.fromEntries(new URL(req.url).searchParams.entries())
    const range = resolveReportRange(params)
    const csv = await buildFinancialExport(c.workspace.id, range)
    const filename = `finora-financial-export-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat export laporan.' },
      { status: 400 },
    )
  }
}
