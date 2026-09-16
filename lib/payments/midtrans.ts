import crypto from 'node:crypto'

export type MidtransStatus = 'PENDING' | 'SETTLEMENT' | 'CAPTURE' | 'FAILED' | 'EXPIRED' | 'CANCELLED'

export function midtransConfigured() {
  return Boolean(process.env.MIDTRANS_SERVER_KEY?.trim() && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY?.trim())
}

export function midtransCredentialDiagnostics() {
  const production = midtransIsProduction()
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim()
  const clientKey = (process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim()
  const expectedServerPrefix = production ? 'Mid-server-' : 'SB-Mid-server-'
  const expectedClientPrefix = production ? 'Mid-client-' : 'SB-Mid-client-'
  return {
    environment: production ? 'production' : 'sandbox',
    serverKeyConfigured: Boolean(serverKey),
    clientKeyConfigured: Boolean(clientKey),
    serverKeyPrefixOk: serverKey.startsWith(expectedServerPrefix),
    clientKeyPrefixOk: clientKey.startsWith(expectedClientPrefix),
    serverKeyLength: serverKey.length,
    clientKeyLength: clientKey.length,
    expectedServerPrefix,
    expectedClientPrefix,
  }
}

export function midtransIsProduction() {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
}

export function midtransSnapEndpoint() {
  return midtransIsProduction()
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
}

export function midtransStatusEndpoint(orderId: string) {
  const base = midtransIsProduction() ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2'
  return `${base}/${encodeURIComponent(orderId)}/status`
}

function basicAuth() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim()
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi.')
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
}

export function verifyMidtransSignature(input: {
  orderId: string
  statusCode: string
  grossAmount: string
  signatureKey: string
}) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim()
  if (!serverKey) return false
  const expected = crypto.createHash('sha512').update(`${input.orderId}${input.statusCode}${input.grossAmount}${serverKey}`).digest('hex')
  const received = input.signatureKey || ''
  if (expected.length !== received.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

export async function createMidtransSnapTransaction(input: {
  orderId: string
  grossAmount: number
  invoiceNumber: string
  finishUrl?: string
  customer?: { firstName?: string; email?: string; phone?: string | null }
  items?: Array<{ id: string; price: number; quantity: number; name: string }>
}) {
  const body = {
    transaction_details: { order_id: input.orderId, gross_amount: Math.round(input.grossAmount) },
    item_details: input.items?.map((item) => ({ id: item.id, price: Math.round(item.price), quantity: item.quantity, name: item.name.slice(0, 50) })),
    customer_details: {
      first_name: input.customer?.firstName || 'Customer',
      email: input.customer?.email,
      phone: input.customer?.phone || undefined,
    },
    callbacks: {
      finish: input.finishUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoices`,
    },
    custom_field1: input.invoiceNumber,
  }
  const response = await fetch(midtransSnapEndpoint(), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: basicAuth() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.token) throw new Error(data.error_messages?.join(' ') || data.status_message || `Midtrans gagal membuat transaksi (${response.status}).`)
  return data as { token: string; redirect_url?: string }
}

export async function getMidtransStatus(orderId: string) {
  const response = await fetch(midtransStatusEndpoint(orderId), {
    headers: { Accept: 'application/json', Authorization: basicAuth() },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.status_message || `Midtrans status check gagal (${response.status}).`)
  return data as any
}
