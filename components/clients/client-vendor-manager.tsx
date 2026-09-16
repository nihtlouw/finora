'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Client = {
  id: string
  name: string
  type: string
  category: string | null
  offerings: string | null
  email: string | null
  phone: string | null
  picName: string | null
  address: string | null
  npwp: string | null
  isActive: boolean
}

type Props = { initialClients: Client[]; workspace: { id: string; name: string }; role: string }

const CLIENT_CATEGORIES = [
  'OWNER / END USER',
  'KONTRAKTOR',
  'DEVELOPER',
  'INSTANSI / PEMERINTAH',
  'PERUSAHAAN SWASTA',
  'RESELLER / DISTRIBUTOR',
  'LAINNYA',
]

const VENDOR_CATEGORIES = [
  'SUPPLIER MATERIAL',
  'PENYEDIA JASA',
  'SUBKONTRAKTOR',
  'TRANSPORTASI / LOGISTIK',
  'PERALATAN / SEWA',
  'OPERASIONAL',
  'TENAGA AHLI / FREELANCER',
  'LAINNYA',
]

const empty = {
  name: '',
  type: 'CLIENT',
  category: '',
  offerings: '',
  email: '',
  phone: '',
  picName: '',
  address: '',
  npwp: '',
  isActive: true,
}

const canManage = (role: string) => ['OWNER', 'FINANCE', 'SALES'].includes(role)
const canDelete = (role: string) => ['OWNER', 'FINANCE'].includes(role)

function categoryOptions(type: string) {
  return type === 'VENDOR' ? VENDOR_CATEGORIES : CLIENT_CATEGORIES
}

function offeringLabel(type: string) {
  return type === 'VENDOR' ? 'Produk / jasa yang disediakan' : 'Bidang / kebutuhan utama'
}

function offeringPlaceholder(type: string) {
  return type === 'VENDOR'
    ? 'Contoh: kabel listrik, MCB, panel, instalasi listrik, maintenance AC'
    : 'Contoh: gedung, konstruksi, manufaktur, IoT, pengadaan IT'
}

