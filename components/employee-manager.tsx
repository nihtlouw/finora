
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'

type EmployeeRow = {
  id: string
  employeeNo: string
  name: string
  email: string | null
  taxId: string | null
  maritalStatus: string | null
  position: string | null
  department: string | null
  employmentType: string
  joinDate: string | null
  endDate: string | null
  baseSalary: number | string
  bankName: string | null
  bankAccount: string | null
  isActive: boolean
  latestPayroll: { runNumber: string; period: string; status: string; payDate: string } | null
}

type EmployeeDetail = EmployeeRow & {
  payrollLines: Array<{
    grossAmount: number | string
    pph21Amount: number | string
    bpjsAmount: number | string
    otherDeduction: number | string
    netAmount: number | string
    payrollRun: {
      runNumber: string
      period: string
      status: string
      payDate: string
    }
    allocations: Array<{
      percentage: number | string
      amount: number | string
      project: { projectCode: string; projectName: string; status: string }
    }>
  }>
}

const emptyForm = {
  employeeNo: '',
  name: '',
  email: '',
  taxId: '',
  maritalStatus: 'TK/0',
  position: '',
  department: '',
  employmentType: 'FULL_TIME',
  joinDate: '',
  endDate: '',
  baseSalary: '',
  bankName: '',
  bankAccount: '',
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
}

function maskAccount(value: string | null) {
  if (!value) return '—'
  if (value.length <= 4) return '••••'
  return '•••• ' + value.slice(-4)
}

function statusTone(status: string) {
  if (status === 'PAID' || status === 'APPROVED') return 'green' as const
  if (status === 'PENDING' || status === 'DRAFT') return 'amber' as const
  if (status === 'CANCELLED') return 'red' as const
  return 'neutral' as const
}

