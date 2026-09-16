import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { midtransConfigured, createMidtransSnapTransaction, getMidtransStatus } from '@/lib/payments/midtrans'
import { centsToDecimal, parseMoneyCents } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })
  if (!midtransConfigured()) return NextResponse.json({ error: 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY.' }, { status: 503 })

  try {
    const body = await req.json()
    const invoice = await prisma.invoice.findFirst({
      where: { id: String(body.invoiceId || ''), client: { workspaceId: c.workspace.id } },
      include: { client: true, items: true, payments: true },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })

    const paid = invoice.payments.reduce((sum, p) => sum + parseMoneyCents(p.amount.toString()), 0n)
    const total = parseMoneyCents(invoice.totalAmount.toString())
    const outstanding = total - paid
    if (outstanding <= 0n) return NextResponse.json({ error: 'Invoice sudah lunas.' }, { status: 409 })

    const requestedAmount = body.amount === undefined || body.amount === null || body.amount === ''
      ? outstanding
      : parseMoneyCents(String(body.amount))
    if (requestedAmount <= 0n) return NextResponse.json({ error: 'Nominal pembayaran online harus lebih besar dari 0.' }, { status: 400 })
    if (requestedAmount > outstanding) return NextResponse.json({ error: `Nominal pembayaran tidak boleh melebihi sisa tagihan ${centsToDecimal(outstanding)}.` }, { status: 400 })

    // Reuse an existing checkout only after confirming its live Midtrans status.
    // This prevents an expired/cancelled order from being reused indefinitely.
    const existing = await prisma.paymentGatewayTransaction.findFirst({
      where: { workspaceId: c.workspace.id, invoiceId: invoice.id, provider: 'MIDTRANS', status: 'PENDING', amount: centsToDecimal(requestedAmount) },
      orderBy: { createdAt: 'desc' },
    })
    if (existing?.redirectUrl || existing?.snapToken) {
      try {
        const remoteStatus = await getMidtransStatus(existing.orderId)
        const transactionStatus = String(remoteStatus.transaction_status || '')
        const fraudStatus = remoteStatus.fraud_status ? String(remoteStatus.fraud_status) : null
        const mapped = transactionStatus === 'pending' ? 'PENDING'
          : transactionStatus === 'expire' ? 'EXPIRED'
          : transactionStatus === 'cancel' ? 'CANCELLED'
          : transactionStatus === 'deny' || transactionStatus === 'failure' ? 'FAILED'
          : transactionStatus === 'settlement' ? 'SETTLEMENT'
          : transactionStatus === 'capture' && fraudStatus === 'accept' ? 'SETTLEMENT'
          : transactionStatus === 'capture' ? 'REVIEW'
          : 'REVIEW'

        if (mapped === 'PENDING') {
          return NextResponse.json({ orderId: existing.orderId, token: existing.snapToken, redirectUrl: existing.redirectUrl, clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY, amount: existing.amount, status: 'PENDING', paymentType: remoteStatus.payment_type || existing.paymentType || null })
        }

        await prisma.paymentGatewayTransaction.update({
          where: { id: existing.id },
          data: {
            status: mapped,
            transactionId: remoteStatus.transaction_id ? String(remoteStatus.transaction_id) : existing.transactionId,
            paymentType: remoteStatus.payment_type ? String(remoteStatus.payment_type) : existing.paymentType,
            rawResponse: remoteStatus as any,
          },
        })

        if (mapped === 'SETTLEMENT') {
          const { settleMidtransGatewayTransaction } = await import('@/lib/payments/midtrans-settlement')
          const settled = await settleMidtransGatewayTransaction({
            gatewayId: existing.id,
            workspaceId: c.workspace.id,
            payload: {
              transaction_status: transactionStatus,
              fraud_status: fraudStatus,
              transaction_id: remoteStatus.transaction_id ? String(remoteStatus.transaction_id) : null,
              payment_type: remoteStatus.payment_type ? String(remoteStatus.payment_type) : null,
              gross_amount: String(remoteStatus.gross_amount || ''),
              settlement_time: remoteStatus.settlement_time ? String(remoteStatus.settlement_time) : null,
              transaction_time: remoteStatus.transaction_time ? String(remoteStatus.transaction_time) : null,
            },
          })
          return NextResponse.json({
            orderId: existing.orderId,
            amount: existing.amount,
            paymentType: remoteStatus.payment_type || existing.paymentType || null,
            status: 'SETTLEMENT',
            alreadySettled: true,
            applied: settled.applied,
          })
        }

        if (mapped === 'REVIEW') {
          return NextResponse.json({ error: 'Transaksi sebelumnya masih berstatus perlu pemeriksaan di Midtrans. Gunakan Cek status dan selesaikan transaksi tersebut terlebih dahulu.', status: 'REVIEW', orderId: existing.orderId }, { status: 409 })
        }
        // EXPIRED / CANCELLED / FAILED: create a fresh checkout below.
      } catch {
        // If Midtrans status cannot be read, keep the safest behavior: do not reuse an unverified order.
        await prisma.paymentGatewayTransaction.update({ where: { id: existing.id }, data: { status: 'REVIEW' } })
        return NextResponse.json({ error: 'Status checkout sebelumnya tidak dapat diverifikasi ke Midtrans. Silakan cek status transaksi tersebut terlebih dahulu.', status: 'REVIEW', orderId: existing.orderId }, { status: 409 })
      }
    }

    const orderId = `FIN-${invoice.invoiceNumber}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 50)
    const grossAmount = Number(requestedAmount) / 100
    const snap = await createMidtransSnapTransaction({
      orderId,
      grossAmount,
      invoiceNumber: invoice.invoiceNumber,
      finishUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoices?gatewayOrderId=${encodeURIComponent(orderId)}&invoiceId=${encodeURIComponent(invoice.id)}`,
      customer: { firstName: invoice.client.picName || invoice.client.name, email: invoice.client.email || undefined, phone: invoice.client.phone },
      items: [{ id: `invoice-${invoice.id}`, price: grossAmount, quantity: 1, name: `Pembayaran invoice ${invoice.invoiceNumber}` }],
    })

    const gateway = await prisma.paymentGatewayTransaction.create({
      data: {
        workspaceId: c.workspace.id,
        invoiceId: invoice.id,
        createdByUserId: c.user.id,
        provider: 'MIDTRANS',
        orderId,
        amount: centsToDecimal(requestedAmount),
        status: 'PENDING',
        snapToken: snap.token,
        redirectUrl: snap.redirect_url || null,
        rawResponse: snap as any,
      },
    })

    await writeAuditLog({ workspaceId: c.workspace.id, actorUserId: c.user.id, action: 'CREATE', entityType: 'PAYMENT_GATEWAY_TRANSACTION', entityId: gateway.id, metadata: { provider: 'MIDTRANS', orderId, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: gateway.amount } })
    return NextResponse.json({ orderId, token: snap.token, redirectUrl: snap.redirect_url, clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY, amount: centsToDecimal(requestedAmount) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gagal membuat pembayaran online.'
    const credentialError = /unauthorized transaction|Access denied due to unauthorized transaction|check client or server key/i.test(message)
    return NextResponse.json({
      error: credentialError
        ? 'Midtrans menolak autentikasi. Pastikan MIDTRANS_SERVER_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY berasal dari merchant dan environment yang sama (Sandbox), lalu restart server.'
        : message,
      code: credentialError ? 'MIDTRANS_AUTH_ERROR' : 'MIDTRANS_REQUEST_ERROR',
    }, { status: credentialError ? 502 : 400 })
  }
}