function excerpt(value: string | null, max = 74) {
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max)}…` : value
}

export default function ClientVendorManager({ initialClients, workspace, role }: Props) {
  const [rows, setRows] = useState(initialClients)
  const [q, setQ] = useState('')
  const [type, setType] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const [archived, setArchived] = useState(false)
  const [form, setForm] = useState<any>(empty)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const availableCategories = useMemo(() => {
    const source = type === 'VENDOR' ? VENDOR_CATEGORIES : type === 'CLIENT' ? CLIENT_CATEGORIES : [...CLIENT_CATEGORIES, ...VENDOR_CATEGORIES]
    return Array.from(new Set(source))
  }, [type])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((x) => {
      const haystack = `${x.name} ${x.category || ''} ${x.offerings || ''} ${x.email || ''} ${x.picName || ''} ${x.phone || ''}`.toLowerCase()
      return (type === 'ALL' || x.type === type) &&
        (category === 'ALL' || x.category === category) &&
        (archived || x.isActive) &&
        (!needle || haystack.includes(needle))
    })
  }, [rows, q, type, category, archived])

  const stats = {
    clients: rows.filter((x) => x.type === 'CLIENT' && x.isActive).length,
    vendors: rows.filter((x) => x.type === 'VENDOR' && x.isActive).length,
    inactive: rows.filter((x) => !x.isActive).length,
  }

  function applyType(nextType: string) {
    setForm((current: any) => ({ ...current, type: nextType, category: '' }))
  }

  function edit(x?: Client) {
    setForm(x ? { ...x } : { ...empty })
    setOpen(true)
    setNotice('')
  }

  async function save(e: any) {
    e.preventDefault()
    setSaving(true)
    setNotice('')
    try {
      const editing = Boolean(form.id)
      const response = await fetch(editing ? `/api/clients/${form.id}` : '/api/clients', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRows((current) => editing
        ? current.map((x) => x.id === data.client.id ? data.client : x)
        : [...current, data.client].sort((a, b) => a.name.localeCompare(b.name)))
      setOpen(false)
      setNotice(editing ? 'Kontak diperbarui.' : 'Kontak ditambahkan.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function archive(x: Client) {
    if (!canDelete(role)) return
    if (!confirm(`${x.name} akan dinonaktifkan. Lanjutkan?`)) return
    const response = await fetch(`/api/clients/${x.id}`, { method: 'DELETE' })
    const data = await response.json()
    if (response.ok) {
      setRows((current) => data.action === 'deleted' ? current.filter((z: Client) => z.id !== x.id) : current.map((z: Client) => z.id === x.id ? data.client : z))
      setNotice(data.action === 'deleted' ? 'Kontak dihapus.' : 'Kontak diarsipkan.')
    } else {
      setNotice(data.error || 'Gagal.')
    }
  }

  return (
    <div className="f-content">
      <div className="f-pagehead">
        <div>
          <div className="f-eyebrow">Master Data</div>
          <h1>Klien & Vendor</h1>
          <p>Cari kontak berdasarkan nama perusahaan, bahan/jasa yang disediakan, bidang, PIC, atau informasi kontak.</p>
        </div>
        <button className="f-btn primary" onClick={() => {
          if (!canManage(role)) {
            setNotice('Role Viewer tidak memiliki izin menambah atau mengubah Klien/Vendor. Masuk sebagai Owner, Finance, atau Sales.')
            return
          }
          edit()
        }}>＋ Tambah Kontak</button>
      </div>

      <div className="f-grid-3" style={{ marginBottom: 16 }}>
        <Stat label="Klien Aktif" value={stats.clients} icon="♙" />
        <Stat label="Vendor Aktif" value={stats.vendors} icon="▣" />
        <Stat label="Diarsipkan" value={stats.inactive} icon="□" />
      </div>

      <div className="f-panel-grid">
        <section className="f-card">
          <div className="f-card-head">
            <div>
              <h3>Master kontak</h3>
              <p>{filtered.length} kontak ditampilkan. Pencarian juga membaca kategori dan produk/jasa.</p>
            </div>
            <div className="f-badge neutral">Workspace: {workspace.name}</div>
          </div>

          <div className="f-toolbar" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
            <input
              className="f-input"
              style={{ minWidth: 260, flex: '1 1 300px' }}
              placeholder="Cari perusahaan, bahan, jasa, PIC..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="f-select" value={type} onChange={(e) => { setType(e.target.value); setCategory('ALL') }}>
              <option value="ALL">Semua tipe</option>
              <option value="CLIENT">Klien</option>
              <option value="VENDOR">Vendor</option>
            </select>
            <select className="f-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="ALL">Semua kategori</option>
              {availableCategories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <label className="f-badge neutral" style={{ gap: 6, alignSelf: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Arsip
            </label>
          </div>

          {notice && <div style={{ padding: '0 16px 12px' }}><span className="f-badge green">{notice}</span></div>}

          <div style={{ overflowX: 'auto' }}>
            <table className="f-table">
              <thead>
                <tr>
                  <th>Nama / Perusahaan</th>
                  <th>Tipe</th>
                  <th>Kategori</th>
                  <th>Produk / Jasa</th>
                  <th>Kontak</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <strong>{x.name}</strong>
                      <div className="f-muted" style={{ fontSize: 10 }}>{x.picName || 'PIC belum diisi'}</div>
                    </td>
                    <td><span className={`f-badge ${x.type === 'CLIENT' ? 'blue' : 'amber'}`}>{x.type === 'CLIENT' ? 'Klien' : 'Vendor'}</span></td>
                    <td>{x.category || <span className="f-muted">Belum dikategorikan</span>}</td>
                    <td style={{ maxWidth: 250 }}>{excerpt(x.offerings)}</td>
                    <td><div>{x.email || '—'}</div><div className="f-muted" style={{ fontSize: 10 }}>{x.phone || '—'}</div></td>
                    <td><span className={`f-badge ${x.isActive ? 'green' : 'neutral'}`}>{x.isActive ? 'Aktif' : 'Diarsipkan'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Link href={`/clients/${x.id}`} className="f-btn soft">Detail</Link>
                        {canManage(role) && <button className="f-btn" onClick={() => edit(x)}>Edit</button>}
                        {canDelete(role) && x.isActive && <button className="f-btn" onClick={() => archive(x)}>Arsip</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filtered.length && <div className="f-empty"><strong>Tidak ada kontak yang cocok</strong>Coba cari dengan nama perusahaan, kata seperti “kabel”, “panel”, “instalasi”, kategori, atau nama PIC.</div>}
        </section>

        <section className="f-card">
          <div className="f-card-head">
            <div>
              <h3>Tambah kontak</h3>
              <p>Isi identitas minimum terlebih dahulu. Email tidak wajib agar vendor lapangan bisa segera dicatat.</p>
            </div>
          </div>

          <form className="f-form" onSubmit={save}>
            <label>
              Tipe
              <select className="f-select" value={form.type} onChange={(e) => applyType(e.target.value)}>
                <option value="CLIENT">Klien</option>
                <option value="VENDOR">Vendor</option>
              </select>
            </label>

            <label>
              Kategori *
              <select className="f-select" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Pilih kategori</option>
                {categoryOptions(form.type).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <label>
              Nama perusahaan *
              <input className="f-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === 'VENDOR' ? 'PT / CV / toko / penyedia jasa' : 'PT / CV / instansi klien'} />
            </label>

            <label>
              {offeringLabel(form.type)} *
              <textarea className="f-textarea" required value={form.offerings} onChange={(e) => setForm({ ...form, offerings: e.target.value })} placeholder={offeringPlaceholder(form.type)} />
              <small className="f-muted">Pisahkan beberapa item dengan koma agar mudah ditemukan saat mencari.</small>
            </label>

            <label>
              PIC
              <input className="f-input" value={form.picName} onChange={(e) => setForm({ ...form, picName: e.target.value })} placeholder="Nama PIC" />
            </label>

            <label>
              Email
              <input className="f-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="finance@perusahaan.id" />
            </label>

            <label>
              Telepon
              <input className="f-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+62 ..." />
            </label>

            <label>Alamat<textarea className="f-textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>NPWP<input className="f-input" value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} /></label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="f-btn" onClick={() => setForm({ ...empty })}>Reset</button>
              <button className="f-btn primary" disabled={saving || !canManage(role)}>
                {!canManage(role) ? 'Tidak punya akses' : saving ? 'Menyimpan...' : 'Simpan Kontak'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,39,35,.38)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div className="f-card" style={{ width: 'min(760px,100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="f-card-head">
              <div><h3>{form.id ? 'Edit Kontak' : 'Tambah Kontak'}</h3><p>Master data ini dipakai untuk proposal, invoice, expense, PO, dan histori transaksi.</p></div>
              <button className="f-btn" onClick={() => setOpen(false)}>Tutup</button>
            </div>
            <form className="f-form" onSubmit={save}>
              <div className="f-form-grid">
                <label>Nama perusahaan *<input className="f-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label>Tipe<select className="f-select" value={form.type} onChange={(e) => applyType(e.target.value)}><option value="CLIENT">Klien</option><option value="VENDOR">Vendor</option></select></label>
                <label>Kategori *<select className="f-select" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Pilih kategori</option>{categoryOptions(form.type).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label className="full">{offeringLabel(form.type)} *<textarea className="f-textarea" required value={form.offerings} onChange={(e) => setForm({ ...form, offerings: e.target.value })} placeholder={offeringPlaceholder(form.type)} /></label>
                <label>PIC<input className="f-input" value={form.picName} onChange={(e) => setForm({ ...form, picName: e.target.value })} /></label>
                <label>Email<input className="f-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label>Telepon<input className="f-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label>NPWP<input className="f-input" value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} /></label>
                <label className="full">Alamat<textarea className="f-textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
              </div>
              <button className="f-btn primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return <div className="f-stat"><div className="f-stat-icon">{icon}</div><div className="f-stat-body"><span>{label}</span><strong>{value}</strong><small>Data workspace aktif</small></div></div>
}
