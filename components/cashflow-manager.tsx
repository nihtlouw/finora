'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import ExpenseDetailPanel from '@/components/expense-detail-panel'

type Row = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  amount: number
  transactionDate: string
  sourceRef?: string | null
  paymentId?: string | null
  expenseId?: string | null
}

export default function CashflowManager({ role, initialRows }: { role: string; initialRows: Row[] }) {
  const params = useSearchParams()
  const focusExpenseId = params.get('expenseId') || ''
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(focusExpenseId || null)
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    type: 'INCOME',
    category: 'Penjualan',
    amount: 0,
    transactionDate: new Date().toISOString().slice(0, 10),
    sourceRef: '',
  })

  const canWrite = ['OWNER', 'FINANCE'].includes(role)
  const income = useMemo(() => rows.filter((x) => x.type === 'INCOME').reduce((s, x) => s + Number(x.amount), 0), [rows])
  const expense = useMemo(() => rows.filter((x) => x.type === 'EXPENSE').reduce((s, x) => s + Number(x.amount), 0), [rows])

  async function load() {
    const response = await fetch('/api/cashflow', { cache: 'no-store' })
    const text = await response.text()
    let data: any = {}
    try { data = text ? JSON.parse(text) : {} } catch { data = { error: `Server mengembalikan respons tidak valid (${response.status}).` } }
    if (!response.ok) throw new Error(data.error || 'Gagal memuat cash flow.')
    setRows(data.transactions || [])
  }

  useEffect(() => {
    if (initialRows.length === 0) load().catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (focusExpenseId) setSelectedExpenseId(focusExpenseId)
  }, [focusExpenseId])

  function startNew(){ setEditId(null); setForm({type:'INCOME',category:'Penjualan',amount:0,transactionDate:new Date().toISOString().slice(0,10),sourceRef:''}); setOpen(true); setError('') }
  function startEdit(row:Row){ if((row as any).paymentId || (row as any).expenseId) return; setEditId(row.id); setForm({type:row.type,category:row.category,amount:Number(row.amount),transactionDate:String(row.transactionDate).slice(0,10),sourceRef:row.sourceRef||''}); setOpen(true); setError('') }
  async function remove(row:Row){
    if(row.paymentId || row.expenseId){setError('Transaksi otomatis tidak dapat dihapus manual.');return}
    if(!confirm('Hapus transaksi kas ini?'))return
    const r=await fetch(`/api/cashflow/${row.id}`,{method:'DELETE'})
    const text=await r.text()
    let d:any={}
    try{d=text?JSON.parse(text):{}}catch{d={error:`Server mengembalikan respons tidak valid (${r.status}).`}}
    if(!r.ok){setError(d.error||'Gagal menghapus.');return}
    setNotice('Transaksi kas dihapus.')
    await load()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(editId ? `/api/cashflow/${editId}` : '/api/cashflow', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const text = await response.text()
      let data: any = {}
      try { data = text ? JSON.parse(text) : {} } catch { data = { error: `Server mengembalikan respons tidak valid (${response.status}).` } }
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan transaksi kas.')
      setOpen(false)
      setNotice(editId ? 'Transaksi kas diperbarui.' : 'Transaksi kas berhasil ditambahkan.')
      setForm({ type: 'INCOME', category: 'Penjualan', amount: 0, transactionDate: new Date().toISOString().slice(0, 10), sourceRef: '' })
      setEditId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan transaksi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="f-content">
      <PageHeader
        eyebrow="Kas"
        title="Cash Flow"
        description="Pantau uang masuk, keluar, dan saldo pergerakan kas dari transaksi nyata."
        action={canWrite ? <button className="f-btn primary" onClick={startNew}>＋ Transaksi Manual</button> : undefined}
      />
      {notice && <div style={{ marginBottom: 12 }}><span className="f-badge green">{notice}</span></div>}
      {error && <div style={{ marginBottom: 12 }}><span className="f-badge red">{error}</span></div>}
      <div className="f-grid-3">
        <StatCard label="Pemasukan" value={money(income)} trend="Income" icon="↗" />
        <StatCard label="Pengeluaran" value={money(expense)} trend="Expense" icon="↘" />
        <StatCard label="Net cashflow" value={money(income - expense)} trend="Income - Expense" icon="◎" />
      </div>
      <div style={{ height: 16 }} />
      <Card>
        <div className="f-card-head">
          <div><h3>Transaksi</h3><p>Payment dan Expense tercatat otomatis; transaksi lain dapat dicatat manual.</p></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="f-table">
            <thead><tr><th>Tanggal</th><th>Kategori</th><th>Sumber</th><th>Tipe</th><th>Nominal</th>{canWrite&&<th>Aksi</th>}</tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td>{new Date(x.transactionDate).toLocaleDateString('id-ID')}</td>
                  <td>{x.category}</td>
                  <td>{x.sourceRef || '—'}</td>
                  <td><Badge tone={x.type === 'INCOME' ? 'green' : 'red'}>{x.type}</Badge></td>
                  <td className="f-number">{x.type === 'INCOME' ? '+' : '-'}{money(Number(x.amount))}</td>{canWrite&&<td><div style={{display:'flex',alignItems:'center',gap:6}}>{(x as any).paymentId || (x as any).expenseId ? <>{(x as any).expenseId && <button className="f-btn soft" onClick={()=>setSelectedExpenseId((x as any).expenseId)}>Lihat Expense</button>}<span className="f-badge">Otomatis · Terkunci</span></> : <><button className="f-btn soft" onClick={()=>startEdit(x)}>Edit</button><button className="f-btn" onClick={()=>remove(x)}>Hapus</button></>}</div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="f-empty"><strong>Belum ada transaksi</strong>Catat transaksi pertama atau lakukan pembayaran / expense untuk mengisi cash flow.</div>}
      </Card>

      {selectedExpenseId && <ExpenseDetailPanel expenseId={selectedExpenseId} onClose={() => setSelectedExpenseId(null)} />}

      {open && (
        <div className="f-modal-backdrop" role="presentation">
          <div className="f-card" style={{ width: 'min(520px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="f-card-head"><div><h3>{editId?'Edit Transaksi Kas':'Transaksi Kas Manual'}</h3><p>Gunakan untuk modal, pinjaman, penyesuaian kas, dan transaksi non-invoice.</p></div><button className="f-btn" onClick={() => setOpen(false)}>Tutup</button></div>
            <form className="f-form" onSubmit={submit}>
              <label>Jenis<select className="f-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="INCOME">Pemasukan</option><option value="EXPENSE">Pengeluaran</option></select></label>
              <label>Kategori<input className="f-input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
              <label>Nominal<input className="f-input" required min="1" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></label>
              <label>Tanggal<input className="f-input" required type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} /></label>
              <label>Referensi<input className="f-input" value={form.sourceRef} onChange={(e) => setForm({ ...form, sourceRef: e.target.value })} placeholder="Contoh: Modal owner / Pinjaman bank" /></label>
              <button className="f-btn primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan transaksi'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
