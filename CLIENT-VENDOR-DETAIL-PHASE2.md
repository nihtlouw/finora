# Finora — Client/Vendor Detail Phase 2 v1

## Tujuan
Menaikkan Klien & Vendor dari CRUD list menjadi master data yang memiliki detail finansial dan histori transaksi per kontak.

## Perubahan
- `app/clients/[id]/page.tsx`
  - halaman detail workspace-scoped untuk Client maupun Vendor
  - ringkasan invoice/payment/outstanding untuk Client
  - ringkasan expense/approved/pending untuk Vendor
  - profil kontak
  - histori Proposal, Invoice, Payment, dan Expense
  - tabel invoice & payment atau expense vendor
- `app/api/clients/[id]/route.ts`
  - GET detail terstruktur dengan workspace isolation
  - summary agregat
  - transaction history
  - proposal/invoice/payment/expense detail
  - PATCH/DELETE existing behavior dipertahankan
- `components/clients/client-vendor-manager.tsx`
  - tombol Detail untuk setiap kontak
- `app/globals.css`
  - layout detail responsive

## Tidak ada migration database
Fitur ini memakai relasi Prisma yang sudah ada. Tidak ada perubahan schema.

## QA manual
1. Buka `/clients` sebagai OWNER.
2. Klik `Detail` pada `PT Maju Jaya`.
3. Pastikan total invoice, paid, outstanding, proposal, payment dan histori muncul.
4. Klik `Detail` pada `CV Hosting Nusantara`.
5. Pastikan total expense, approved, pending dan histori expense muncul.
6. Login sebagai SALES; Detail tetap boleh dibaca, tetapi aksi mutasi tetap mengikuti permission yang sudah ada.
7. Coba URL `/clients/{id}` dari workspace berbeda; data harus tidak ditemukan.
