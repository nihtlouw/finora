'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import { SideDrawer } from '@/components/finora-side-drawer'
import { EXPENSE_CATEGORY_OPTIONS } from '@/lib/expenses'
import ExpenseDetailPanel from '@/components/expense-detail-panel'

type Vendor = { id: string; name: string }
type Project = { id: string; projectCode: string; projectName: string; status: string; contractValue: number }
type Item = { id?: string; description: string; quantity: number | string; unit: string; unitPrice: number | string; totalAmount?: number | string }
type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }
type Allocation = { id: string; projectId: string; percentage: number; amount: number; note?: string | null }
type Expense = {
  id: string
  category: string
  amount: number
  expenseDate: string
  status: string
  settlementStatus: string
  paidAt?: string | null
  description?: string | null
  paymentMethod?: string | null
  payeeName?: string | null
  vendor?: Vendor | null
  project?: Project | null
  items: Item[]
  attachments: Attachment[]
  allocations?: Allocation[]
}
type FormItem = { description: string; quantity: string; unit: string; unitPrice: string }
type FormState = {
  projectId: string
  vendorId: string
  payeeName: string
  category: string
  expenseDate: string
  paymentMethod: string
  description: string
  items: FormItem[]
}

const blankItem = (): FormItem => ({ description: '', quantity: '1', unit: 'pcs', unitPrice: '' })
const moneyValue = (n: number) => money(Number(n || 0))
const read = async (response: Response) => {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: `Respons server tidak valid (${response.status}).` }
  }
}
const categoryLabel = (value: string) => EXPENSE_CATEGORY_OPTIONS.find((x) => x.value === value)?.label || value

