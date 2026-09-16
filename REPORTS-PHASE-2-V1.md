# Finora Reports Phase 2 v1

## Delivered

- Profit & Loss basis kas dari Cashflow sebagai source of truth.
- Filter periode: bulan, kuartal, tahun, custom, semua.
- Comparison terhadap periode sebelumnya dengan perubahan persentase.
- Balance Sheet sederhana per akhir periode: kas bersih, piutang usaha, total aset, liabilitas yang termodelkan (saat ini 0 karena belum ada ledger kewajiban), dan ekuitas sederhana.
- Export CSV mengikuti filter aktif dan membawa ringkasan P&L, Balance Sheet sederhana, serta detail Cashflow.

## Accounting scope

Balance Sheet ini masih sederhana dan basis kas. Model saat ini belum mempunyai opening balance, fixed assets, liabilities/loan ledger, equity ledger, tax payable, inventory, atau accrual journal. Karena itu angka Balance Sheet bukan pengganti laporan akuntansi penuh.

## QA

1. Filter bulan → cek P&L.
2. Filter kuartal/tahun → cek rentang transaksi.
3. Custom range → cek transaksi yang masuk/excluded.
4. Comparison → cek current vs previous period.
5. Balance Sheet → cek snapshot pada akhir periode.
6. Export CSV → cek filter dan summary.
