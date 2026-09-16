'use client'
import { useEffect, useState } from 'react'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'

type Item = {
  id: string
  invoiceNumber: string
  client: { name: string }
  dueDate: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  status: string
  overdueDays: number
  agingBucket: 'CURRENT' | '1_30' | '31_60' | '61_90' | '90_PLUS'
}

const bucketLabel = (bucket: Item['agingBucket']) => ({ CURRENT: 'Belum jatuh tempo', '1_30': '1–30 hari', '31_60': '31–60 hari', '61_90': '61–90 hari', '90_PLUS': '>90 hari' }[bucket])

async function readBody(r: Response) {
  try { const text = await r.text(); return text ? JSON.parse(text) : {} } catch { return { error: `Server mengembalikan respons tidak valid (${r.status}).` } }
}

export default function ReceivablesManager() {
  const [rows, setRows] = useState<Item[]>([])
  const [summary, setSummary] = useState({ totalOutstanding: 0, current: 0, overdue: 0, bucket1_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90_plus: 0 })
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    const r = await fetch('/api/receivables', { cache: 'no-store' })
    const d = await readBody(r)
    if (r.ok) { setRows(d.receivables || []); setSummary(d.summary || summary); setMsg('') }
    else setMsg(d.error || 'Gagal memuat piutang.')
  }
  useEffect(() => { load() }, [])

  async function remind(id: string) {
    if (!confirm('Catat pengingat untuk invoice overdue ini?')) return
    const r = await fetch(`/api/invoices/${id}/remind`, { method: 'POST' })
    const d = await readBody(r)
    setMsg(r.ok ? (d.message || 'Pengingat dicatat.') : (d.error || `Gagal mencatat pengingat (${r.status}).`))
  }

  const filtered = rows.filter((x) => `${x.invoiceNumber} ${x.client.name}`.toLowerCase().includes(q.toLowerCase()))

  return <div className="f-content">
    <PageHeader eyebrow="Kontrol Finance" title="Piutang" description="Pantau tagihan yang belum lunas, jatuh tempo, dan umur piutang." action={<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><a className="f-btn" href="/invoices">Lihat invoice</a><a className="f-btn primary" href="/api/receivables/export">Export Aging CSV</a></div>} />
    {msg && <div style={{ marginBottom: 12 }}><span className={msg.toLowerCase().includes('gagal') ? 'f-badge red' : 'f-badge green'}>{msg}</span></div>}
    <div className="f-grid-4">
      <StatCard label="Total piutang" value={money(summary.totalOutstanding)} icon="Rp" />
      <StatCard label="Belum jatuh tempo" value={money(summary.current)} icon="◷" />
      <StatCard label="Overdue" value={money(summary.overdue)} icon="!" />
      <StatCard label="Invoice outstanding" value={rows.length} icon="▧" />
    </div>
    <div style={{ height: 16 }} />
    <Card>
      <div className="f-card-head"><div><h3>Aging piutang</h3><p>Piutang dikelompokkan berdasarkan umur keterlambatan.</p></div></div>
      <div className="f-grid-4" style={{ padding: 16 }}>
        <div className="f-stat"><div className="f-stat-icon">1</div><div className="f-stat-body"><span>1–30 hari</span><strong>{money(summary.bucket1_30)}</strong></div></div>
        <div className="f-stat"><div className="f-stat-icon">2</div><div className="f-stat-body"><span>31–60 hari</span><strong>{money(summary.bucket31_60)}</strong></div></div>
        <div className="f-stat"><div className="f-stat-icon">3</div><div className="f-stat-body"><span>61–90 hari</span><strong>{money(summary.bucket61_90)}</strong></div></div>
        <div className="f-stat"><div className="f-stat-icon">4</div><div className="f-stat-body"><span>&gt;90 hari</span><strong>{money(summary.bucket90_plus)}</strong></div></div>
      </div>
    </Card>
    <div style={{ height: 16 }} />
    <Card>
      <div className="f-toolbar"><input className="f-input" placeholder="Cari invoice atau klien..." value={q} onChange={e => setQ(e.target.value)} /></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="f-table"><thead><tr><th>Invoice</th><th>Klien</th><th>Jatuh tempo</th><th>Umur</th><th>Total</th><th>Outstanding</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map(x => <tr key={x.id}>
            <td><strong>{x.invoiceNumber}</strong></td>
            <td>{x.client.name}</td>
            <td>{new Date(x.dueDate).toLocaleDateString('id-ID')}</td>
            <td>{x.overdueDays > 0 ? `${x.overdueDays} hari` : '—'}</td>
            <td className="f-number">{money(x.totalAmount)}</td>
            <td className="f-number"><strong>{money(x.outstandingAmount)}</strong></td>
            <td><Badge tone={x.status === 'OVERDUE' ? 'red' : x.status === 'PARTIAL' ? 'amber' : 'blue'}>{x.status}</Badge><div className="f-muted" style={{ marginTop: 4 }}>{bucketLabel(x.agingBucket)}</div></td>
            <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <a className="f-btn" href={`/documents/invoices/${x.id}`} target="_blank" rel="noreferrer">PDF / Cetak</a>
              {x.status === 'OVERDUE' && <button className="f-btn soft" onClick={() => remind(x.id)}>Catat pengingat</button>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtered.length && <div className="f-empty"><strong>Tidak ada piutang outstanding</strong>Semua invoice pada workspace ini sudah lunas.</div>}
    </Card>
    <div className="f-muted" style={{ marginTop: 10 }}>Pengingat di versi ini dicatat ke audit log. Pengiriman email/WhatsApp otomatis akan menjadi bagian integrasi notification berikutnya.</div>
  </div>
}
