'use client'

import { useState } from 'react'
import { Badge, Card, money } from '@/components/finora-ui'
import ExpenseDetailPanel from '@/components/expense-detail-panel'

type Row = { id: string; category: string; amount: number; expenseDate: string; status: string; vendor?: { id: string; name: string } | null; payeeName?: string | null }

function dateId(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProjectExpenseSection({ rows }: { rows: Row[] }) {
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null)
  const approvedTotal = rows.filter((row) => row.status === 'APPROVED').reduce((sum, row) => sum + Number(row.amount), 0)
  const pendingTotal = rows.filter((row) => row.status === 'PENDING').reduce((sum, row) => sum + Number(row.amount), 0)

  return <>
    <Card id="expenses-project-card" className="f-section-gap project-expense-card">
      <div className="f-card-head project-expense-head">
        <div>
          <div className="f-eyebrow">PROJECT COST CONTROL</div>
          <h3>Expenses Project</h3>
          <p>Pengeluaran yang terhubung langsung ke project ini. Detail dapat dibuka untuk melihat bukti, vendor/pihak, approval, dan cashflow.</p>
        </div>
        <div className="project-expense-head-side"><span className="f-badge neutral">{rows.length} transaksi</span><span className="f-badge green">Approved {money(approvedTotal)}</span>{pendingTotal > 0 && <span className="f-badge amber">Pending {money(pendingTotal)}</span>}</div>
      </div>
      {rows.length ? <div style={{ overflowX: 'auto' }}><table className="f-table f-project-expense-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Pihak</th><th>Status</th><th>Nominal</th><th>Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{dateId(row.expenseDate)}</td><td><strong>{row.category}</strong></td><td><strong>{row.vendor?.name || row.payeeName || '—'}</strong><div className="f-muted">{row.vendor ? 'Vendor master' : 'Pihak / penerima'}</div></td><td><Badge tone={row.status === 'APPROVED' ? 'green' : 'amber'}>{row.status}</Badge></td><td className="f-number">{money(row.amount)}</td><td><button className="f-btn soft" type="button" onClick={() => setDetailExpenseId(row.id)}>Lihat detail</button></td></tr>)}</tbody></table></div> : <div className="project-expense-empty"><div className="project-expense-empty-icon">Rp</div><strong>Belum ada expense</strong><p>Belum ada pengeluaran yang tercatat untuk project ini.</p><a className="f-btn soft" href="/expenses">Buka Expense Manager</a></div>}
    </Card>
    {detailExpenseId && <ExpenseDetailPanel expenseId={detailExpenseId} onClose={() => setDetailExpenseId(null)} />}
  </>
}
