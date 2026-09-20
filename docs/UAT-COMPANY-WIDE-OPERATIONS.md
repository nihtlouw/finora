# Company-Wide Real Case UAT — Finora

## Tujuan

Study case ini melanjutkan UAT tiga project dengan simulasi satu periode operasional perusahaan pada September 2026. Layer ini sengaja synthetic/UAT; bukan klaim bahwa payroll, rekening bank, atau ledger perusahaan tersebut berasal dari dokumen customer.

Backbone project tetap:
- RSPAD — ongoing / ACTIVE
- SS3 — completed / CLOSED
- Cikarang — stalled / ON_HOLD

## Modul yang diisi

- Employees: 8 karyawan dengan jabatan dan gaji pokok
- Payroll: September 2026, 8 payroll lines, allocation ke RSPAD/Cikarang, status PAID
- Expenses: 6 APPROVED + 1 PENDING
- Vendor Bills: 1 PAID Rp125.000.000 + 1 APPROVED/UNPAID Rp40.000.000
- Bank Accounts: BCA Operasional + Mandiri Project
- Bank Statements: matched rows + 1 unmatched Rp750.000
- Bank Reconciliation: DRAFT dengan intentional difference Rp750.000
- Budgets: 8 kategori untuk September 2026
- Accounting Periods: 2026-08 dan 2026-09 OPEN
- Credit Note: 1 DRAFT UAT pada invoice RSPAD

## Angka utama

### Payroll
Gross: Rp83.000.000  
Deductions: Rp4.750.000  
Net: Rp78.250.000

Allocation payroll:
- RSPAD sekitar Rp55.100.000 gross-net allocation basis
- Cikarang sekitar Rp27.900.000 gross-net allocation basis

Catatan: nominal PPh 21/BPJS adalah angka simulasi UAT, bukan perhitungan pajak final.

### Expenses
Approved:
- Transport RSPAD Rp8.500.000
- Material tambahan RSPAD Rp24.000.000
- Engineering survey Cikarang Rp5.000.000
- Shared operations Rp6.000.000
- Logistics RSPAD Rp12.500.000
- Equipment rental Cikarang Rp10.500.000

Total APPROVED: Rp66.500.000

Pending:
- Long-lead protection relay Cikarang Rp18.000.000

### Vendor Bills
- VB-UAT-RSPAD-001 — PAID — Rp125.000.000
- VB-UAT-RSPAD-002 — APPROVED / belum dibayar — Rp40.000.000

## Workflow yang harus terlihat di UI

Employees
Employee master → Payroll

Payroll
DRAFT → APPROVED → PAID → Cashflow → Project Payroll Allocation → Project Profitability

Expense
PENDING/APPROVED → PAID → Cashflow → Project Cost → Profitability

Vendor Bill
DRAFT → APPROVED → PAY → Cashflow → AP / Project Cost

Bank
Bank Account → Book Cashflow → Bank Statement → MATCHED / UNMATCHED → Bank Reconciliation

Budget
Budget category → Cashflow actual → Variance

Period
OPEN period → transaksi finance → dapat ditutup/reopen oleh role yang berwenang

## UAT UI sequence

1. Buka Employees. Pastikan 8 employee terlihat.
2. Buka Payroll. Pastikan PAY-2026-09-001 berstatus PAID dan 8 line terlihat.
3. Buka Projects > RSPAD. Pastikan profitability meningkat cost-nya setelah payroll, expenses, dan vendor bill company-wide UAT.
4. Buka Projects > Cikarang. Pastikan pending cost dan payroll allocation terlihat; status project tetap ON_HOLD.
5. Buka Projects > SS3. Pastikan company-wide seed baru tidak menambah payroll/expense/vendor bill UAT ke proyek CLOSED.
6. Buka Expenses. Pastikan ada 6 APPROVED dan 1 PENDING.
7. Buka Vendor Bills. Pastikan satu bill PAID dan satu APPROVED unpaid.
8. Buka Banks. Pastikan BCA menjadi default dan Mandiri ikut tersedia.
9. Buka Cash Flow. Pastikan payroll, vendor bill, dan expense cashflow muncul.
10. Buka Budgets. Pastikan actual terisi dari cashflow category.
11. Buka Period Closing. Pastikan 2026-08 dan 2026-09 OPEN.
12. Buka Reconciliation. Untuk Payment/Expense automatic reconciliation, tidak boleh muncul mismatch hanya karena bank statement unmatched; modul ini memeriksa cashflow otomatis Payment/Expense.
13. Buka Credit Notes. Draft CN UAT harus terlihat dan belum mengurangi revenue.
14. Buka Reports. Pendapatan, beban, cashflow dan balance snapshot berubah sesuai transaksi yang sudah di-seed.

## Command

Seed:
```bash
npm run seed:uat-company-operations
```

QA:
```bash
npm run qa:uat-company-operations
```

QA expected:
```
=== COMPANY-WIDE UAT PASSED ===
```

## Guardrail

Jalankan hanya pada database UAT/preview yang memang dipakai untuk branch `uat/full-three-projects`. Jangan diarahkan ke production database.
