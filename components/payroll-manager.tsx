
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'

type Employee = {
  id: string
  employeeNo: string
  name: string
  position: string | null
  department: string | null
  baseSalary: number | string
  isActive: boolean
}

type Allocation = {
  percentage: number | string
  amount: number | string
  project: { id: string; projectCode: string; projectName: string; status: string }
}

type PayrollLine = {
  id: string
  grossAmount: number | string
  taxableAmount: number | string
  pph21Amount: number | string
  bpjsAmount: number | string
  otherDeduction: number | string
  netAmount: number | string
  employee: Employee
  allocations: Allocation[]
}

type PayrollRun = {
  id: string
  runNumber: string
  period: string
  status: string
  payDate: string
  grossAmount: number | string
  deductionAmount: number | string
  netAmount: number | string
  approvedAt: string | null
  paidAt: string | null
  headcount: number
  lines: PayrollLine[]
  cashflow: { id: string; amount: number | string; transactionDate: string; category: string } | null
}

type DraftLine = {
  employeeId: string
  grossAmount: string
  taxableAmount: string
  pph21Amount: string
  bpjsAmount: string
  otherDeduction: string
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
}

function statusTone(status: string) {
  if (status === 'PAID' || status === 'APPROVED') return 'green' as const
  if (status === 'DRAFT' || status === 'PARTIAL') return 'amber' as const
  if (status === 'CANCELLED') return 'red' as const
  return 'neutral' as const
}

function n(v: number | string | null | undefined) {
  return Number(v || 0)
}

