import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyMidtransSignature } from '@/lib/payments/midtrans'
import { settleMidtransGatewayTransaction } from '@/lib/payments/midtrans-settlement'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizedStatus(transactionStatus: string, fraudStatus?: string | null) {
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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const orderId = String(body.order_id || '')
    const signatureKey = String(body.signature_key || '')
    const statusCode = String(body.status_code || '')
    const grossAmount = String(body.gross_amount || '')

    if (!orderId || !signatureKey || !statusCode || !grossAmount) {
      return NextResponse.json({ error: 'Payload Midtrans tidak lengkap.' }, { status: 400 })
    }
    if (!verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey })) {
      return NextResponse.json({ error: 'Signature Midtrans tidak valid.' }, { status: 401 })
    }

    const gateway = await prisma.paymentGatewayTransaction.findUnique({ where: { orderId } })
    if (!gateway) return NextResponse.json({ ok: true, ignored: true })

    const status = normalizedStatus(String(body.transaction_status || ''), body.fraud_status ? String(body.fraud_status) : null)
    const transactionId = body.transaction_id ? String(body.transaction_id) : null
    const paymentType = body.payment_type ? String(body.payment_type) : null

    if (status === 'SETTLEMENT') {
      const result = await settleMidtransGatewayTransaction({
        gatewayId: gateway.id,
        workspaceId: gateway.workspaceId,
        payload: {
          transaction_status: String(body.transaction_status || ''),
          fraud_status: body.fraud_status ? String(body.fraud_status) : null,
          transaction_id: transactionId,
          payment_type: paymentType,
          gross_amount: grossAmount,
          settlement_time: body.settlement_time ? String(body.settlement_time) : null,
          transaction_time: body.transaction_time ? String(body.transaction_time) : null,
        },
      })

      const auditStatus = result.applied ? 'SETTLEMENT' : status
      await writeAuditLog({
        workspaceId: gateway.workspaceId,
        actorUserId: gateway.createdByUserId,
        action: result.applied ? 'SETTLEMENT' : 'UPDATE',
        entityType: 'PAYMENT_GATEWAY_TRANSACTION',
        entityId: gateway.id,
        metadata: { provider: 'MIDTRANS', orderId, status: auditStatus, transactionId, paymentId: 'paymentId' in result ? result.paymentId : null, source: 'WEBHOOK', reason: result.reason },
      })

      return NextResponse.json({ ok: true, status: auditStatus, applied: result.applied })
    }

    await prisma.paymentGatewayTransaction.update({
      where: { id: gateway.id },
      data: {
        status,
        transactionId,
        paymentType,
        rawResponse: body as any,
      },
    })

    await writeAuditLog({
      workspaceId: gateway.workspaceId,
      actorUserId: gateway.createdByUserId,
      action: 'UPDATE',
      entityType: 'PAYMENT_GATEWAY_TRANSACTION',
      entityId: gateway.id,
      metadata: { provider: 'MIDTRANS', orderId, status, transactionId, source: 'WEBHOOK' },
    })

    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Webhook gagal diproses.' }, { status: 400 })
  }
}
