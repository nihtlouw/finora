'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value))
}

type MidtransInvoice = {
  id: string
  invoiceNumber: string
  totalAmount?: number | string | null
  paidAmount?: number | string | null
  outstandingAmount?: number | string | null
  status?: string | null
}

type StatusResponse = {
  status?: string
  transactionStatus?: string
  paymentType?: string | null
  orderId?: string
  amount?: number
  paidAmount?: number
  outstandingAmount?: number
  invoiceStatus?: string
  applied?: boolean
  error?: string
}

type Props = {
  invoice: MidtransInvoice
  onUpdated: () => Promise<void> | void
  onMessage?: (message: string, tone?: 'success' | 'error' | 'info') => void
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  SETTLEMENT: 'Pembayaran berhasil',
  FAILED: 'Pembayaran gagal',
  EXPIRED: 'Checkout kedaluwarsa',
  CANCELLED: 'Pembayaran dibatalkan',
  REVIEW: 'Perlu pemeriksaan',
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  qris: 'QRIS',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  credit_card: 'Kartu',
  cstore: 'Convenience Store',
}

export default function MidtransPaymentButton({ invoice, onUpdated, onMessage }: Props) {
  const outstanding = useMemo(() => {
    const explicitOutstanding = Number(invoice.outstandingAmount ?? NaN)
    if (Number.isFinite(explicitOutstanding)) return Math.max(0, explicitOutstanding)
    return Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0))
  }, [invoice.outstandingAmount, invoice.totalAmount, invoice.paidAmount])

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(Math.round(outstanding)))
  const [busy, setBusy] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [gatewayStatus, setGatewayStatus] = useState('')
  const [gatewayPaymentType, setGatewayPaymentType] = useState<string | null>(null)
  const [gatewayAmount, setGatewayAmount] = useState(0)
  const [paidAfterCheck, setPaidAfterCheck] = useState<number | null>(null)
  const [outstandingAfterCheck, setOutstandingAfterCheck] = useState<number | null>(null)
  const pollCountRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRequestRef = useRef(false)

  useEffect(() => {
    setAmount(String(Math.round(outstanding)))
  }, [outstanding])

  const checkStatus = useCallback(async (silent = false) => {
    if (!orderId || statusRequestRef.current) return null
    statusRequestRef.current = true
    if (!silent) setBusy(true)

    try {
      const response = await fetch(
        `/api/payments/gateway/midtrans/status?orderId=${encodeURIComponent(orderId)}`,
        { cache: 'no-store' },
      )
      const text = await response.text()
      const data: StatusResponse = text ? JSON.parse(text) : {}

      if (!response.ok) throw new Error(data.error || `Gagal mengecek status (${response.status}).`)

      setGatewayStatus(String(data.status || ''))
      setGatewayPaymentType(data.paymentType || null)
      setGatewayAmount(Number(data.amount || 0))
      setPaidAfterCheck(Number(data.paidAmount || 0))
      setOutstandingAfterCheck(Number(data.outstandingAmount || 0))

      if (data.status === 'SETTLEMENT') {
        pollCountRef.current = 999
        onMessage?.(
          `Pembayaran ${formatRupiah(Number(data.amount || gatewayAmount))} sudah terkonfirmasi. Invoice diperbarui otomatis.`,
          'success',
        )
        await onUpdated()
        return data
      }

      if (!silent) {
        const paymentMethod = data.paymentType ? ` · ${PAYMENT_TYPE_LABEL[data.paymentType] || data.paymentType}` : ''
        onMessage?.(
          `Status pembayaran: ${STATUS_LABEL[data.status || ''] || String(data.status || 'BELUM TERSEDIA')}${paymentMethod}.`,
          'info',
        )
      }

      if (['FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW'].includes(String(data.status))) pollCountRef.current = 999
      return data
    } catch (error) {
      if (!silent) {
        onMessage?.(error instanceof Error ? error.message : 'Gagal mengecek status pembayaran.', 'error')
      }
      return null
    } finally {
      statusRequestRef.current = false
      if (!silent) setBusy(false)
    }
  }, [gatewayAmount, onMessage, onUpdated, orderId])

  useEffect(() => {
    if (!orderId) return
    pollCountRef.current = 0

    const poll = async () => {
      if (pollCountRef.current >= 24) return
      pollCountRef.current += 1
      const result = await checkStatus(true)
      if (result?.status === 'SETTLEMENT' || ['FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW'].includes(String(result?.status))) return
      pollTimerRef.current = setTimeout(poll, 5000)
    }

    poll()
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [orderId, checkStatus])

  useEffect(() => {
    if (!orderId) return
    const onFocus = () => void checkStatus(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [orderId, checkStatus])

  function openPayment() {
    if (outstanding <= 0) {
      onMessage?.('Invoice sudah lunas.', 'info')
      return
    }
    setAmount(String(Math.round(outstanding)))
    setOpen(true)
  }

  async function createCheckout() {
    const normalized = amount.replace(/[^0-9]/g, '')
    const paymentAmount = Math.round(Number(normalized))

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      onMessage?.('Masukkan nominal pembayaran yang valid.', 'error')
      return
    }
    if (paymentAmount > Math.round(outstanding)) {
      onMessage?.(`Nominal tidak boleh melebihi sisa tagihan ${formatRupiah(outstanding)}.`, 'error')
      return
    }

    setBusy(true)
    setGatewayStatus('')
    setGatewayPaymentType(null)
    setPaidAfterCheck(null)
    setOutstandingAfterCheck(null)

    try {
      const response = await fetch('/api/payments/gateway/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, amount: paymentAmount }),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) throw new Error(data.error || `Gagal membuat pembayaran online (${response.status}).`)

      if (data.status === 'SETTLEMENT' && data.alreadySettled) {
        setOpen(false)
        setOrderId(data.orderId || null)
        setCheckoutUrl(null)
        setGatewayAmount(Number(data.amount || paymentAmount))
        setGatewayStatus('SETTLEMENT')
        setGatewayPaymentType(data.paymentType || null)
        onMessage?.('Transaksi online sebelumnya sudah berhasil dikonfirmasi. Finora memperbarui invoice secara otomatis.', 'success')
        await onUpdated()
        return
      }

      if (!data.redirectUrl) throw new Error('Midtrans tidak mengembalikan URL pembayaran.')

      setOpen(false)
      setOrderId(data.orderId || null)
      setCheckoutUrl(data.redirectUrl || null)
      setGatewayAmount(Number(data.amount || paymentAmount))

      onMessage?.(
        `Checkout ${formatRupiah(Number(data.amount || paymentAmount))} sedang dibuka di Midtrans.`,
        'info',
      )

      // Navigate in the same tab. This avoids popup blockers and is reliable
      // after the asynchronous API call has completed. When the customer
      // finishes or returns from Midtrans, the invoice page can check the
      // gateway status again.
      window.location.assign(data.redirectUrl)
    } catch (error) {
      onMessage?.(error instanceof Error ? error.message : 'Gagal membuka pembayaran online.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = STATUS_LABEL[gatewayStatus] || gatewayStatus
  const livePaid = paidAfterCheck ?? Number(invoice.paidAmount || 0)
  const liveOutstanding = outstandingAfterCheck ?? outstanding
  const normalizedAmount = Math.round(Number(amount.replace(/[^0-9]/g, '') || 0))
  const isFullPayment = normalizedAmount >= Math.round(outstanding)
  const isPartialPayment = normalizedAmount > 0 && normalizedAmount < Math.round(outstanding)

  const setQuickAmount = (ratio: number) => {
    const next = Math.round(outstanding * ratio)
    setAmount(String(Math.max(1, next)))
  }

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  return (
    <>
      <div className="f-invoice-action-group">
        <button
          type="button"
          className="f-btn f-btn-compact primary"
          disabled={busy || outstanding <= 0}
          onClick={openPayment}
          title="Bayar sebagian atau seluruh sisa tagihan menggunakan Midtrans"
        >
          Bayar online
        </button>
      </div>

      {orderId && (
        <div className="f-card" style={{ marginTop: 8, padding: 12, minWidth: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <strong>Pembayaran online</strong>
              <div className="f-muted" style={{ marginTop: 3 }}>
                {gatewayAmount ? formatRupiah(gatewayAmount) : 'Nominal pembayaran'}
                {gatewayPaymentType ? ` · ${PAYMENT_TYPE_LABEL[gatewayPaymentType] || gatewayPaymentType}` : ''}
              </div>
            </div>
            <span className={`f-badge ${gatewayStatus === 'SETTLEMENT' ? 'green' : gatewayStatus === 'FAILED' || gatewayStatus === 'EXPIRED' || gatewayStatus === 'CANCELLED' ? 'red' : 'amber'}`}>
              {statusLabel || 'Mengecek...'}
            </span>
          </div>

          <div className="f-summary-lines" style={{ marginTop: 10 }}>
            <div><span>Total dibayar</span><strong>{formatRupiah(livePaid)}</strong></div>
            <div><span>Sisa tagihan</span><strong>{formatRupiah(liveOutstanding)}</strong></div>
          </div>

          {gatewayStatus && gatewayStatus !== 'SETTLEMENT' && (
            <p className="f-muted" style={{ margin: '10px 0 0' }}>
              Finora memverifikasi status ke Midtrans secara otomatis. Tidak perlu memasukkan pembayaran secara manual untuk transaksi online ini.
            </p>
          )}

          <div className="f-invoice-action-group" style={{ marginTop: 10 }}>
            {checkoutUrl && gatewayStatus !== 'SETTLEMENT' && (
              <button type="button" className="f-btn soft f-btn-compact" disabled={busy} onClick={() => window.open(checkoutUrl, '_blank', 'noopener,noreferrer')}>
                Buka checkout
              </button>
            )}
            <button type="button" className="f-btn soft f-btn-compact" disabled={busy} onClick={() => void checkStatus(false)}>
              Cek status sekarang
            </button>
          </div>
        </div>
      )}

      {open && typeof document !== 'undefined'
        ? createPortal(
            (<>        <div
          className="f-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false)
          }}
        >
          <div className="f-card f-modal-card" role="dialog" aria-modal="true" aria-labelledby={`midtrans-title-${invoice.id}`}>
            <div className="f-modal-header">
              <div>
                <h3 id={`midtrans-title-${invoice.id}`}>Bayar online</h3>
                <p>{invoice.invoiceNumber} · aman melalui Midtrans.</p>
              </div>
              <button type="button" className="f-btn" disabled={busy} onClick={() => setOpen(false)}>Tutup</button>
            </div>

            <div className="f-modal-body">
              <div className="f-summary-card">
                <div className="f-summary-head">
                  <div>
                    <strong>Sisa tagihan</strong>
                    <span>Pilih bayar sebagian atau lunasi sekaligus.</span>
                  </div>
                  <div className="f-summary-total">{formatRupiah(outstanding)}</div>
                </div>
                <div className="f-summary-lines">
                  <div><span>Total invoice</span><strong>{formatRupiah(Number(invoice.totalAmount || 0))}</strong></div>
                  <div><span>Sudah dibayar</span><strong>{formatRupiah(Number(invoice.paidAmount || 0))}</strong></div>
                  <div className="total"><span>Sisa</span><strong>{formatRupiah(outstanding)}</strong></div>
                </div>
              </div>

              <div className="f-form" style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: 800 }}>Jumlah pembayaran</label>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 9px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      color: isPartialPayment ? '#8a5a08' : '#0c6b5c',
                      background: isPartialPayment ? '#fff3d9' : '#e8f7f1',
                      border: `1px solid ${isPartialPayment ? '#f0d9a0' : '#cbeade'}`,
                    }}
                  >
                    {isPartialPayment ? 'Pembayaran sebagian' : 'Bayar penuh'}
                  </span>
                </div>

                <div style={{ marginTop: 7, color: '#5d706c', fontSize: 11 }}>
                  Anda <strong style={{ color: '#173a37' }}>tidak harus membayar seluruh tagihan sekaligus</strong>. Masukkan nominal yang ingin dibayar.
                </div>

                <input
                  className="f-input"
                  type="text"
                  inputMode="numeric"
                  min="1"
                  value={Number(amount || 0).toLocaleString('id-ID')}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ''))}
                  disabled={busy}
                  autoFocus
                  aria-label="Jumlah pembayaran online"
                  aria-describedby={`midtrans-help-${invoice.id}`}
                  style={{ marginTop: 8, fontSize: 18, fontWeight: 800, height: 52 }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                  {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const value = Math.round(outstanding * ratio)
                    const active = Math.abs(normalizedAmount - value) < 1
                    const label = ratio === 1 ? '100% · Penuh' : `${Math.round(ratio * 100)}%`
                    return (
                      <button
                        key={ratio}
                        type="button"
                        className="f-btn soft"
                        disabled={busy}
                        onClick={() => setQuickAmount(ratio)}
                        style={{
                          padding: '7px 10px',
                          background: active ? '#e3f4ee' : undefined,
                          borderColor: active ? '#8ec8b8' : undefined,
                          color: active ? '#0b6658' : undefined,
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div id={`midtrans-help-${invoice.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 9 }}>
                  <span className="f-muted">Maksimum {formatRupiah(outstanding)} · diverifikasi otomatis oleh Midtrans.</span>
                  <button type="button" className="f-btn soft" disabled={busy || isFullPayment} onClick={() => setAmount(String(Math.round(outstanding)))}>
                    Bayar penuh
                  </button>
                </div>

                {isPartialPayment && (
                  <div className="f-inline-alert info" style={{ marginTop: 10 }}>
                    Setelah pembayaran Rp {normalizedAmount.toLocaleString('id-ID')}, perkiraan sisa tagihan menjadi <strong>{formatRupiah(Math.max(0, outstanding - normalizedAmount))}</strong>. Anda dapat membayar sisa tersebut nanti melalui pembayaran online berikutnya atau metode manual.
                  </div>
                )}

                <div className="f-inline-alert info" style={{ marginTop: isPartialPayment ? 7 : 10 }}>
                  Setelah transaksi berhasil, Finora otomatis mencatat payment dan cashflow serta memperbarui invoice menjadi <strong>PARTIAL</strong> atau <strong>PAID</strong>.
                </div>

                <div className="f-modal-actions">
                  <button type="button" className="f-btn" disabled={busy} onClick={() => setOpen(false)}>Batal</button>
                  <button type="button" className="f-btn primary" disabled={busy || normalizedAmount <= 0 || normalizedAmount > Math.round(outstanding)} onClick={createCheckout}>
                    {busy ? 'Memproses...' : isPartialPayment ? `Bayar sebagian · ${formatRupiah(normalizedAmount)}` : `Bayar penuh · ${formatRupiah(normalizedAmount)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
            </>),
            document.body,
          )
        : null}
    </>
  )
}
