# Phase 3.5D — Project Expense Entry Flow

## Owner-centric revision

Expense sekarang berpusat pada **satu Project**. User tidak lagi dipaksa memahami Direct/Shared/Overhead/Unallocated sebagai keputusan utama saat input biaya baru.

### Flow

```text
Project
  ↓
Vendor
  ↓
Kategori
  ↓
Detail item
  ├─ Apa yang dibeli
  ├─ Qty
  ├─ Satuan
  ├─ Harga satuan
  └─ Total otomatis
  ↓
Bukti (PDF / gambar)
  ↓
Approval
  ↓
Actual Project Cost
```

## Kategori UAT

- MATERIAL — material pekerjaan
- CONSUMABLE — bahan habis pakai
- BBM — bahan bakar
- TRANSPORT — tol, parkir, transport
- JASA_SUBKON — jasa dan subkontraktor
- SEWA_PERALATAN — sewa alat/kendaraan/peralatan
- KONSUMSI — makan/meeting/snack
- AKOMODASI — hotel/penginapan
- LOGISTIK — pengiriman/cargo
- OPERASIONAL_UMUM — biaya operasional yang masih dicatat dalam konteks project
- LAINNYA — fallback

## Contoh

```text
Project: RSPAD
Vendor: PT Sumber Kabel Abadi
Kategori: MATERIAL

Item                         Qty  Unit     Harga       Total
Kabel NYY 4x10               100  meter    125.000     12.500.000
MCB 3P 100A                   10  pcs      850.000      8.500.000

Total Expense                                       21.000.000
```

## Evidence

Format yang diterima:

- PDF
- JPG/JPEG
- PNG
- WebP

Batas baseline UAT:

- maksimum 5 MB per file
- maksimum 5 file per transaksi
- bukti dapat dilihat melalui endpoint private berdasarkan workspace

## Backward compatibility

`allocationType` dan `ExpenseAllocation` dipertahankan untuk transaksi legacy dan laporan yang sudah ada. Expense baru menggunakan `projectId` sebagai acuan utama dan menyimpan allocation 100% ke project tersebut agar perhitungan actual cost lama tetap konsisten.
