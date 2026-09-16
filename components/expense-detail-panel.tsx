'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge, money } from '@/components/finora-ui'

export type ExpenseDetail = {
  id: string
  category: string
  amount: number
  expenseDate: string
  status: string
  description?: string | null
  paymentMethod?: string | null
  payeeName?: string | null
  vendor?: { id: string; name: string } | null
  project?: { id: string; projectCode: string; projectName: string; status: string } | null
  items: Array<{ id: string; description: string; quantity: number; unit: string; unitPrice: number; totalAmount: number }>
  attachments: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }>
  cashflow?: Array<{ id: string; type: string; category: string; amount: number; transactionDate: string; sourceRef?: string | null }> | null
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function dateId(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ExpenseDetailPanel({ expenseId, onClose, canManage = false, onEdit }: { expenseId: string; onClose: () => void; canManage?: boolean; onEdit?: (expenseId: string) => void }) {
  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setExpense(null)
    setError('')
    fetch(`/api/expenses/${expenseId}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Gagal memuat detail expense.')
        if (active) setExpense(data.expense || null)
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Gagal memuat detail expense.'))
    return () => { active = false }
  }, [expenseId])

  return (
    <div className="f-modal-backdrop expense-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="expense-detail-panel" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title">
        <div className="expense-detail-header">
          <div>
            <div className="f-eyebrow">EXPENSE DETAIL</div>
            <h3 id="expense-detail-title">Detail pengeluaran</h3>
            <p>Rincian biaya, item, bukti, project, dan dampaknya ke cashflow.</p>
          </div>
          <button className="f-icon f-modal-close" type="button" onClick={onClose} aria-label="Tutup">×</button>
        </div>

        <div className="expense-detail-body">
          {error && <div className="f-inline-alert warning">{error}</div>}
          {!expense && !error && <div className="f-empty"><strong>Memuat detail…</strong>Mohon tunggu sebentar.</div>}

          {expense && <>
            <div className="expense-detail-summary">
              <div><span>Status</span><Badge tone={expense.status === 'APPROVED' ? 'green' : 'amber'}>{expense.status}</Badge></div>
              <div><span>Total transaksi</span><strong>{money(expense.amount)}</strong></div>
              <div><span>Tanggal</span><strong>{dateId(expense.expenseDate)}</strong></div>
            </div>

            <section className="expense-detail-section">
              <div className="expense-detail-section-heading"><div><h4>Konteks transaksi</h4><p>Hubungan expense dengan project dan pihak terkait.</p></div></div>
              <div className="expense-detail-grid">
                <div><span>Project</span><strong>{expense.project ? `${expense.project.projectCode} · ${expense.project.projectName}` : 'Belum dipetakan'}</strong></div>
                <div><span>Kategori</span><strong>{expense.category}</strong></div>
                <div><span>Vendor</span><strong>{expense.vendor ? expense.vendor.name : '—'}</strong></div>
                <div><span>Pihak / penerima</span><strong>{expense.payeeName || '—'}</strong></div>
                <div><span>Metode pembayaran</span><strong>{expense.paymentMethod || '—'}</strong></div>
                <div><span>Deskripsi</span><strong>{expense.description || '—'}</strong></div>
              </div>
              <div className="expense-detail-links">
                {expense.project && <Link className="f-btn soft" href={`/projects/${expense.project.id}`}>Lihat Project</Link>}
                {expense.vendor && <Link className="f-btn soft" href={`/clients/${expense.vendor.id}`}>Lihat Vendor</Link>}
                <Link className="f-btn soft" href={`/cashflow?expenseId=${expense.id}`}>Lihat Cashflow</Link>
                {canManage && expense.status === 'PENDING' && onEdit && <button className="f-btn primary" type="button" onClick={() => onEdit(expense.id)}>Edit Expense</button>}
              </div>
            </section>

            <section className="expense-detail-section">
              <div className="expense-detail-section-heading"><div><h4>Detail item</h4><p>Nilai transaksi berasal dari item-item berikut.</p></div><strong>{expense.items.length} item</strong></div>
              <div className="expense-detail-items">
                {expense.items.map((item, index) => <div className="expense-detail-item" key={item.id}><div className="expense-detail-item-index">{index + 1}</div><div className="expense-detail-item-main"><strong>{item.description}</strong><span>{item.quantity} {item.unit} × {money(item.unitPrice)}</span></div><strong>{money(item.totalAmount)}</strong></div>)}
                <div className="expense-detail-total"><span>Total</span><strong>{money(expense.amount)}</strong></div>
              </div>
            </section>

            <section className="expense-detail-section">
              <div className="expense-detail-section-heading"><div><h4>Bukti transaksi</h4><p>Dokumen dan foto yang disimpan bersama expense.</p></div><strong>{expense.attachments.length} file</strong></div>
              {expense.attachments.length ? <div className="expense-detail-files">{expense.attachments.map((file) => <a key={file.id} className="expense-detail-file" href={`/api/expenses/${expense.id}/attachments/${file.id}`} target="_blank" rel="noreferrer"><span>{file.fileName}</span><small>{bytes(file.sizeBytes)}</small></a>)}</div> : <div className="f-empty"><strong>Belum ada bukti</strong>Upload receipt, invoice, atau foto bukti dari form expense.</div>}
            </section>

            <section className="expense-detail-section">
              <div className="expense-detail-section-heading"><div><h4>Link ke cashflow</h4><p>Expense adalah kejadian biaya; cashflow adalah pergerakan uang.</p></div></div>
              {expense.cashflow?.length ? <div className="expense-detail-cashflow-list">{expense.cashflow.map((row) => <div className="expense-detail-cashflow" key={row.id}><span>{dateId(row.transactionDate)} · {row.category}</span><strong>{row.type === 'EXPENSE' ? '-' : '+'}{money(row.amount)}</strong></div>)}</div> : <div className="f-inline-alert info">Belum ada transaksi cashflow yang terhubung. Ini normal bila expense belum approved atau pembayarannya belum dicatat.</div>}
            </section>
          </>}
        </div>
      </aside>
    </div>
  )
}
