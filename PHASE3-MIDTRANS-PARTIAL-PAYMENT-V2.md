# Finora Phase 3 — Midtrans Partial Payment v2

## Tujuan

Payment online sekarang menggunakan outstanding invoice sebagai sumber batas pembayaran, dengan default bayar penuh tetapi user dapat memilih nominal partial payment.

## Flow online payment

1. User membuka Invoice yang belum PAID.
2. Tombol `Bayar online` membuka modal dengan Total Invoice, Sudah Dibayar, dan Sisa Tagihan.
3. Nominal default = seluruh outstanding.
4. User dapat mengganti nominal ke nilai partial.
5. Backend menghitung ulang outstanding dari seluruh Payment di server dan menolak nominal <= 0 atau > outstanding.
6. Finora membuat transaksi Midtrans dengan gross amount tepat sama dengan nominal yang dipilih.
7. Setelah Midtrans settlement/capture+accept, webhook atau tombol `Cek status sekarang` memproses settlement.
8. Finora membuat satu Payment gateway dan satu Cashflow INCOME secara atomik.
9. Invoice menjadi `PARTIAL` bila masih ada outstanding, atau `PAID` bila outstanding menjadi 0.
10. Halaman Invoice menampilkan status online payment dan melakukan polling status otomatis sementara transaksi pending.

## Sumber kebenaran

Untuk pembayaran Midtrans, nominal yang dicatat sebagai Payment berasal dari `gross_amount` pada status/notification settlement Midtrans dan harus sama dengan nominal gateway transaction yang tersimpan. Screenshot atau bukti dari customer tidak digunakan sebagai konfirmasi settlement online.

## Proteksi concurrency

Payment manual dan settlement Midtrans memakai PostgreSQL advisory transaction lock per invoice. Ini mencegah dua pembayaran yang datang hampir bersamaan membaca outstanding yang sama dan menyebabkan invoice overpaid.

## Case matrix

| Case | Expected result |
|---|---|
| Full online payment, invoice unpaid | Payment = full outstanding, invoice `PAID`, cashflow INCOME 1x |
| Partial online payment | Payment = nominal settlement, invoice `PARTIAL`, outstanding berkurang |
| Second online payment completes invoice | Payment kedua tercatat, invoice `PAID`, outstanding 0 |
| Multiple online payments with different methods | Setiap settlement menjadi Payment terpisah; payment history tetap kumulatif |
| Manual payment then online payment | Online settlement hanya boleh sebesar outstanding terbaru; jika melebihi outstanding, gateway transaction masuk `REVIEW` |
| Online payment then manual payment before settlement | Manual payment dan gateway settlement diserialisasi; online payment tidak dapat membuat invoice overpaid |
| User clicks status repeatedly | Gateway transaction hanya dapat membuat satu Payment; update kedua menjadi idempotent |
| Webhook + status check race | Claim + invoice lock mencegah duplicate Payment/Cashflow |
| Midtrans gross amount differs from expected amount | Gateway transaction menjadi `REVIEW`; tidak ada Payment/Cashflow |
| Midtrans transaction expired/cancelled/failed | Tidak membuat Payment/Cashflow; status gateway diperbarui |
| Invoice already PAID | Backend menolak membuat online transaction baru |
| Amount 0 / negative / above outstanding | Backend menolak |
| SALES role attempts online payment | Backend 403; tombol online tidak ditampilkan untuk SALES |
| Gateway pending | UI menampilkan status pending dan polling otomatis; user dapat cek status manual |