export default function ExpenseCostControlManager({ role }: { role: string }) {
  const params = useSearchParams()
  const focusExpenseId = params.get('focus') || ''
  const canWrite = ['OWNER', 'FINANCE'].includes(role)
  const [rows, setRows] = useState<Expense[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [form, setForm] = useState<FormState>({
    projectId: '',
    vendorId: '',
    payeeName: '',
    category: 'MATERIAL',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BANK_TRANSFER',
    description: '',
    items: [blankItem()],
  })
  const [files, setFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([])
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(focusExpenseId || null)

  async function load() {
    const [expenseResponse, vendorResponse, projectResponse] = await Promise.all([
      fetch('/api/expenses', { cache: 'no-store' }),
      fetch('/api/clients?type=VENDOR', { cache: 'no-store' }),
      fetch('/api/projects', { cache: 'no-store' }),
    ])
    const [expenseData, vendorData, projectData] = await Promise.all([read(expenseResponse), read(vendorResponse), read(projectResponse)])
    setRows(expenseData.expenses || [])
    setVendors(vendorData.clients || [])
    setProjects(
      (projectData.projects || []).map((x: any) => ({
        id: x.id,
        projectCode: x.projectCode,
        projectName: x.projectName,
        status: x.status,
        contractValue: Number(x.contractValue || 0),
      })),
    )
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (focusExpenseId) setDetailExpenseId(focusExpenseId)
  }, [focusExpenseId])

  function resetForm() {
    setForm({
      projectId: '',
      vendorId: '',
      payeeName: '',
      category: 'MATERIAL',
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK_TRANSFER',
      description: '',
      items: [blankItem()],
    })
  }

  function startNew() {
    setEditId(null)
    setExistingAttachments([])
    setFiles([])
    setMessage('')
    resetForm()
    setOpen(true)
  }

  function startEdit(expense: Expense) {
    setEditId(expense.id)
    setExistingAttachments(expense.attachments || [])
    setFiles([])
    setMessage('')
    setForm({
      projectId: expense.project?.id || expense.allocations?.[0]?.projectId || '',
      vendorId: expense.vendor?.id || '',
      payeeName: expense.payeeName || '',
      category: EXPENSE_CATEGORY_OPTIONS.some((c) => c.value === expense.category) ? expense.category : 'LAINNYA',
      expenseDate: String(expense.expenseDate).slice(0, 10),
      paymentMethod: expense.paymentMethod || 'BANK_TRANSFER',
      description: expense.description || '',
      items: expense.items?.length
        ? expense.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
          }))
        : [{ description: expense.description || 'Biaya lama', quantity: '1', unit: 'transaksi', unitPrice: String(expense.amount) }],
    })
    setOpen(true)
  }

  function updateItem(index: number, patch: Partial<FormItem>) {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) }))
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, blankItem()] }))
  }

  function removeItem(index: number) {
    setForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const formTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
    [form.items],
  )
  const hasParty = Boolean(form.vendorId || form.payeeName.trim())
  const filtered = rows.filter(
    (expense) =>
      (categoryFilter === 'ALL' || String(expense.category).toUpperCase() === categoryFilter) &&
      (projectFilter === 'ALL' || expense.project?.id === projectFilter),
  )
  const totals = useMemo(
    () => ({
      amount: rows.reduce((sum, expense) => sum + Number(expense.amount), 0),
      pending: rows.filter((expense) => expense.status === 'PENDING').length,
      projectCost: rows.filter((expense) => expense.project && expense.status === 'APPROVED').reduce((sum, expense) => sum + Number(expense.amount), 0),
    }),
    [rows],
  )

  async function uploadFiles(expenseId: string) {
    const failed: string[] = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/expenses/${expenseId}/attachments`, { method: 'POST', body: formData })
      const data = await read(response)
      if (!response.ok) failed.push(`${file.name}: ${data.error || 'gagal upload'}`)
    }
    return failed
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (!form.projectId) throw new Error('Project wajib dipilih untuk setiap biaya project.')
      if (!hasParty) throw new Error('Isi Vendor master atau Pihak/Penerima jika pengeluaran tidak memakai vendor master.')
      if (!form.category) throw new Error('Kategori wajib dipilih.')
      if (!form.items.length) throw new Error('Minimal satu item biaya harus ada.')
      if (form.items.some((item) => !item.description.trim() || !item.unit.trim() || !(Number(item.quantity) > 0) || !(Number(item.unitPrice) > 0))) {
        throw new Error('Lengkapi nama item, qty, satuan, dan harga satuan.')
      }
      if (files.length > 5) throw new Error('Maksimal 5 file bukti per transaksi.')
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} lebih besar dari 5 MB.`)
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error(`${file.name} harus berupa PDF, JPG/JPEG, PNG, atau WebP.`)
        }
      }
      const payload = {
        projectId: form.projectId,
        vendorId: form.vendorId || null,
        payeeName: form.payeeName.trim() || null,
        category: form.category,
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        description: form.description,
        items: form.items,
      }
      const url = editId ? `/api/expenses/${editId}` : '/api/expenses'
      const response = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await read(response)
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan biaya.')

      const failed = await uploadFiles(data.expense.id)
      setOpen(false)
      setFiles([])
      setExistingAttachments([])
      await load()
      setMessage(
        failed.length
          ? `Biaya tersimpan, tetapi ${failed.length} bukti gagal diupload. ${failed.join(' | ')}`
          : editId
            ? 'Biaya diperbarui.'
            : 'Biaya berhasil dicatat.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan biaya.')
    } finally {
      setBusy(false)
    }
  }

  async function approve(id: string) {
    setBusy(true)
    const response = await fetch(`/api/expenses/${id}/approve`, { method: 'POST' })
    const data = await read(response)
    setMessage(response.ok ? 'Biaya disetujui.' : data.error || `Gagal menyetujui (${response.status}).`)
    if (response.ok) await load()
    setBusy(false)
  }

  async function pay(id: string) {
    if (!confirm('Tandai biaya ini sebagai sudah dibayar dan masukkan ke Cash Flow?')) return
    setBusy(true)
    const response = await fetch(`/api/expenses/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await read(response)
    setMessage(response.ok ? 'Biaya ditandai PAID dan masuk Cash Flow.' : data.error || `Gagal membayar (${response.status}).`)
    if (response.ok) await load()
    setBusy(false)
  }

  async function remove(id: string) {
    if (!confirm('Hapus biaya yang masih PENDING ini?')) return
    setBusy(true)
    const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    const data = await read(response)
    setMessage(response.ok ? 'Biaya dihapus.' : data.error || `Gagal menghapus (${response.status}).`)
    if (response.ok) await load()
    setBusy(false)
  }

  async function removeAttachment(id: string, attachment: Attachment) {
    if (!confirm(`Hapus bukti ${attachment.fileName}?`)) return
    const response = await fetch(`/api/expenses/${id}/attachments/${attachment.id}`, { method: 'DELETE' })
    const data = await read(response)
    if (!response.ok) {
      setMessage(data.error || 'Gagal menghapus bukti.')
      return
    }
    setExistingAttachments((current) => current.filter((item) => item.id !== attachment.id))
    setMessage('Bukti dihapus.')
  }

  return (
    <div className="f-content f-expense-page">
      <PageHeader
        eyebrow="PROJECT COST CONTROL"
        title="Biaya Project"
        description="Catat actual cost per project dengan detail item yang jelas. Vendor dipakai saat relevan; pengeluaran non-vendor tetap bisa dicatat dengan pihak/penerima."
        action={canWrite && <button className="f-btn primary" onClick={startNew}>＋ Tambah biaya</button>}
      />

      {message && <div className="f-inline-alert success" style={{ marginBottom: 12 }}>{message}</div>}

      <div className="f-grid-4">
        <StatCard label="Total biaya" value={moneyValue(totals.amount)} icon="◈" />
        <StatCard label="Project cost" value={moneyValue(totals.projectCost)} icon="▦" />
        <StatCard label="Menunggu approval" value={totals.pending} icon="!" />
        <StatCard label="Transaksi" value={rows.length} icon="#" />
      </div>

      <div style={{ height: 16 }} />
      <Card>
        <div className="f-toolbar">
          <div><strong>Daftar biaya</strong><span className="f-muted" style={{ marginLeft: 8 }}>{filtered.length} data</span></div>
          <div className="f-toolbar-actions">
            <select className="f-select" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="ALL">Semua project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode}</option>)}
            </select>
            <select className="f-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="ALL">Semua kategori</option>
              {EXPENSE_CATEGORY_OPTIONS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="f-table f-expense-table">
            <thead><tr><th>Tanggal</th><th>Project</th><th>Pihak</th><th>Kategori</th><th>Detail</th><th>Total</th><th>Bukti</th><th>Approval</th><th>Settlement</th><th>Aksi</th></tr></thead>
            <tbody>
              {filtered.map((expense) => (
                <tr key={expense.id}>
                  <td>{new Date(expense.expenseDate).toLocaleDateString('id-ID')}</td>
                  <td><strong>{expense.project?.projectCode || 'Legacy / belum dipetakan'}</strong><div className="f-muted">{expense.project?.projectName || '—'}</div></td>
                  <td>
                    <strong>{expense.vendor?.name || expense.payeeName || '—'}</strong>
                    <div className="f-muted">{expense.vendor ? 'Vendor master' : 'Pihak / penerima'}</div>
                  </td>
                  <td><Badge tone="blue">{categoryLabel(expense.category)}</Badge></td>
                  <td><strong>{expense.items?.[0]?.description || expense.description || '—'}</strong>{expense.items?.length > 1 && <div className="f-muted">+{expense.items.length - 1} item lainnya</div>}</td>
                  <td className="f-number">{moneyValue(Number(expense.amount))}</td>
                  <td>{expense.attachments?.length ? <span className="f-badge green">{expense.attachments.length} file</span> : <span className="f-muted">—</span>}</td>
                  <td><Badge tone={expense.status === 'APPROVED' ? 'green' : 'amber'}>{expense.status}</Badge></td><td><Badge tone={expense.settlementStatus === 'PAID' ? 'green' : 'amber'}>{expense.settlementStatus}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="f-btn soft" disabled={busy} onClick={() => setDetailExpenseId(expense.id)}>Detail</button>
                      {expense.status === 'PENDING' && canWrite && <button className="f-btn soft" disabled={busy} onClick={() => startEdit(expense)}>Edit</button>}
                      {expense.status === 'PENDING' && canWrite && <button className="f-btn soft" disabled={busy} onClick={() => approve(expense.id)}>Approve</button>}
                      {expense.status === 'PENDING' && canWrite && <button className="f-btn" disabled={busy} onClick={() => remove(expense.id)}>Hapus</button>}
                      {expense.status === 'APPROVED' && expense.settlementStatus !== 'PAID' && <button className="f-btn soft" disabled={busy} onClick={() => pay(expense.id)}>Bayar</button>}{expense.status === 'APPROVED' && expense.settlementStatus === 'PAID' && <span className="f-badge green">Lunas</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <div className="f-empty"><strong>Belum ada biaya project</strong>Tambahkan pengeluaran project untuk mulai membentuk actual cost dan profitability.</div>}
      </Card>

      {detailExpenseId && (
        <ExpenseDetailPanel expenseId={detailExpenseId} onClose={() => setDetailExpenseId(null)} canManage={canWrite} onEdit={(expenseId) => { setDetailExpenseId(null); const row = rows.find((expense) => expense.id === expenseId); if (row) startEdit(row) }} />
      )}

      {open && (
        <SideDrawer
          className="f-full-workspace expense-entry-workspace"
          open={open}
          onClose={() => !busy && setOpen(false)}
          title={editId ? 'Edit biaya project' : 'Catat pengeluaran'}
          description="Setiap biaya baru ditautkan ke project, memiliki bukti transaksi, dan memengaruhi actual cost setelah approval."
          footer={<div className="f-drawer-actions">
            <button type="button" className="f-btn" onClick={() => !busy && setOpen(false)} disabled={busy}>Batal</button>
            <button className="f-btn primary expense-save-button" form="expense-entry-form" disabled={busy || !form.projectId || !hasParty || !form.category || formTotal <= 0}>{busy ? 'Menyimpan...' : editId ? 'Simpan perubahan' : 'Simpan biaya'}</button>
          </div>}
        >
            <form id="expense-entry-form" className="f-modal-body expense-entry-body" onSubmit={save}>
              <section className="expense-form-section">
                <div className="expense-section-heading">
                  <div className="expense-section-number">01</div>
                  <div><h4>Konteks pengeluaran</h4><p>Tentukan project, kategori, tanggal, dan pihak yang terkait.</p></div>
                </div>
                <div className="expense-context-grid">
                  <label className="expense-field expense-field-project">
                    <span>Project <b>*</b></span>
                    <select className="f-select" required value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
                      <option value="">Pilih project</option>
                      {projects.filter((project) => project.status !== 'CANCELLED').map((project) => <option key={project.id} value={project.id}>{project.projectCode} · {project.projectName}</option>)}
                    </select>
                    <small>Setiap biaya baru wajib masuk ke satu project.</small>
                  </label>

                  <label className="expense-field">
                    <span>Kategori <b>*</b></span>
                    <select className="f-select" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                      {EXPENSE_CATEGORY_OPTIONS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                  </label>

                  <label className="expense-field">
                    <span>Tanggal <b>*</b></span>
                    <input className="f-input" required type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
                  </label>

                  <label className="expense-field">
                    <span>Metode pembayaran</span>
                    <select className="f-select" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
                      <option value="BANK_TRANSFER">Transfer Bank</option>
                      <option value="CASH">Cash / Petty Cash</option>
                      <option value="CARD">Kartu</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </label>

                  <div className="expense-party-box">
                    <div className="expense-party-title"><span>Pihak terkait</span><span className="expense-optional">vendor tidak wajib</span></div>
                    <div className="expense-party-grid">
                      <label className="expense-field">
                        <span>Vendor master <em>(opsional)</em></span>
                        <select className="f-select" value={form.vendorId} onChange={(event) => setForm({ ...form, vendorId: event.target.value })}>
                          <option value="">Tidak menggunakan vendor master</option>
                          {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                        </select>
                      </label>
                      <label className="expense-field">
                        <span>Pihak / penerima <em>(opsional bila vendor dipilih)</em></span>
                        <input className="f-input" value={form.payeeName} onChange={(event) => setForm({ ...form, payeeName: event.target.value })} placeholder="Contoh: Reimburse Budi / SPBU / tukang harian" />
                      </label>
                    </div>
                    <div className={`expense-party-hint ${hasParty ? 'is-valid' : ''}`}>
                      {hasParty ? '✓ Pihak pengeluaran sudah tercatat.' : 'Isi salah satu: Vendor master atau Pihak / penerima. Ini membuat biaya non-vendor tetap terlacak.'}
                    </div>
                  </div>

                  <label className="expense-field expense-field-full">
                    <span>Catatan transaksi</span>
                    <input className="f-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Contoh: BBM kendaraan operasional untuk kunjungan lapangan" />
                  </label>
                </div>
              </section>

              <section className="expense-form-section expense-items-section">
                <div className="expense-section-heading expense-section-heading-between">
                  <div className="expense-heading-left"><div className="expense-section-number">02</div><div><h4>Detail biaya</h4><p>Masukkan apa yang dibeli. Total dihitung otomatis dari Qty × Harga Satuan.</p></div></div>
                  <Badge tone="green">{form.items.length} item</Badge>
                </div>

                <div className="expense-items-list">
                  {form.items.map((item, index) => (
                    <div className="expense-item-card" key={index}>
                      <div className="expense-item-card-top">
                        <div className="expense-item-index">{index + 1}</div>
                        <strong>Item biaya</strong>
                        {form.items.length > 1 && <button type="button" className="expense-remove-item" onClick={() => removeItem(index)} aria-label={`Hapus item ${index + 1}`}>Hapus</button>}
                      </div>
                      <div className="expense-item-grid">
                        <label className="expense-field expense-item-description"><span>Item / uraian <b>*</b></span><input className="f-input" required value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="Contoh: Pertalite kendaraan operasional" /></label>
                        <label className="expense-field"><span>Qty <b>*</b></span><input className="f-input" required type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></label>
                        <label className="expense-field"><span>Satuan <b>*</b></span><input className="f-input" required value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} placeholder="liter / pcs / hari" /></label>
                        <label className="expense-field"><span>Harga satuan <b>*</b></span><input className="f-input" required type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: event.target.value })} placeholder="125000" /></label>
                        <div className="expense-item-total"><span>Total item</span><strong>{moneyValue((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="expense-items-footer">
                  <button type="button" className="f-btn soft" onClick={addItem}>＋ Tambah item</button>
                  <div className="expense-grand-total"><span>Total biaya</span><strong>{moneyValue(formTotal)}</strong></div>
                </div>
              </section>

              <section className="expense-form-section">
                <div className="expense-section-heading expense-section-heading-between">
                  <div className="expense-heading-left"><div className="expense-section-number">03</div><div><h4>Bukti & dokumentasi</h4><p>Tambahkan nota, invoice, foto, atau bukti pembayaran untuk audit trail.</p></div></div>
                  <Badge tone="blue">PDF / JPG / PNG / WebP</Badge>
                </div>
                <div className="expense-upload-box">
                  <div className="expense-upload-title">Bukti transaksi</div>
                  <div className="expense-upload-copy">Maksimal 5 file, masing-masing 5 MB. Bukti bisa diunggah setelah transaksi dicatat.</div>
                  <input className="f-input" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                </div>
                {files.length > 0 && <div className="expense-file-list">{files.map((file) => <div className="expense-file-row" key={file.name + file.size}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div>)}</div>}
                {existingAttachments.length > 0 && <div className="expense-file-list"><strong>Bukti tersimpan</strong>{existingAttachments.map((attachment) => <div className="expense-file-row" key={attachment.id}><a href={`/api/expenses/${editId}/attachments/${attachment.id}`} target="_blank" rel="noreferrer">{attachment.fileName}</a><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><small>{(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB</small>{editId && <button type="button" className="f-btn" onClick={() => removeAttachment(editId, attachment)}>Hapus</button>}</div></div>)}</div>}
              </section>

              <div className="expense-entry-note"><strong>Bagaimana biaya memengaruhi project?</strong><span>Biaya yang sudah APPROVED menjadi actual cost project. Biaya di atas batas approval tetap PENDING sampai disetujui Finance/Owner.</span></div>

              
            </form>
      </SideDrawer>
      )}
    </div>
  )
}
