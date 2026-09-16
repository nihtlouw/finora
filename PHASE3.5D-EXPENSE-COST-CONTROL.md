# Phase 3.5D — Expense & Project Cost Control

## Tujuan
Mengubah expense dari catatan biaya sederhana menjadi sumber actual cost project yang aman dan dapat ditelusuri.

## Tipe pembebanan
- `DIRECT` — biaya langsung ke satu project. Allocation otomatis 100%.
- `SHARED` — satu expense dibagi ke dua atau lebih project. Total allocation wajib 100%.
- `OVERHEAD` — biaya operasional umum, tidak dibebankan ke project.
- `UNALLOCATED` — biaya tetap tercatat tetapi belum dibebankan ke project tertentu.

## Data model
`Expense` menyimpan workspace, vendor, kategori, nominal, tanggal, description, payment method, receipt URL, status approval, dan `allocationType`.

`ExpenseAllocation` menyimpan:
- expenseId
- projectId
- percentage
- amount
- note

Nominal allocation dihitung backend dari nominal expense. Total amount allocation harus sama dengan nominal expense.

## Approval
Expense yang melewati threshold approval dibuat `PENDING`. Expense di bawah/equal threshold menjadi `APPROVED` dan membuat cashflow transaction. Expense `APPROVED` dikunci untuk perubahan/delete.

## UAT minimum
1. Buat `DIRECT` Rp150.000 → Project A 100%.
2. Buat `SHARED` Rp300.000 → A 50%, B 30%, C 20%.
3. Coba allocation 90% atau >100% → ditolak.
4. Buat `OVERHEAD` → tidak ada project allocation.
5. Buat `UNALLOCATED` → tetap tercatat tanpa project.
6. Approve expense PENDING → cashflow tercipta satu kali.
7. Buka Project → actual cost hanya menghitung expense `APPROVED`.
8. Pastikan shared allocation masuk ke masing-masing project sesuai nominal.

## Scope berikutnya
- filter Expense berdasarkan bulan/project/kategori/metode/status approval
- halaman detail expense dan evidence upload nyata
- koreksi/void approved expense dengan audit trail
- profitability yang lebih lengkap (revenue billed, received, actual cost, gross margin)
- OCR receipt pada Phase 4

## Revised owner-centric expense model (2026-09-15)

UAT bersama owner mengarahkan Expense menjadi **Project Cost Ledger** yang berpusat pada satu project, bukan workflow multi-project allocation sebagai UX utama.

### New Expense flow

```text
Project (wajib)
  ↓
Vendor
  ↓
Kategori biaya
  ↓
Expense Items
  ├── Deskripsi / item
  ├── Qty
  ├── Satuan
  ├── Harga satuan
  └── Total item otomatis
  ↓
Total Expense otomatis
  ↓
Approval
  ↓
Actual Project Cost
```

### Primary expense categories

- Material
- Consumable / bahan habis pakai
- BBM / Fuel
- Transport / Tol / Parkir
- Jasa / Subkontraktor
- Sewa Peralatan
- Konsumsi / Meeting
- Akomodasi
- Logistik / Pengiriman
- Operasional Umum
- Lainnya

### Evidence

Expense mendukung bukti transaksi berupa **PDF, JPG/JPEG, PNG, atau WebP**, maksimal 5 MB per file dan maksimal 5 file per transaksi pada baseline UAT ini.

### Legacy compatibility

Field `allocationType` dan `ExpenseAllocation` tetap dipertahankan untuk data/laporan legacy. Expense baru menggunakan satu `projectId` sebagai acuan utama dan membuat allocation 100% ke project tersebut agar Project Cost lama tetap konsisten.

### Important business rule

Nominal Expense baru **tidak diketik manual**. Sistem menghitung:

`Qty × Harga Satuan = Total Item`

`Σ Total Item = Total Expense`

Hal ini membuat actual cost project dapat ditelusuri kembali sampai detail pembelian.
