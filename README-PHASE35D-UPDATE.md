# Phase 3.5D Update — Expense Project-Centric

Perubahan batch ini mengubah UX Expense menjadi project-centric sesuai feedback owner.

## Yang berubah

- Project wajib untuk Expense baru.
- Kategori biaya dibuat terstruktur untuk filter/report.
- Expense memiliki item detail: deskripsi, qty, unit, harga satuan, total item.
- Total Expense dihitung server dari seluruh item.
- Bukti transaksi mendukung PDF/JPG/JPEG/PNG/WebP.
- Evidence disimpan sebagai attachment private berbasis database pada baseline UAT ini.
- `allocationType`/`ExpenseAllocation` tetap dipertahankan untuk kompatibilitas transaksi legacy.

## Setelah overwrite

```bash
npm run db:generate
npx prisma migrate dev
npx tsc --noEmit --incremental false
```

Tidak perlu seed.
