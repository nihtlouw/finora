# QA — Midtrans Snap Sandbox

## Preconditions
- `MIDTRANS_SERVER_KEY` and `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` are configured with Sandbox keys.
- `MIDTRANS_IS_PRODUCTION=false`.
- `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local finish redirect.
- Database migration and Prisma Client are up to date.

## Flow A — Create online payment
1. Login as OWNER or FINANCE.
2. Open an unpaid/partial invoice.
3. Click `Bayar online`.
4. A Midtrans Sandbox hosted checkout should open.
5. Gateway order amount must equal the server-calculated outstanding, not a browser-supplied amount.

## Flow B — Local status polling
If Midtrans cannot reach localhost webhook, complete a Sandbox payment, return to Finora, and use `Cek status` on the same invoice row. The status endpoint checks Midtrans server-side and, on settlement, creates exactly one Payment and one Cashflow INCOME.

## Flow C — Webhook
Expose `/api/payments/gateway/midtrans/webhook` through a public HTTPS tunnel for development. Configure the URL in Midtrans Sandbox. Settlement notifications must be verified by `SHA512(order_id + status_code + gross_amount + server_key)` before any financial mutation.

## Expected financial result
`settlement/capture accepted` → Payment `PAYMENT_GATEWAY` → Invoice `PARTIAL/PAID` → Cashflow `INCOME` → Reconciliation matched.

## Negative cases
- Gateway amount > outstanding → gateway transaction moves to REVIEW; no Payment/Cashflow is created.
- Invalid webhook signature → HTTP 401; no financial mutation.
- Duplicate settlement notification → no duplicate Payment/Cashflow.
- Viewer/Sales attempt to create/check gateway → HTTP 403.
- Paid invoice → HTTP 409.
