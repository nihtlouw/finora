import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { resolveReportRange } from '@/lib/reports'
import { reconcileWorkspace } from '@/lib/reconciliation'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }
function filterQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value) q.set(key, value) })
  return q.toString()
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const c = await getCurrentFinoraContext()
  if (!c) redirect('/sign-in')
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) redirect('/dashboard')

  const raw = await searchParams
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, first(value)]))
  let range
  try { range = resolveReportRange(params) } catch { range = resolveReportRange({ period: 'month' }) }
  const result = await reconcileWorkspace(c.workspace.id, range)
  const statusOk = result.summary.status === 'RECONCILED'

  return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Rekonsiliasi">
    <div className="f-content f-recon-page">
      <PageHeader
        eyebrow="Kontrol Finance"
        title="Rekonsiliasi"
        description="Cek apakah Payment dan Expense otomatis memiliki Cashflow yang tepat dan tidak berbeda nominal."
        action={<a className="f-btn primary" href={`/api/reconciliation/export?${filterQuery(params)}`}>Export CSV</a>}
      />

      <Card className="pad f-recon-filter">
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <a className="f-btn" href={`?${filterQuery({period:'month',date:new Date().toISOString().slice(0,7)})}`}>Bulan ini</a>
          <a className="f-btn" href={`?${filterQuery({period:'year',date:String(new Date().getUTCFullYear())})}`}>Tahun ini</a>
          <a className="f-btn" href={`?${filterQuery({period:'all'})}`}>Semua</a>
          <span className="f-muted">Periode aktif: <strong>{range.label}</strong></span>
        </div>
      </Card>

      <div className="f-grid-4 f-recon-stats">
        <StatCard label="Status" value={statusOk ? 'RECONCILED' : 'REVIEW'} trend={statusOk ? 'Tidak ada anomali otomatis' : `${result.summary.issueCount} temuan`} icon={statusOk ? '✓' : '!'}/>
        <StatCard label="Payment diperiksa" value={result.summary.paymentCount} trend={`${result.summary.matchedItems} item matched`} icon="↔"/>
        <StatCard label="Expense diperiksa" value={result.summary.expenseCount} trend="Approval vs Cashflow" icon="◈"/>
        <StatCard label="Selisih otomatis" value={money(result.summary.automaticDifference)} trend="Expected vs Cashflow" icon="≈"/>
      </div>

      <div className="f-recon-section-gap"/>
      <Card className="f-recon-card">
        <div className="f-card-head"><div><h3>Ringkasan</h3><p>Transaksi manual tidak dianggap error; rekonsiliasi fokus pada cashflow turunan dari Payment dan Expense.</p></div><Badge tone={statusOk ? 'green' : 'red'}>{statusOk ? 'Sinkron' : 'Perlu ditinjau'}</Badge></div>
        <div className="f-recon-summary-grid">
          <div className="f-list-item"><span>Expected automatic cashflow</span><strong>{money(result.summary.expectedAutomaticAmount)}</strong></div>
          <div className="f-list-item"><span>Recorded automatic cashflow</span><strong>{money(result.summary.recordedAutomaticAmount)}</strong></div>
          <div className="f-list-item"><span>Temuan</span><strong>{result.summary.issueCount}</strong></div>
        </div>
      </Card>

      <div className="f-recon-section-gap"/>
      <Card className="f-recon-card f-recon-findings">
        <div className="f-card-head"><div><h3>Temuan rekonsiliasi</h3><p>Jika kosong, Payment dan Expense otomatis sudah selaras dengan Cashflow.</p></div></div>
        {result.issues.length === 0 ? <div className="f-empty"><strong>Semua transaksi sinkron.</strong><span>Tidak ada missing, duplicate, atau mismatch cashflow otomatis untuk periode ini.</span></div> : <div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Referensi</th><th>Expected</th><th>Recorded</th><th>Selisih</th><th>Masalah</th></tr></thead><tbody>{result.issues.map(issue=><tr key={issue.id}><td>{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date(issue.date))}</td><td><Badge tone={issue.severity==='ERROR'?'red':'amber'}>{issue.kind}</Badge></td><td>{issue.reference}</td><td>{money(issue.expected)}</td><td>{money(issue.recorded)}</td><td>{money(issue.difference)}</td><td>{issue.message}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  </FinoraShell>
}
