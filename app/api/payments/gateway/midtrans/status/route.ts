import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import { getMidtransStatus } from '@/lib/payments/midtrans'
import { settleMidtransGatewayTransaction } from '@/lib/payments/midtrans-settlement'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function mapGatewayStatus(transactionStatus: string, fraudStatus?: string | null) {
  if (transactionStatus === 'pending') return 'PENDING'
  if (transactionStatus === 'expire') return 'EXPIRED'
  if (transactionStatus === 'cancel') return 'CANCELLED'
  if (transactionStatus === 'deny' || transactionStatus === 'failure') return 'FAILED'
  if (transactionStatus === 'settlement') return 'SETTLEMENT'
  if (transactionStatus === 'capture') {
    if (fraudStatus === 'accept') return 'SETTLEMENT'
    if (fraudStatus === 'deny') return 'FAILED'
    return 'REVIEW'
  }
  return 'REVIEW'
}

export async function GET(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) return NextResponse.json({ error: 'Hanya Owner/Finance.' }, { status: 403 })

  const url = new URL(req.url)
  const orderId = url.searchParams.get('orderId') || ''
  if (!orderId) return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 })

  const gateway = await prisma.paymentGatewayTransaction.findFirst({
    where: { workspaceId: c.workspace.id, orderId },
  })
  if (!gateway) return NextResponse.json({ error: 'Transaksi gateway tidak ditemukan.' }, { status: 404 })

  try {
    const status = await getMidtransStatus(orderId)
    const transactionStatus = String(status.transaction_status || '')
    const fraudStatus = status.fraud_status ? String(status.fraud_status) : null
    const mapped = mapGatewayStatus(transactionStatus, fraudStatus)
    let settlementResult: any = null

    if (mapped === 'SETTLEMENT') {
      settlementResult = await settleMidtransGatewayTransaction({
        gatewayId: gateway.id,
        workspaceId: c.workspace.id,
        payload: {
          transaction_status: transactionStatus,
          fraud_status: fraudStatus,
          transaction_id: status.transaction_id ? String(status.transaction_id) : null,
          payment_type: status.payment_type ? String(status.payment_type) : null,
          gross_amount: String(status.gross_amount || ''),
          settlement_time: status.settlement_time ? String(status.settlement_time) : null,
          transaction_time: status.transaction_time ? String(status.transaction_time) : null,
        },
      })
    } else {
      await prisma.paymentGatewayTransaction.update({
        where: { id: gateway.id },
        data: {
          status: mapped,
          transactionId: status.transaction_id ? String(status.transaction_id) : null,
          paymentType: status.payment_type ? String(status.payment_type) : null,
          rawResponse: status as any,
        },
      })
    }

    const fresh = await prisma.invoice.findFirst({
      where: { id: gateway.invoiceId, client: { workspaceId: c.workspace.id } },
      include: { payments: true },
    })
    if (!fresh) return NextResponse.json({ error: 'Invoice terkait tidak ditemukan.' }, { status: 404 })

    const total = Number(fresh.totalAmount)
    const paid = fresh.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const outstanding = Math.max(0, total - paid)

    return NextResponse.json({
      status: mapped,
      transactionStatus,
      paymentType: status.payment_type || null,
      orderId,
      amount: Number(gateway.amount),
      paidAmount: paid,
      outstandingAmount: outstanding,
      invoiceStatus: fresh.status,
      applied: settlementResult?.applied ?? false,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal mengecek status Midtrans.' }, { status: 400 })
  }
}
