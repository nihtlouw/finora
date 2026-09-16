# Phase 3 — Midtrans Snap Sandbox

Finora kini memiliki fondasi payment gateway Midtrans Snap untuk sandbox. Integrasi menggunakan backend server key untuk membuat transaksi, menyimpan order di `PaymentGatewayTransaction`, menerima HTTP notification dengan verifikasi signature SHA-512, dan mengubah settlement menjadi Payment + Cashflow INCOME secara idempotent.

## Environment

Tambahkan ke `.env.local` untuk development:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-...
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Gunakan sandbox keys dari Midtrans Merchant Administration Portal. Jangan commit server key.

## Cara kerja

1. Owner/Finance membuka Invoice dengan outstanding.
2. Klik `Bayar online`.
3. Finora membuat Snap transaction dengan nominal outstanding dan order ID unik.
4. Browser membuka hosted checkout Midtrans.
5. Midtrans mengirim notification ke `/api/payments/gateway/midtrans/webhook`.
6. Signature diverifikasi menggunakan `SHA512(order_id + status_code + gross_amount + server_key)`.
7. Settlement/capture accepted dibuat menjadi satu Payment + Cashflow INCOME.
8. `Cek status` dapat dipakai saat development lokal jika webhook Midtrans belum dapat menjangkau localhost.

## Webhook untuk local testing

Midtrans harus dapat mengakses URL webhook dari internet untuk push notification. Untuk localhost gunakan public HTTPS tunneling hanya selama development, misalnya Cloudflare Tunnel/ngrok, lalu set notification URL di Midtrans Sandbox ke:

`https://<public-host>/api/payments/gateway/midtrans/webhook`

Jangan expose server key.

## Safety rules

- Hanya OWNER/FINANCE yang dapat membuat gateway checkout/status.
- Nominal checkout berasal dari outstanding invoice di server, bukan dari browser.
- Satu gateway order mempunyai `orderId` unik.
- Webhook settlement idempotent; jika payment gateway sudah mempunyai Payment, notifikasi ulang tidak membuat Payment/Cashflow kedua.
- Gateway amount tidak boleh melebihi outstanding invoice.
- Payment gateway menjadi `PAYMENT_GATEWAY` pada Payment; metode/payment type provider disimpan di `PaymentGatewayTransaction.paymentType`.