export default function PayrollManager({ role }: { role: string }) {
  const canWrite = ['OWNER', 'FINANCE'].includes(role)
  const [rows, setRows] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<PayrollRun | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runNumber, setRunNumber] = useState('')
  const [period, setPeriod] = useState('2026-10')
  const [payDate, setPayDate] = useState('2026-10-25')
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [periodFilter, setPeriodFilter] = useState('ALL')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [payrollRes, employeeRes] = await Promise.all([
        fetch('/api/payroll', { cache: 'no-store' }),
        fetch('/api/employees', { cache: 'no-store' }),
      ])
      const payrollData = await payrollRes.json()
      const employeeData = await employeeRes.json()
      if (!payrollRes.ok) throw new Error(payrollData.error || 'Gagal memuat payroll.')
      if (!employeeRes.ok) throw new Error(employeeData.error || 'Gagal memuat employee master.')
      setRows(payrollData.payrollRuns || [])
      setEmployees((employeeData.employees || []).filter((item: Employee) => item.isActive))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat payroll.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function openDetail(id: string) {
    try {
      const res = await fetch('/api/payroll/' + id, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat payroll detail.')
      setDetail(data.payrollRun)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat payroll detail.')
    }
  }

  function startCreate() {
    const defaults = employees.map((employee) => ({
      employeeId: employee.id,
      grossAmount: String(employee.baseSalary || 0),
      taxableAmount: String(employee.baseSalary || 0),
      pph21Amount: '0',
      bpjsAmount: '0',
      otherDeduction: '0',
    }))
    setDraftLines(defaults)
    setRunNumber('PAY-' + period.replace('-', '') + '-001')
    setCreating(true)
    setError('')
  }

  function updateLine(employeeId: string, field: keyof Omit<DraftLine, 'employeeId'>, value: string) {
    setDraftLines((current) => current.map((line) => line.employeeId === employeeId ? { ...line, [field]: value } : line))
  }

  async function createPayroll() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runNumber,
          period,
          payDate,
          lines: draftLines.map((line) => ({
            employeeId: line.employeeId,
            grossAmount: line.grossAmount,
            taxableAmount: line.taxableAmount,
            pph21Amount: line.pph21Amount,
            bpjsAmount: line.bpjsAmount,
            otherDeduction: line.otherDeduction,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat payroll.')
      setCreating(false)
      await load()
      await openDetail(data.payrollRun.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat payroll.')
    } finally {
      setSaving(false)
    }
  }

  async function action(id: string, actionName: 'APPROVE' | 'PAY' | 'CANCEL') {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/payroll/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Aksi payroll gagal.')
      await load()
      await openDetail(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aksi payroll gagal.')
    } finally {
      setSaving(false)
    }
  }

  const periods = useMemo(() => ['ALL', ...Array.from(new Set(rows.map((row) => row.period)))], [rows])
  const filtered = useMemo(() => rows.filter((row) => (statusFilter === 'ALL' || row.status === statusFilter) && (periodFilter === 'ALL' || row.period === periodFilter)), [rows, statusFilter, periodFilter])

  const summary = useMemo(() => {
    return rows.reduce((acc, row) => ({
      runs: acc.runs + 1,
      headcount: acc.headcount + row.headcount,
      gross: acc.gross + n(row.grossAmount),
      deductions: acc.deductions + n(row.deductionAmount),
      net: acc.net + n(row.netAmount),
    }), { runs: 0, headcount: 0, gross: 0, deductions: 0, net: 0 })
  }, [rows])

  const draftTotals = useMemo(() => draftLines.reduce((acc, line) => {
    const gross = n(line.grossAmount)
    const deductions = n(line.pph21Amount) + n(line.bpjsAmount) + n(line.otherDeduction)
    return { gross: acc.gross + gross, deductions: acc.deductions + deductions, net: acc.net + gross - deductions }
  }, { gross: 0, deductions: 0, net: 0 }), [draftLines])

  return (
    <div className="f-content f-domain-page">
      <PageHeader
        eyebrow="FINANCE / PAYROLL"
        title="Payroll"
        description="Payroll run, employee deductions, project cost allocation, approval, payment, dan cashflow."
        action={canWrite ? <button className="f-btn primary" onClick={startCreate}>+ Buat Payroll</button> : undefined}
      />

      {error && <div className="f-inline-alert error">{error}</div>}

      <div className="f-grid-4 f-domain-kpis">
        <StatCard label="Payroll runs" value={summary.runs} trend="Workspace payroll history" icon="▤" />
        <StatCard label="Gross" value={money(summary.gross)} trend="Total seluruh run" icon="rp" />
        <StatCard label="Deductions" value={money(summary.deductions)} trend="PPh21 + BPJS + lainnya" icon="↘" />
        <StatCard label="Net paid" value={money(summary.net)} trend="Net payroll tercatat" icon="✓" />
      </div>

      <Card className="f-domain-card">
        <div className="f-domain-toolbar">
          <div><strong>Payroll runs</strong><span>{filtered.length} record</span></div>
          <div className="f-domain-filters">
            <select className="f-select" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
              {periods.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'Semua periode' : item}</option>)}
            </select>
            <select className="f-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Semua status</option>
              <option value="DRAFT">DRAFT</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        {loading ? <div className="f-empty">Memuat payroll…</div> : filtered.length === 0 ? (
          <div className="f-empty"><strong>Belum ada payroll run</strong><span>Buat payroll run pertama menggunakan employee master.</span></div>
        ) : (
          <div className="f-table-wrap">
            <table className="f-table f-domain-table">
              <thead><tr><th>Payroll Run</th><th>Period</th><th>Headcount</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th><th>Pay Date</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.runNumber}</strong><span className="f-table-sub">{row.id.slice(0, 8)}</span></td>
                    <td>{row.period}</td>
                    <td>{row.headcount}</td>
                    <td>{money(n(row.grossAmount))}</td>
                    <td>{money(n(row.deductionAmount))}</td>
                    <td className="f-number"><strong>{money(n(row.netAmount))}</strong></td>
                    <td><Badge tone={statusTone(row.status)}>{row.status}</Badge></td>
                    <td>{fmtDate(row.payDate)}</td>
                    <td><button className="f-btn soft" onClick={() => void openDetail(row.id)}>Detail</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <div className="f-modal-backdrop" onMouseDown={() => setCreating(false)}>
          <div className="f-modal-card f-domain-modal f-payroll-create-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="f-card-head">
              <div><h3>Buat Payroll Run</h3><p>Payroll baru selalu dimulai sebagai DRAFT. Approval dan payment dilakukan setelah review.</p></div>
              <button className="f-btn" onClick={() => setCreating(false)}>Tutup</button>
            </div>
            <div className="f-domain-form-grid f-payroll-header-form">
              <label>Run number<input className="f-input" value={runNumber} onChange={(e) => setRunNumber(e.target.value)} /></label>
              <label>Periode<input className="f-input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></label>
              <label>Tanggal payroll<input className="f-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></label>
            </div>
            <div className="f-card-head f-payroll-lines-head"><div><h3>Payroll lines</h3><p>{draftLines.length} employee aktif dari master. Review seluruh baris sebelum menyimpan sebagai DRAFT.</p></div></div>
            <div className="f-payroll-draft-lines">
              <div className="f-payroll-draft-grid-head" aria-hidden="true">
                <span>Employee</span><span>Gross</span><span>PPh21</span><span>BPJS</span><span>Other</span><span>Net</span>
              </div>
              {draftLines.map((line) => {
                const employee = employees.find((item) => item.id === line.employeeId)
                const deductions = n(line.pph21Amount) + n(line.bpjsAmount) + n(line.otherDeduction)
                return (
                  <div className="f-payroll-draft-row" key={line.employeeId}>
                    <div className="f-payroll-draft-employee"><strong>{employee?.name}</strong><span>{employee?.employeeNo} · {employee?.position || '—'}</span></div>
                    <label>Gross<input className="f-input" value={line.grossAmount} onChange={(e) => updateLine(line.employeeId, 'grossAmount', e.target.value)} /></label>
                    <label>PPh21<input className="f-input" value={line.pph21Amount} onChange={(e) => updateLine(line.employeeId, 'pph21Amount', e.target.value)} /></label>
                    <label>BPJS<input className="f-input" value={line.bpjsAmount} onChange={(e) => updateLine(line.employeeId, 'bpjsAmount', e.target.value)} /></label>
                    <label>Other<input className="f-input" value={line.otherDeduction} onChange={(e) => updateLine(line.employeeId, 'otherDeduction', e.target.value)} /></label>
                    <strong className="f-payroll-draft-net">{money(n(line.grossAmount) - deductions)}</strong>
                  </div>
                )
              })}
            </div>
            <div className="f-payroll-draft-summary">
              <span>Gross <strong>{money(draftTotals.gross)}</strong></span>
              <span>Deductions <strong>{money(draftTotals.deductions)}</strong></span>
              <span>Net <strong>{money(draftTotals.net)}</strong></span>
            </div>
            <div className="f-modal-actions">
              <button className="f-btn" onClick={() => setCreating(false)}>Batal</button>
              <button className="f-btn primary" disabled={saving || !runNumber} onClick={() => void createPayroll()}>{saving ? 'Menyimpan…' : 'Simpan DRAFT'}</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="f-modal-backdrop" onMouseDown={() => setDetail(null)}>
          <aside className="f-domain-drawer f-payroll-drawer" onMouseDown={(e) => e.stopPropagation()}>
            <div className="f-domain-drawer-head">
              <div><div className="f-eyebrow">PAYROLL RUN DETAIL</div><h2>{detail.runNumber}</h2><p>{detail.period} · pay date {fmtDate(detail.payDate)}</p></div>
              <button className="f-btn" onClick={() => setDetail(null)}>Tutup</button>
            </div>

            <div className="f-domain-drawer-body">
              <div className="f-grid-4 f-payroll-detail-kpis">
                <StatCard label="Headcount" value={detail.headcount} icon="project" />
                <StatCard label="Gross" value={money(n(detail.grossAmount))} icon="rp" />
                <StatCard label="Deductions" value={money(n(detail.deductionAmount))} icon="↘" />
                <StatCard label="Net" value={money(n(detail.netAmount))} icon="✓" />
              </div>

              <Card>
                <div className="f-card-head"><div><h3>Workflow</h3><p>State transition dan actor harus terlihat jelas.</p></div><Badge tone={statusTone(detail.status)}>{detail.status}</Badge></div>
                <div className="f-domain-workflow">
                  <div className={detail.status === 'DRAFT' ? 'current' : 'done'}>DRAFT</div>
                  <span>→</span>
                  <div className={detail.status === 'APPROVED' ? 'current' : detail.status === 'PAID' ? 'done' : ''}>APPROVED</div>
                  <span>→</span>
                  <div className={detail.status === 'PAID' ? 'current' : ''}>PAID</div>
                </div>
                {canWrite && <div className="f-row-actions">
                  {detail.status === 'DRAFT' && <button className="f-btn soft" disabled={saving} onClick={() => void action(detail.id, 'APPROVE')}>Approve Payroll</button>}
                  {detail.status === 'APPROVED' && <button className="f-btn primary" disabled={saving} onClick={() => void action(detail.id, 'PAY')}>Pay Payroll</button>}
                  {['DRAFT', 'APPROVED'].includes(detail.status) && <button className="f-btn" disabled={saving} onClick={() => void action(detail.id, 'CANCEL')}>Cancel</button>}
                </div>}
              </Card>

              <Card>
                <div className="f-card-head"><div><h3>Payroll lines</h3><p>Employee-level gross, deductions, net.</p></div></div>
                <div className="f-table-wrap">
                  <table className="f-table f-domain-table">
                    <thead><tr><th>Employee</th><th>Gross</th><th>PPh21</th><th>BPJS</th><th>Other</th><th>Net</th></tr></thead>
                    <tbody>{detail.lines.map((line) => (
                      <tr key={line.id}>
                        <td><strong>{line.employee.name}</strong><span className="f-table-sub">{line.employee.employeeNo} · {line.employee.position || '—'}</span></td>
                        <td>{money(n(line.grossAmount))}</td>
                        <td>{money(n(line.pph21Amount))}</td>
                        <td>{money(n(line.bpjsAmount))}</td>
                        <td>{money(n(line.otherDeduction))}</td>
                        <td><strong>{money(n(line.netAmount))}</strong></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <div className="f-card-head"><div><h3>Project cost allocation</h3><p>Allocation dihitung dari gross labor cost dan harus total 100% per employee jika ada allocation.</p></div></div>
                {detail.lines.flatMap((line) => line.allocations).length === 0 ? <div className="f-empty">Payroll ini belum memiliki project allocation. Ini valid untuk payroll overhead murni.</div> : (
                  <div className="f-table-wrap">
                    <table className="f-table f-domain-table">
                      <thead><tr><th>Employee</th><th>Project</th><th>Allocation</th><th>Cost</th></tr></thead>
                      <tbody>{detail.lines.flatMap((line) => line.allocations.map((allocation) => (
                        <tr key={line.id + '-' + allocation.project.id}>
                          <td>{line.employee.name}</td>
                          <td><strong>{allocation.project.projectCode}</strong><span className="f-table-sub">{allocation.project.projectName}</span></td>
                          <td>{n(allocation.percentage).toFixed(2)}%</td>
                          <td><strong>{money(n(allocation.amount))}</strong></td>
                        </tr>
                      )))}</tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <div className="f-card-head"><div><h3>Cashflow reference</h3><p>One payroll payment produces one canonical cashflow.</p></div></div>
                {detail.cashflow ? (
                  <div className="f-domain-source-row"><strong>{money(n(detail.cashflow.amount))}</strong><span>{fmtDate(detail.cashflow.transactionDate)} · {detail.cashflow.category}</span><Badge tone="green">Linked</Badge></div>
                ) : <div className="f-empty">Belum ada cashflow. Payroll baru menghasilkan cashflow saat PAID.</div>}
              </Card>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
