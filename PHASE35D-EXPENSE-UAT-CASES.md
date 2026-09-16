# Phase 3.5D — UAT Expense Sample Cases

Tambahan script `scripts/seed-expense-cases.mjs` membuat 3 contoh pengeluaran yang aman untuk UAT dan idempotent berdasarkan `description`.

## Case yang dibuat

1. **Material + Vendor master**
   - Kategori: MATERIAL
   - Vendor: PT Kabel Prima Nusantara
   - Pembayaran: BANK_TRANSFER
   - 2 item detail

2. **BBM tanpa Vendor master**
   - Kategori: BBM
   - Vendor: kosong
   - Pihak/Penerima: SPBU / Petugas BBM Lapangan
   - Pembayaran: CASH
   - 1 item detail liter

3. **Konsumsi tanpa Vendor master**
   - Kategori: KONSUMSI
   - Vendor: kosong
   - Pihak/Penerima: Warung / Penanggung Jawab Konsumsi Lapangan
   - Pembayaran: PETTY_CASH
   - 2 item detail

Semua transaksi langsung dialokasikan 100% ke satu Project dan dibuat APPROVED sehingga langsung masuk Cashflow untuk kebutuhan UAT reporting/reconciliation.

## Run

```bash
npm run seed:expenses
```

Script mengambil workspace dari OWNER dan memilih project non-CANCELLED terbaru, dengan preferensi project `BSM-UAT*`. Vendor sample akan dibuat bila belum tersedia.

Seed dapat dijalankan ulang tanpa menduplikasi tiga transaksi karena setiap case menggunakan description marker `UAT-EXPENSE-CASE-*`.
