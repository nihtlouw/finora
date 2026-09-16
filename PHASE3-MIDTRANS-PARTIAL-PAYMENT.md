# Finora — Midtrans Partial Payment Update

## Implemented

- Tombol **Bayar online** sekarang membuka modal nominal pembayaran, bukan langsung membuat checkout.
- Default nominal adalah seluruh **sisa tagihan**.
- User dapat memasukkan nominal lebih kecil untuk **partial payment**.
- Tombol **Bayar penuh** mengembalikan nominal ke seluruh outstanding.
- Frontend membatasi nominal agar tidak melebihi outstanding; backend mengulangi validasi yang sama.
- Checkout Midtrans untuk setiap gateway payment memakai satu `item_details` yang nilainya persis sama dengan `gross_amount`, sehingga partial amount tidak terkena mismatch total item.
- Pending checkout hanya dipakai ulang bila nominalnya sama. Checkout baru dapat dibuat untuk nominal partial yang berbeda.
- Webhook dan status-check memverifikasi gross amount Midtrans terhadap nominal transaksi gateway yang tersimpan sebelum membuat Payment/Cashflow.
- Settlement tetap membuat satu Payment baru dan satu Cashflow INCOME, lalu invoice menjadi `PARTIAL` atau `PAID` berdasarkan akumulasi seluruh payment.

## Contoh

Invoice Rp14.985.000 dan sudah dibayar Rp5.000.000:

- Outstanding: Rp9.985.000
- User membuka **Bayar online**
- Default: Rp9.985.000
- User boleh mengganti menjadi Rp4.000.000
- Setelah settlement: total paid menjadi Rp9.000.000
- Outstanding menjadi Rp5.985.000
- Status invoice menjadi `PARTIAL`

## UAT berikutnya

1. Buka invoice dengan outstanding > 0.
2. Klik **Bayar online**.
3. Pastikan modal menampilkan Total Invoice dan Sisa Tagihan.
4. Ubah nominal menjadi partial, misalnya Rp1.000.000.
5. Lanjutkan ke Midtrans Sandbox dan pastikan checkout menunjukkan Rp1.000.000.
6. Selesaikan simulasi pembayaran.
7. Klik **Cek status** atau tunggu webhook.
8. Pastikan Payment = Rp1.000.000, Cashflow INCOME = Rp1.000.000, invoice `PARTIAL`, dan outstanding berkurang sebesar Rp1.000.000.
9. Ulangi dengan nominal lain sampai lunas untuk memastikan multi-payment tetap konsisten.
