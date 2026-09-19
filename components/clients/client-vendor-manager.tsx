'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—'
}

function excerpt(value: string | null, max = 62) {
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function contactLine(x: Client) {
  return x.email || x.phone || 'Kontak belum diisi'
}

export default function ClientVendorManager({ initialClients, workspace, role }: Props) {
  const [rows, setRows] = useState(initialClients)
  const [q, setQ] = useState('')
  const [type, setType] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const [archived, setArchived] = useState(false)
  const [form, setForm] = useState<any>({ ...empty })
  const [initialForm, setInitialForm] = useState<any>({ ...empty })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const availableCategories = useMemo(() => {
    const source = type === 'VENDOR'
      ? VENDOR_CATEGORIES
      : type === 'CLIENT'
        ? CLIENT_CATEGORIES
        : [...CLIENT_CATEGORIES, ...VENDOR_CATEGORIES]

    return Array.from(new Set(source))
  }, [type])

  const formCategoryOptions = useMemo(() => {
    const options = [...categoryOptions(form.type)]
    if (form.category && !options.includes(form.category)) options.unshift(form.category)
    return options
  }, [form.type, form.category])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()

    return rows.filter((x) => {
      const haystack = `${x.name} ${x.category || ''} ${x.offerings || ''} ${x.email || ''} ${x.picName || ''} ${x.phone || ''}`.toLowerCase()

      return (
        (type === 'ALL' || x.type === type) &&
        (category === 'ALL' || x.category === category) &&
        (archived || x.isActive) &&
        (!needle || haystack.includes(needle))
      )
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

  function openNew() {
    setForm({ ...empty })
    setInitialForm({ ...empty })
    setOpen(true)
    setNotice('')
  }

  function edit(x: Client) {
    setForm({ ...x })
    setInitialForm({ ...x })
    setOpen(true)
    setNotice('')
  }

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || open) return
    const target = rows.find((row) => row.id === editId)
    if (!target) return
    edit(target)
    router.replace(pathname, { scroll: false })
  }, [searchParams, rows, open, router, pathname])

  function selectTab(nextType: string, showArchived = false) {
    setType(nextType)
    setArchived(showArchived)
    setCategory('ALL')
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
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

      setRows((current) =>
        editing
          ? current.map((x) => x.id === data.client.id ? data.client : x)
          : [...current, data.client].sort((a, b) => a.name.localeCompare(b.name)),
      )
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
      setRows((current) =>
        data.action === 'deleted'
          ? current.filter((z: Client) => z.id !== x.id)
          : current.map((z: Client) => z.id === x.id ? data.client : z),
      )
      setNotice(data.action === 'deleted' ? 'Kontak dihapus.' : 'Kontak diarsipkan.')
    } else {
      setNotice(data.error || 'Gagal.')
    }
  }

  async function restore(x: Client) {
    if (!canManage(role)) return
    setSaving(true)
    setNotice('')
    try {
      const response = await fetch(`/api/clients/${x.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...x, isActive: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal mengaktifkan kontak.')
      setRows((current) => current.map((row) => row.id === x.id ? data.client : row))
      setNotice('Kontak diaktifkan kembali.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal mengaktifkan kontak.')
    } finally {
      setSaving(false)
    }
  }

  function closeDrawer() {
    setOpen(false)
    setNotice('')
  }

  return (
    <div className="f-content f-client-page">
      <div className="f-client-hero">
        <div className="f-client-hero-copy">
          <div className="f-eyebrow">Master Data</div>
          <h1>Klien & Vendor</h1>
          <p>
            Satu direktori untuk relasi bisnis yang dipakai lintas proposal, PO, project,
            invoice, biaya, dan histori pembayaran.
          </p>
        </div>
        <button
          className="f-btn primary"
          onClick={() => {
            if (!canManage(role)) {
              setNotice('Role Viewer tidak memiliki izin menambah atau mengubah Klien/Vendor. Masuk sebagai Owner, Finance, atau Sales.')
              return
            }
            openNew()
          }}
        >
          ＋ Tambah Kontak
        </button>
      </div>

      <div className="f-client-stats">
        <div className="f-client-stat">
          <div className="f-client-stat-icon">K</div>
          <div className="f-client-stat-copy">
            <span>Klien aktif</span>
            <strong>{stats.clients}</strong>
            <small>Relasi customer dalam workspace</small>
          </div>
        </div>
        <div className="f-client-stat">
          <div className="f-client-stat-icon">V</div>
          <div className="f-client-stat-copy">
            <span>Vendor aktif</span>
            <strong>{stats.vendors}</strong>
            <small>Supplier / penyedia jasa aktif</small>
          </div>
        </div>
        <div className="f-client-stat">
          <div className="f-client-stat-icon">A</div>
          <div className="f-client-stat-copy">
            <span>Diarsipkan</span>
            <strong>{stats.inactive}</strong>
            <small>Masih tersimpan untuk histori</small>
          </div>
        </div>
      </div>

      <section className="f-client-card">
        <div className="f-client-toolbar">
          <div className="f-client-tabs" role="tablist" aria-label="Filter tipe kontak">
            <button className={type === 'ALL' && !archived ? 'f-client-tab active' : 'f-client-tab'} type="button" onClick={() => selectTab('ALL')}>Semua <span>({rows.length - stats.inactive})</span></button>
            <button className={type === 'CLIENT' && !archived ? 'f-client-tab active' : 'f-client-tab'} type="button" onClick={() => selectTab('CLIENT')}>Klien <span>({stats.clients})</span></button>
            <button className={type === 'VENDOR' && !archived ? 'f-client-tab active' : 'f-client-tab'} type="button" onClick={() => selectTab('VENDOR')}>Vendor <span>({stats.vendors})</span></button>
            <button className={archived ? 'f-client-tab active' : 'f-client-tab'} type="button" onClick={() => selectTab('ALL', true)}>Diarsipkan <span>({stats.inactive})</span></button>
          </div>

          <div className="f-client-filter-row">
            <div className="f-client-search">
              <span className="f-client-search-icon" aria-hidden="true">⌕</span>
              <input
                placeholder="Cari perusahaan, PIC, produk / jasa..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Cari klien atau vendor"
              />
            </div>
            <select
              className="f-client-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                setArchived(false)
                setCategory('ALL')
              }}
              aria-label="Filter tipe"
            >
              <option value="ALL">Semua tipe</option>
              <option value="CLIENT">Klien</option>
              <option value="VENDOR">Vendor</option>
            </select>
            <select
              className="f-client-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter kategori"
            >
              <option value="ALL">Semua kategori</option>
              {availableCategories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <label className="f-client-archive-toggle">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Tampilkan arsip
            </label>
          </div>
        </div>

        {notice && <div className="f-client-notice">{notice}</div>}

        <div className="f-client-table-wrap">
          <table className="f-client-table">
            <thead>
              <tr>
                <th>Perusahaan / PIC</th>
                <th>Tipe</th>
                <th>Kategori</th>
                <th>Produk / Jasa</th>
                <th>Kontak</th>
                <th>Status</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id}>
                  <td>
                    <div className="f-client-identity">
                      <div className="f-client-avatar">{initials(x.name)}</div>
                      <div>
                        <Link href={`/clients/${x.id}`} className="f-client-name-link"><strong>{x.name}</strong></Link>
                        <small>{x.picName || 'PIC belum diisi'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`f-client-type ${x.type === 'CLIENT' ? 'client' : 'vendor'}`}>
                      {x.type === 'CLIENT' ? 'Klien' : 'Vendor'}
                    </span>
                  </td>
                  <td>
                    <span className={x.category ? 'f-client-category' : 'f-client-category muted'}>
                      {x.category || 'Belum dikategorikan'}
                    </span>
                  </td>
                  <td>
                    <div className="f-client-offering">{excerpt(x.offerings)}</div>
                  </td>
                  <td>
                    <div className="f-client-contact">
                      <strong>{x.email || 'Kontak belum diisi'}</strong>
                      <small>{x.phone || (x.email ? 'Telepon belum diisi' : 'Tambahkan email / telepon')}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`f-client-status ${x.isActive ? 'active' : 'inactive'}`}>
                      <span aria-hidden="true">●</span>
                      {x.isActive ? 'Aktif' : 'Diarsipkan'}
                    </span>
                  </td>
                  <td>
                    <div className="f-client-actions">
                      <Link href={`/clients/${x.id}`} className="f-client-detail">Detail</Link>
                      {(canManage(role) || canDelete(role)) && (
                        <details className="f-client-more">
                          <summary aria-label={`Aksi ${x.name}`}>⋯</summary>
                          <div className="f-client-more-menu">
                            {canManage(role) && (
                              <button type="button" onClick={() => edit(x)}>Edit</button>
                            )}
                            {canDelete(role) && x.isActive && (
                              <button type="button" onClick={() => archive(x)}>Arsipkan</button>
                            )}
                            {!x.isActive && canManage(role) && (
                              <button type="button" onClick={() => restore(x)}>Aktifkan kembali</button>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="f-client-empty">
            <strong>Tidak ada kontak yang cocok</strong>
            Coba cari dengan nama perusahaan, kategori, produk / jasa, atau nama PIC.
          </div>
        )}
      </section>

      {open && (
        <div className="f-client-drawer" role="dialog" aria-modal="true" aria-labelledby="client-drawer-title">
          <div className="f-client-drawer-panel">
            <div className="f-client-drawer-head">
              <div>
                <h3 id="client-drawer-title">{form.id ? 'Edit Kontak' : 'Tambah Kontak'}</h3>
                <p>
                  Data ini menjadi master untuk proposal, invoice, expense, PO, dan histori transaksi.
                  {workspace.name ? ` Workspace: ${workspace.name}.` : ''}
                </p>
              </div>
              <button type="button" className="f-client-drawer-close" onClick={closeDrawer} aria-label="Tutup">
                ×
              </button>
            </div>

            <form className="f-client-form" onSubmit={save}>
              <div className="f-client-form-grid">
                <label className="f-client-field">
                  Tipe
                  <select value={form.type} onChange={(e) => applyType(e.target.value)}>
                    <option value="CLIENT">Klien</option>
                    <option value="VENDOR">Vendor</option>
                  </select>
                </label>

                <label className="f-client-field">
                  Kategori *
                  <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Pilih kategori</option>
                    {formCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="f-client-field full">
                  Nama perusahaan *
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.type === 'VENDOR' ? 'PT / CV / toko / penyedia jasa' : 'PT / CV / instansi klien'} />
                </label>

                <label className="f-client-field full">
                  {offeringLabel(form.type)} *
                  <textarea required value={form.offerings} onChange={(e) => setForm({ ...form, offerings: e.target.value })} placeholder={offeringPlaceholder(form.type)} />
                  <small>Pisahkan beberapa item dengan koma agar mudah ditemukan saat pencarian.</small>
                </label>

                <label className="f-client-field">
                  PIC
                  <input value={form.picName} onChange={(e) => setForm({ ...form, picName: e.target.value })} placeholder="Nama PIC" />
                </label>

                <label className="f-client-field">
                  Email
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="finance@perusahaan.id" />
                </label>

                <label className="f-client-field">
                  Telepon
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+62 ..." />
                </label>

                <label className="f-client-field">
                  NPWP
                  <input value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} />
                </label>

                {form.id && (
                  <label className="f-client-field">
                    Status
                    <select value={form.isActive ? 'ACTIVE' : 'ARCHIVED'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'ACTIVE' })}>
                      <option value="ACTIVE">Aktif</option>
                      <option value="ARCHIVED">Diarsipkan</option>
                    </select>
                  </label>
                )}

                <label className="f-client-field full">
                  Alamat
                  <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </label>
              </div>

              <div className="f-client-form-actions">
                <button type="button" className="f-btn" onClick={() => setForm({ ...initialForm })}>
                  Reset
                </button>
                <button className="f-btn primary" disabled={saving || !canManage(role)}>
                  {!canManage(role) ? 'Tidak punya akses' : saving ? 'Menyimpan...' : 'Simpan Kontak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
