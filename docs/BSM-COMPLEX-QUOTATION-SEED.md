# BSM Complex Quotation UAT Seed

Script ini membuat satu proposal UAT kompleks yang meniru struktur penawaran PT Berjaya Sukses Makmur (BSM) kepada customer, berdasarkan dokumen quotation/BOQ yang diberikan user. Ini **simulasi UAT**, bukan salinan dokumen customer secara penuh.

## Data utama

- Customer: PT.KLIK UTAMA SYSTEM
- Reference quotation: `0072/PH-BSM/KUS/VII/2026`
- Proposal number: `PR-BSM-UAT-2026-001`
- Project: `GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD`
- Lokasi: Jakarta Pusat
- Status: DRAFT
- PPN: 0% pada proposal karena dokumen sumber menyatakan harga belum termasuk PPN 11%
- Total simulasi: Rp3.405.280.000

## Struktur BOQ

A. Mobilisasi & Demobilisasi  
B. Panel, Trafo, LVMDP & Jasa Instalasi  
C. Pengadaan Kabel & Jasa Instalasi Kabel  
D. Grounding System & Jasa Instalasi  
E. Overhead & Rounding

Setiap item menyimpan category, description, brand, type, specification, qty, unit, unit price.

## Cara pakai

1. Pastikan migration Phase 3.5A sudah diterapkan.
2. Pastikan `npm run db:generate` sudah dijalankan.
3. Pastikan `.env.local` memiliki `DATABASE_URL` dan `FINORA_OWNER_EMAILS` yang sesuai.
4. Jalankan:

```powershell
npm run seed:bsm-complex-quotation
```

Script mencari workspace OWNER berdasarkan `FINORA_OWNER_EMAILS` dan membuat customer bila belum ada.

## Guard keamanan UAT

- Tidak menebak owner/workspace.
- Jika proposal sudah punya invoice, script tidak mengubahnya.
- Jika proposal sudah bukan DRAFT, script tidak mengubahnya.
- Harga seed diverifikasi sebelum commit: harus tepat Rp3.405.280.000.
- Operasi proposal/section/item dilakukan dalam satu transaction.

## UAT yang disarankan

Setelah seed:

`DRAFT → SENT → ACCEPTED → Convert ke Invoice`

Lalu cek:

- tampilan section BOQ
- Material vs Jasa
- Brand/Type/Specification
- subtotal dan total
- PDF/print quotation
- hasil convert ke invoice
