import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { resolveReportRange } from '@/lib/reports'
import { reconcileWorkspace } from '@/lib/reconciliation'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return new NextResponse('Unauthenticated', { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return new NextResponse('Forbidden', { status: 403 })
  const params = Object.fromEntries(new URL(req.url).searchParams.entries())
  try {
    const range = resolveReportRange(params)
    const result = await reconcileWorkspace(c.workspace.id, range)
    const lines = [
      ['Finora Reconciliation', range.label],
      ['Status', result.summary.status],
      ['Issues', String(result.summary.issueCount)],
      [],
      ['Kind', 'Severity', 'Reference', 'Date', 'Expected', 'Recorded', 'Difference', 'Message'],
      ...result.issues.map(issue => [
        issue.kind,
        issue.severity,
        issue.reference,
        issue.date.toISOString().slice(0, 10),
        String(issue.expected),
        String(issue.recorded),
        String(issue.difference),
        issue.message,
      ]),
    ]
    const csv = lines.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="finora-reconciliation-${range.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal mengekspor rekonsiliasi.' }, { status: 400 })
  }
}