export default function EmployeeManager({ role }: { role: string }) {
  const canWrite = ['OWNER', 'FINANCE'].includes(role)
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('ALL')
  const [activeOnly, setActiveOnly] = useState('ACTIVE')
  const [detail, setDetail] = useState<EmployeeDetail | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/employees', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat karyawan.')
      setRows(data.employees || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat karyawan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function openDetail(id: string) {
    try {
      const res = await fetch('/api/employees/' + id, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail karyawan.')
      setDetail(data.employee)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat detail karyawan.')
    }
  }

  function startCreate() {
    setEditingId('NEW')
    setForm(emptyForm)
    setError('')
  }

  function startEdit(row: EmployeeRow) {
    setEditingId(row.id)
    setForm({
      employeeNo: row.employeeNo,
      name: row.name,
      email: row.email || '',
      taxId: row.taxId || '',
      maritalStatus: row.maritalStatus || 'TK/0',
      position: row.position || '',
      department: row.department || '',
      employmentType: row.employmentType || 'FULL_TIME',
      joinDate: row.joinDate ? row.joinDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      baseSalary: String(row.baseSalary || ''),
      bankName: row.bankName || '',
      bankAccount: row.bankAccount || '',
    })
    setDetail(null)
    setError('')
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const isNew = editingId === 'NEW'
      const payload: Record<string, unknown> = {
        ...form,
        baseSalary: form.baseSalary || 0,
        joinDate: form.joinDate || null,
        endDate: form.endDate || null,
      }
      if (!isNew) delete payload.employeeNo
      const url = isNew ? '/api/employees' : '/api/employees/' + editingId
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan karyawan.')
      setEditingId(null)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan karyawan.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: EmployeeRow) {
    if (!canWrite) return
    try {
      const res = await fetch('/api/employees/' + row.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status karyawan.')
      await load()
      if (detail?.id === row.id) await openDetail(row.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status karyawan.')
    }
  }

  const departments = useMemo(() => {
    return ['ALL', ...Array.from(new Set(rows.map((row) => row.department).filter(Boolean) as string[])).sort()]
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchSearch = !q || [row.employeeNo, row.name, row.position, row.department, row.email].some((v) => String(v || '').toLowerCase().includes(q))
      const matchDepartment = department === 'ALL' || row.department === department
      const matchActive = activeOnly === 'ALL' || (activeOnly === 'ACTIVE' ? row.isActive : !row.isActive)
      return matchSearch && matchDepartment && matchActive
    })
  }, [rows, search, department, activeOnly])

  const activeCount = rows.filter((row) => row.isActive).length
  const totalPayrollBase = rows.filter((row) => row.isActive).reduce((sum, row) => sum + Number(row.baseSalary || 0), 0)

  return (
    <div className="f-content f-domain-page">
      <PageHeader
        eyebrow="MASTER DATA / HR"
        title="Employees"
        description="Master karyawan yang menjadi sumber Payroll, project allocation, dan kontrol kompensasi."
        action={canWrite ? <button className="f-btn primary" onClick={startCreate}>+ Tambah Karyawan</button> : undefined}
      />

      {error && <div className="f-inline-alert error">{error}</div>}

      <div className="f-grid-4 f-domain-kpis">
        <StatCard label="Active headcount" value={activeCount} trend={rows.length + ' total employee'} icon="project" />
        <StatCard label="Payroll base / month" value={money(totalPayrollBase)} trend="Base salary aktif" icon="rp" />
        <StatCard label="Departments" value={Math.max(0, departments.length - 1)} trend="Master department" icon="▤" />
        <StatCard label="Latest payroll linked" value={rows.filter((row) => row.latestPayroll).length} trend="Employee punya payroll terakhir" icon="✓" />
      </div>

      <Card className="f-domain-card">
        <div className="f-domain-toolbar">
          <div>
            <strong>Employee master</strong>
            <span>{filtered.length} dari {rows.length} record</span>
          </div>
          <div className="f-domain-filters">
            <input className="f-input" placeholder="Cari nama / nomor / posisi..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="f-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'Semua department' : item}</option>)}
            </select>
            <select className="f-select" value={activeOnly} onChange={(e) => setActiveOnly(e.target.value)}>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
              <option value="ALL">Semua status</option>
            </select>
          </div>
        </div>

        {loading ? <div className="f-empty">Memuat karyawan…</div> : filtered.length === 0 ? (
          <div className="f-empty"><strong>Tidak ada karyawan</strong><span>Sesuaikan filter atau buat employee baru.</span></div>
        ) : (
          <div className="f-table-wrap">
            <table className="f-table f-domain-table f-employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position / Department</th>
                  <th>Status</th>
                  <th>Base Salary</th>
                  <th>Bank</th>
                  <th>Latest Payroll</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong><span className="f-table-sub">{row.employeeNo} · {row.email || 'email belum diisi'}</span></td>
                    <td><strong>{row.position || 'Posisi belum diisi'}</strong><span className="f-table-sub">{row.department || 'Department belum diisi'}</span></td>
                    <td><Badge tone={row.isActive ? 'green' : 'neutral'}>{row.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
                    <td className="f-number">{money(Number(row.baseSalary || 0))}</td>
                    <td><strong>{row.bankName || '—'}</strong><span className="f-table-sub">{maskAccount(row.bankAccount)}</span></td>
                    <td>{row.latestPayroll ? <><Badge tone={statusTone(row.latestPayroll.status)}>{row.latestPayroll.status}</Badge><span className="f-table-sub">{row.latestPayroll.period}</span></> : <span className="f-muted">Belum ada</span>}</td>
                    <td>
                      <div className="f-row-actions">
                        <button className="f-btn soft" onClick={() => void openDetail(row.id)}>Detail</button>
                        {canWrite && <button className="f-btn" onClick={() => startEdit(row)}>Edit</button>}
                        {canWrite && <button className="f-btn" onClick={() => void toggleActive(row)}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingId && (
        <div className="f-modal-backdrop" onMouseDown={() => { setEditingId(null); setForm(emptyForm) }}>
          <div className="f-modal-card f-domain-modal f-employee-create-modal f-full-workspace-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="f-card-head">
              <div><h3>{editingId === 'NEW' ? 'Tambah Employee' : 'Edit Employee'}</h3><p>Master data ini menjadi sumber Payroll dan project allocation.</p></div>
              <button className="f-btn" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Tutup</button>
            </div>
            <div className="f-domain-form-grid">
              <label>Nomor karyawan<input className="f-input" disabled={editingId !== 'NEW'} value={form.employeeNo} onChange={(e) => setForm({ ...form, employeeNo: e.target.value })} /></label>
              <label>Nama lengkap<input className="f-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Posisi<input className="f-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
              <label>Department<input className="f-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
              <label>Jenis kepegawaian<select className="f-select" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}><option value="FULL_TIME">Full Time</option><option value="CONTRACT">Contract</option><option value="DAILY_WORKER">Daily Worker</option><option value="INTERN">Intern</option></select></label>
              <label>Status pajak<input className="f-input" value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })} /></label>
              <label>Join date<input className="f-input" type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} /></label>
              <label>End date<input className="f-input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
              <label>Email<input className="f-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Tax ID<input className="f-input" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></label>
              <label>Base salary<input className="f-input" inputMode="numeric" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} /></label>
              <label>Bank<input className="f-input" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></label>
              <label className="f-domain-span-2">Nomor rekening<input className="f-input" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></label>
            </div>
            <div className="f-modal-actions">
              <button className="f-btn" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Batal</button>
              <button className="f-btn primary" disabled={saving} onClick={() => void save()}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="f-modal-backdrop" onMouseDown={() => setDetail(null)}>
          <aside className="f-domain-drawer" onMouseDown={(e) => e.stopPropagation()}>
            <div className="f-domain-drawer-head">
              <div><div className="f-eyebrow">EMPLOYEE DETAIL</div><h2>{detail.name}</h2><p>{detail.employeeNo} · {detail.position || 'Position belum diisi'}</p></div>
              <button className="f-btn" onClick={() => setDetail(null)}>Tutup</button>
            </div>
            <div className="f-domain-drawer-body">
              <div className="f-domain-detail-grid">
                <div><span>Department</span><strong>{detail.department || '—'}</strong></div>
                <div><span>Status</span><Badge tone={detail.isActive ? 'green' : 'neutral'}>{detail.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></div>
                <div><span>Employment</span><strong>{detail.employmentType}</strong></div>
                <div><span>Join date</span><strong>{fmtDate(detail.joinDate)}</strong></div>
                <div><span>Base salary</span><strong>{money(Number(detail.baseSalary || 0))}</strong></div>
                <div><span>Bank</span><strong>{detail.bankName || '—'} {detail.bankAccount ? '· ' + maskAccount(detail.bankAccount) : ''}</strong></div>
                <div><span>Tax ID</span><strong>{detail.taxId ? '••••' + detail.taxId.slice(-4) : '—'}</strong></div>
                <div><span>Status pajak</span><strong>{detail.maritalStatus || '—'}</strong></div>
              </div>

              <Card>
                <div className="f-card-head"><div><h3>Payroll history</h3><p>Payroll yang menggunakan employee ini.</p></div></div>
                {detail.payrollLines.length === 0 ? <div className="f-empty">Belum ada payroll history.</div> : (
                  <div className="f-table-wrap">
                    <table className="f-table f-domain-table">
                      <thead><tr><th>Run</th><th>Status</th><th>Gross</th><th>Deduction</th><th>Net</th></tr></thead>
                      <tbody>{detail.payrollLines.map((line, index) => (
                        <tr key={line.payrollRun.runNumber + '-' + index}>
                          <td><strong>{line.payrollRun.runNumber}</strong><span className="f-table-sub">{line.payrollRun.period}</span></td>
                          <td><Badge tone={statusTone(line.payrollRun.status)}>{line.payrollRun.status}</Badge></td>
                          <td>{money(Number(line.grossAmount))}</td>
                          <td>{money(Number(line.pph21Amount) + Number(line.bpjsAmount) + Number(line.otherDeduction))}</td>
                          <td>{money(Number(line.netAmount))}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <div className="f-card-head"><div><h3>Project allocations</h3><p>Payroll cost yang sudah dialokasikan ke project.</p></div></div>
                {detail.payrollLines.flatMap((line) => line.allocations).length === 0 ? <div className="f-empty">Belum ada project allocation.</div> : (
                  <div className="f-table-wrap">
                    <table className="f-table f-domain-table">
                      <thead><tr><th>Payroll</th><th>Project</th><th>%</th><th>Amount</th><th>Status</th></tr></thead>
                      <tbody>{detail.payrollLines.flatMap((line) => line.allocations.map((allocation) => (
                        <tr key={line.payrollRun.runNumber + '-' + allocation.project.projectCode}>
                          <td>{line.payrollRun.period}</td>
                          <td><strong>{allocation.project.projectCode}</strong><span className="f-table-sub">{allocation.project.projectName}</span></td>
                          <td>{Number(allocation.percentage).toFixed(2)}%</td>
                          <td>{money(Number(allocation.amount))}</td>
                          <td>{allocation.project.status}</td>
                        </tr>
                      )))}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
