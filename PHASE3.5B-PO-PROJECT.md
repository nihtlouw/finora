# Phase 3.5B — Customer PO & Project Foundation

## Tujuan
Menambahkan alur commercial setelah quotation:

`Quotation ACCEPTED → Customer PO → PO VERIFIED → Project PLANNED`

## Entitas baru

### CustomerPO
- Nomor PO
- Tanggal PO
- Tanggal diterima
- Referensi quotation
- Status: RECEIVED / VERIFIED / REJECTED / CANCELLED
- Subtotal
- PPN
- Grand total
- Catatan
- Referensi quotation/client/workspace

### Project
- Kode project
- Nama project
- Lokasi
- Start date
- Target end date
- Contract value
- Status: DRAFT / PLANNED / ACTIVE / ON_HOLD / COMPLETED / CLOSED / CANCELLED
- Notes
- Link ke quotation dan PO customer

## Workflow UAT
1. Proposal BSM harus `ACCEPTED`.
2. Dari Detail Proposal klik `Catat PO Customer`.
3. Simpan PO dalam status `RECEIVED`.
4. Klik `Verifikasi` → `VERIFIED`.
5. Klik `Buat Project`.
6. Isi kode project dan tanggal.
7. Project terbentuk dalam status `PLANNED` dan contract value mengikuti grand total PO.
8. Buka Detail Project untuk melihat hubungan Client ↔ Quotation ↔ PO ↔ Project.

## Security
- PO dan Project dibatasi ke OWNER / FINANCE.
- Semua query scoped ke workspace aktif.
- Project hanya dibuat dari PO `VERIFIED`.
- Quotation referensi PO wajib `ACCEPTED`.
- Satu PO hanya dapat membentuk satu Project.

## Seed UAT
Setelah proposal BSM diterima:

```bash
npm run seed:bsm-project
```

Seed membuat contoh PO `PO-BSM-UAT-2026-001` dan Project `BSM-UAT-2026-001` bila belum ada.


## Hardening Batch 3.5B

### Aturan lifecycle PO
- PO baru selalu dibuat `RECEIVED`. Client tidak boleh menetapkan status final saat create.
- `RECEIVED → VERIFIED` untuk verifikasi.
- `RECEIVED → REJECTED` untuk menolak PO.
- `VERIFIED → CANCELLED` hanya jika PO belum membentuk project.
- PO `REJECTED` dan `CANCELLED` bersifat terminal.
- PO yang sudah membentuk project tidak dapat dibatalkan.

### Aturan integritas commercial
- PO baru wajib mereferensikan Proposal `ACCEPTED`.
- Grand total harus sama persis dengan `subtotal + PPN`.
- Semua query selalu scoped ke workspace aktif.
- Project hanya dibuat dari PO `VERIFIED` yang memiliki Proposal `ACCEPTED`.

### Aturan lifecycle Project
- `DRAFT → PLANNED → ACTIVE → COMPLETED → CLOSED` adalah jalur normal.
- `PLANNED`/`ACTIVE` dapat masuk `ON_HOLD`.
- `CANCELLED` hanya dapat dipilih sebelum project selesai/ditutup.
- Project `CLOSED` dan `CANCELLED` tidak dapat diaktifkan kembali.
- Status transition divalidasi di API, bukan hanya di UI.
