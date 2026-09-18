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
  const reportSeries = Array.from({ length: 6 }, (_, index) => {
    const d = new Date()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - (5 - index))
    return { key: String(d.getUTCFullYear()) + '-' + String(d.getUTCMonth()), label: new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(d), income: 0, expense: 0 }
  })
  currentCashflows.forEach((row) => {
    const d = new Date((row as any).transactionDate)
    const bucket = reportSeries.find((item) => item.key === String(d.getUTCFullYear()) + '-' + String(d.getUTCMonth()))
    if (!bucket) return
    if ((row as any).type === 'INCOME') bucket.income += Number((row as any).amount)
    if ((row as any).type === 'EXPENSE') bucket.expense += Number((row as any).amount)
  })
  const chartMax = Math.max(1, ...reportSeries.flatMap((item) => [item.income, item.expense]))
  const reportCards = [
    { title: 'Profit & Loss', meta: 'Ringkasan pendapatan, beban, dan laba', tone: 'green', href: '/api/reports/export?' + filterQuery({}) },
    { title: 'Balance Sheet', meta: 'Snapshot aset, kas, piutang, dan ekuitas', tone: 'blue', href: '/api/reports/export?' + filterQuery({}) },
    { title: 'Cash Flow Statement', meta: 'Arus masuk dan keluar berdasarkan kas', tone: 'green', href: '/api/reports/export?' + filterQuery({}) },
    { title: 'Aging Receivables', meta: 'Piutang yang perlu ditindaklanjuti', tone: 'amber', href: '/receivables' },
    { title: 'Aging Payables', meta: 'Kewajiban supplier dan jatuh tempo', tone: 'red', href: '/vendor-bills' },
  ]

  const filterQuery = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    Object.entries({ period: params.period || 'month', date: params.date || '', start: params.start || '', end: params.end || '', ...extra }).forEach(([k, v]) => v && q.set(k, v))
    return q.toString()
  }

  return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Laporan">
    <div className="f-content f-reports-page">
      <PageHeader
        eyebrow="CONTROL / FINANCIAL ANALYSIS"
        title="Laporan Keuangan"
        description="Satu workspace untuk membaca performa kas, posisi keuangan, dan laporan operasional."
        action={<div className="f-actions"><a className="f-btn" href="/reconciliation">Rekonsiliasi</a>{canExport && <a className="f-btn primary" href={'/api/reports/export?' + filterQuery({})}>Export Paket CSV</a>}</div>}
      />

      <div className="f-report-tabs" aria-label="Kategori laporan">
        <a className="active" href="/reports">Financial</a>
        <a href="/cashflow">Transactions</a>
        <a href="/invoices">Receivables</a>
        <a href="/vendor-bills">Payables</a>
      </div>

      <Card className="f-report-filter-card">
        <div className="f-report-filter-top">
          <div><div className="f-eyebrow">PERIODE AKTIF</div><strong>{range.label}</strong></div>
          <div className="f-report-quick-filters">
            <a className={!['quarter','year','all','custom'].includes(params.period || '') ? 'active' : ''} href={'?' + filterQuery({ period:'month', date: monthValue })}>Bulan</a>
            <a className={params.period === 'quarter' ? 'active' : ''} href={'?' + filterQuery({ period:'quarter', date: quarterValue })}>Kuartal</a>
            <a className={params.period === 'year' ? 'active' : ''} href={'?' + filterQuery({ period:'year', date: yearValue })}>Tahun</a>
            <a className={params.period === 'all' ? 'active' : ''} href={'?' + filterQuery({ period:'all' })}>Semua</a>
          </div>
        </div>
        <form id="report-filter" method="get" className="f-report-filter-grid">
          <label>Periode<select className="f-input" name="period" defaultValue={params.period || 'month'}><option value="month">Bulan</option><option value="quarter">Kuartal</option><option value="year">Tahun</option><option value="custom">Custom</option><option value="all">Semua</option></select></label>
          <label>Nilai periode<input className="f-input" name="date" type={params.period === 'month' || !params.period ? 'month' : 'text'} defaultValue={params.period === 'quarter' ? quarterValue : params.period === 'year' ? yearValue : params.period === 'all' || params.period === 'custom' ? '' : monthValue} placeholder={params.period === 'quarter' ? '2026-Q3' : params.period === 'year' ? '2026' : '2026-09'} /></label>
          <label>Dari<input className="f-input" name="start" type="date" defaultValue={customStart}/></label>
          <label>Sampai<input className="f-input" name="end" type="date" defaultValue={customEnd}/></label>
          <button className="f-btn primary f-report-apply" type="submit">Terapkan</button>
        </form>
      </Card>

      <div className="f-grid-3 f-reports-stats">
        <StatCard label="Pendapatan" value={money(current.income)} trend={pct(incomeChange) + ' vs periode sebelumnya'} icon="↗"/>
        <StatCard label="Beban" value={money(current.expense)} trend={pct(expenseChange) + ' vs periode sebelumnya'} icon="↘"/>
        <StatCard label="Laba bersih" value={money(current.net)} trend={pct(netChange) + ' vs periode sebelumnya'} icon="◎"/>
      </div>

      <div className="f-report-analytics-grid">
        <Card className="f-report-cash-card">
          <div className="f-card-head"><div><h3>Cash Flow</h3><p>Pergerakan kas enam bulan terakhir berdasarkan transaksi tercatat.</p></div><Badge tone="green">Live</Badge></div>
          <div className="f-report-chart">
            <div className="f-report-chart-grid"><span/><span/><span/><span/></div>
            <div className="f-report-bars">
              {reportSeries.map(item => <div className="f-report-month" key={item.key}>
                <div className="f-report-bars-inner">
                  <span className="income" style={{height: Math.max(4, item.income / chartMax * 100) + '%'}} title={'Masuk ' + money(item.income)}/>
                  <span className="expense" style={{height: Math.max(4, item.expense / chartMax * 100) + '%'}} title={'Keluar ' + money(item.expense)}/>
                </div>
                <small>{item.label}</small>
              </div>)}
            </div>
          </div>
          <div className="f-report-chart-legend"><span><i className="income"/>Masuk {money(current.income)}</span><span><i className="expense"/>Keluar {money(current.expense)}</span></div>
        </Card>

        <Card className="f-report-breakdown-card">
          <div className="f-card-head"><div><h3>Beban per kategori</h3><p>Cost driver terbesar periode aktif.</p></div></div>
          <div className="f-report-breakdown-list">
            {current.byCategory.slice(0,6).map(([k,v]) => {
              const pctValue = current.expense ? Math.round(v / current.expense * 100) : 0
              return <div className="f-report-breakdown-row" key={k}><div><span>{k}</span><strong>{money(v)}</strong></div><div className="f-progress"><span style={{width: pctValue + '%'}}/></div></div>
            })}
            {!current.byCategory.length && <div className="f-empty"><strong>Belum ada beban</strong>Belum ada transaksi expense pada periode ini.</div>}
          </div>
        </Card>
      </div>

      <div className="f-report-lower-grid">
        <Card>
          <div className="f-card-head"><div><h3>Balance Sheet — sederhana</h3><p>Snapshot per {formatDateParam(new Date(asOf.getTime()-86400000))}. Beberapa akun belum dimodelkan penuh.</p></div><Badge tone="blue">Cash basis</Badge></div>
          <div className="f-report-balance-grid">
            <div><span>Kas bersih</span><strong>{money(balance.cash)}</strong></div>
            <div><span>Piutang usaha</span><strong>{money(balance.receivables)}</strong></div>
            <div><span>Total aset</span><strong>{money(balance.assets)}</strong></div>
            <div><span>Total liabilitas</span><strong>{money(balance.liabilities)}</strong></div>
            <div><span>Ekuitas sederhana</span><strong>{money(balance.equity)}</strong></div>
          </div>
        </Card>

        <Card className="f-report-health-card">
          <div className="f-card-head"><div><h3>Financial health</h3><p>Indikator operasional dari proporsi arus masuk terhadap beban.</p></div></div>
          <div className="f-report-health">
            <div className="f-health-ring" style={{'--health': health * 3.6 + 'deg'} as React.CSSProperties}><strong>{health}</strong><span>/ 100</span></div>
            <div><Badge tone={current.income>=current.expense?'green':'red'}>{current.income>=current.expense?'Sehat':'Perlu perhatian'}</Badge><p className="f-muted">Ini bukan rasio akuntansi formal.</p></div>
          </div>
        </Card>
      </div>

      <Card className="f-report-library">
        <div className="f-card-head"><div><h3>Report Library</h3><p>Dokumen dan tampilan laporan yang paling sering digunakan tim finance.</p></div></div>
        <div className="f-report-library-list">
          {reportCards.map(report => <div className="f-report-library-item" key={report.title}>
            <div className={'f-report-doc-icon ' + report.tone}>▤</div>
            <div className="f-report-library-copy"><strong>{report.title}</strong><span>{report.meta}</span><small>{range.label}</small></div>
            <div className="f-report-library-actions"><a className="f-btn soft" href={report.href}>{report.title.includes('Aging') ? 'Buka' : 'Export'}</a>{!report.title.includes('Aging') && <a className="f-btn" href={report.href}>Detail</a>}</div>
          </div>)}
        </div>
      </Card>
    </div>
  </FinoraShell>
}
