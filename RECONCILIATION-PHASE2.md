# Finora Phase 2 — Reconciliation

Fitur ini menambahkan kontrol rekonsiliasi read-only untuk memastikan integrasi transaksi finansial inti tetap konsisten.

## Yang diperiksa

- Payment harus memiliki tepat satu Cashflow `INCOME` dengan nominal sama.
- Approved Expense harus memiliki tepat satu Cashflow `EXPENSE` dengan nominal sama.
- Expense `PENDING`/`REJECTED` tidak boleh sudah menghasilkan Cashflow otomatis.
- Missing, duplicate, type mismatch, dan amount mismatch ditampilkan sebagai temuan.
- Transaksi Cashflow manual tidak dianggap sebagai anomali karena memang tidak mempunyai source Payment/Expense.

## Akses

Hanya `OWNER` dan `FINANCE` yang dapat melihat rekonsiliasi dan export-nya.

## Tidak ada auto-repair

Rekonsiliasi sengaja bersifat read-only. Sistem tidak otomatis membuat/menghapus Cashflow karena koreksi finansial harus tetap dapat diaudit dan ditinjau manusia.

## UAT

1. Buka `Rekonsiliasi` sebagai Owner atau Finance.
2. Periode `Semua` harus menunjukkan `RECONCILED` untuk dataset normal saat ini.
3. Pastikan Payment Rp5 juta dan Rp10 juta masing-masing matched.
4. Pastikan Expense approved Rp1,5 juta matched.
5. Buat transaksi manual Cashflow dan pastikan tidak muncul sebagai issue.
6. Export CSV dan pastikan file berisi status dan daftar issue.
