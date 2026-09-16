import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { PageHeader, Card, StatCard, money, Badge } from '@/components/finora-ui'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { formatDateParam, getBalanceSheetSnapshot, getCashflowsForRange, getPreviousRange, percentChange, resolveReportRange, summarizeCashflows } from '@/lib/reports'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function pct(value: number | null) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const c = await getCurrentFinoraContext()
  if (!c) redirect('/sign-in')
  const canExport = ['OWNER', 'FINANCE'].includes(c.user.role)
  const raw = await searchParams
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, first(value)]))

  let range
  try {
    range = resolveReportRange(params)
  } catch {
    range = resolveReportRange({ period: 'month' })
  }
  const previousRange = getPreviousRange(range)
  const currentCashflows = await getCashflowsForRange(c.workspace.id, range)
  const previousCashflows = previousRange ? await getCashflowsForRange(c.workspace.id, previousRange) : []
  const current = summarizeCashflows(currentCashflows)
  const previous = summarizeCashflows(previousCashflows)
  const asOf = range.endExclusive ?? new Date(Date.now() + 86400000)
  const balance = await getBalanceSheetSnapshot(c.workspace.id, asOf)
  const incomeChange = previousRange ? percentChange(current.income, previous.income) : null
  const expenseChange = previousRange ? percentChange(current.expense, previous.expense) : null
  const netChange = previousRange ? percentChange(current.net, previous.net) : null
  const totalFlow = current.income + current.expense
  const health = totalFlow ? Math.round(Math.max(0, Math.min(100, current.income / totalFlow * 100))) : 0
  const monthValue = params.period === 'month' ? params.date : new Date().toISOString().slice(0, 7)
  const quarterValue = params.period === 'quarter' ? params.date : `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`
  const yearValue = params.period === 'year' ? params.date : String(new Date().getUTCFullYear())
  const customStart = params.period === 'custom' ? params.start : ''
  const customEnd = params.period === 'custom' ? params.end : ''

  const filterQuery = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    Object.entries({ period: params.period || 'month', date: params.date || '', start: params.start || '', end: params.end || '', ...extra }).forEach(([k, v]) => v && q.set(k, v))
    return q.toString()
  }

  return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Laporan">
    <div className="f-content">
      <PageHeader
        eyebrow="Analisis"
        title="Laporan Keuangan"
        description="P&L berbasis cash flow, balance sheet sederhana, dan perbandingan periode."
        action={<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><a className="f-btn" href="/reconciliation">Rekonsiliasi</a>{canExport && <a className="f-btn primary" href={`/api/reports/export?${filterQuery({})}`}>Export Paket CSV</a>}</div>}
      />

      <Card className="pad f-reports-filter">
        <div className="f-grid-4">
          <div><label>Periode</label><select className="f-input" name="period" form="report-filter" defaultValue={params.period || 'month'}><option value="month">Bulan</option><option value="quarter">Kuartal</option><option value="year">Tahun</option><option value="custom">Custom</option><option value="all">Semua</option></select></div>
          <div><label>Nilai periode</label><input className="f-input" name="date" form="report-filter" type={params.period === 'month' || !params.period ? 'month' : 'text'} defaultValue={params.period === 'quarter' ? quarterValue : params.period === 'year' ? yearValue : params.period === 'all' || params.period === 'custom' ? '' : monthValue} placeholder={params.period === 'quarter' ? '2026-Q3' : params.period === 'year' ? '2026' : '2026-09'}/></div>
          <div><label>Dari (custom)</label><input className="f-input" name="start" form="report-filter" type="date" defaultValue={customStart}/></div>
          <div><label>Sampai (custom)</label><input className="f-input" name="end" form="report-filter" type="date" defaultValue={customEnd}/></div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap',alignItems:'center'}}>
          <a className="f-btn" href={`?${filterQuery({ period:'month', date: monthValue })}`}>Bulan</a>
          <a className="f-btn" href={`?${filterQuery({ period:'quarter', date: quarterValue })}`}>Kuartal</a>
          <a className="f-btn" href={`?${filterQuery({ period:'year', date: yearValue })}`}>Tahun</a>
          <a className="f-btn" href={`?${filterQuery({ period:'all' })}`}>Semua</a>
          <form id="report-filter" method="get" style={{display:'inline'}}><button className="f-btn primary" type="submit">Terapkan filter</button></form>
          <span className="f-muted">Periode aktif: <strong>{range.label}</strong></span>
        </div>
      </Card>

      <div className="f-grid-3 f-reports-stats">
        <StatCard label="Pendapatan" value={money(current.income)} trend={`${pct(incomeChange)} vs periode sebelumnya`} icon="↗"/>
        <StatCard label="Beban" value={money(current.expense)} trend={`${pct(expenseChange)} vs periode sebelumnya`} icon="↘"/>
        <StatCard label="Laba bersih" value={money(current.net)} trend={`${pct(netChange)} vs periode sebelumnya`} icon="◎"/>
      </div>

      <div className="f-grid-3 f-reports-panels">
        <Card className="pad">
          <div className="f-card-head"><div><h3>Profit &amp; Loss</h3><p>Basis kas untuk {range.label.toLowerCase()}; bukan laporan akrual penuh.</p></div></div>
          <div style={{padding:18}}>
            <div className="f-progress"><span style={{width:`${totalFlow ? Math.min(100, current.income / totalFlow * 100) : 0}%`}}/></div>
            <div className="f-list-item"><span>Pendapatan</span><strong>{money(current.income)}</strong></div>
            <div className="f-list-item"><span>Beban</span><strong>{money(current.expense)}</strong></div>
            <div className="f-list-item"><span>Laba bersih</span><strong>{money(current.net)}</strong></div>
          </div>
        </Card>
        <Card>
          <div className="f-card-head"><div><h3>Beban per kategori</h3><p>Top cost drivers pada periode terpilih.</p></div></div>
          <div className="f-list">{current.byCategory.slice(0,8).map(([k,v])=><div className="f-list-item" key={k}><span>{k}</span><strong>{money(v)}</strong></div>)}{current.byCategory.length===0&&<div className="f-muted" style={{padding:18}}>Belum ada beban.</div>}</div>
        </Card>
        <Card>
          <div className="f-card-head"><div><h3>Comparison</h3><p>Periode aktif dibanding periode sebelumnya.</p></div></div>
          <div className="f-list">
            <div className="f-list-item"><span>Pendapatan</span><strong>{money(current.income)}</strong></div>
            <div className="f-list-item"><span>Pendapatan sebelumnya</span><strong>{previousRange ? money(previous.income) : '—'}</strong></div>
            <div className="f-list-item"><span>Perubahan</span><strong>{pct(incomeChange)}</strong></div>
            <div className="f-list-item"><span>Beban</span><strong>{money(current.expense)}</strong></div>
            <div className="f-list-item"><span>Beban sebelumnya</span><strong>{previousRange ? money(previous.expense) : '—'}</strong></div>
            <div className="f-list-item"><span>Perubahan beban</span><strong>{pct(expenseChange)}</strong></div>
            <div className="f-list-item"><span>Laba bersih</span><strong>{money(current.net)}</strong></div>
            <div className="f-list-item"><span>Laba sebelumnya</span><strong>{previousRange ? money(previous.net) : '—'}</strong></div>
            <div className="f-list-item"><span>Perubahan laba</span><strong>{pct(netChange)}</strong></div>
          </div>
        </Card>
      </div>

      <div className="f-reports-lower">
      <Card>
        <div className="f-card-head"><div><h3>Balance Sheet — sederhana</h3><p>Snapshot per {formatDateParam(new Date(asOf.getTime()-86400000))}. Saldo awal, kewajiban, aset tetap, dan modal belum dimodelkan penuh.</p></div><Badge tone="blue">Cash basis</Badge></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,padding:18}}>
          <div className="f-list-item"><span>Kas bersih</span><strong>{money(balance.cash)}</strong></div>
          <div className="f-list-item"><span>Piutang usaha</span><strong>{money(balance.receivables)}</strong></div>
          <div className="f-list-item"><span>Total aset</span><strong>{money(balance.assets)}</strong></div>
          <div className="f-list-item"><span>Total liabilitas</span><strong>{money(balance.liabilities)}</strong></div>
          <div className="f-list-item"><span>Ekuitas sederhana</span><strong>{money(balance.equity)}</strong></div>
        </div>
      </Card>

      <Card>
        <div className="f-card-head"><div><h3>Financial health</h3><p>Sinyal sederhana dari rasio arus masuk terhadap beban.</p></div></div>
        <div style={{padding:18}}><div style={{fontSize:44,fontWeight:900,color:current.income>=current.expense?'#0f6d5f':'#c75b4b'}}>{health}</div><p className="f-muted">Skor bukan rasio akuntansi formal; gunakan sebagai indikator operasional.</p><Badge tone={current.income>=current.expense?'green':'red'}>{current.income>=current.expense?'Sehat':'Perlu perhatian'}</Badge></div>
      </Card>
    </div>
    </div>
  </FinoraShell>
}
