# Finora — Platform Keuangan Startup

Prototype web interaktif yang dibangun dari briefing teknis dan ERD yang diberikan.

## Cara menjalankan

Paling sederhana: buka `index.html` langsung di browser modern.

Atau gunakan server lokal:

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Yang sudah dieksekusi

- Dashboard finansial: saldo kas, pendapatan, pengeluaran, piutang jatuh tempo, cashflow chart, financial health.
- Proposal: daftar proposal, status, pembuatan proposal baru, dan convert proposal diterima menjadi invoice.
- Invoice: daftar invoice, filter/search, tandai lunas, dan sinkron ke cash flow.
- Cash Flow: transaksi otomatis/manual dengan sumber dari invoice & biaya.
- Biaya Operasional: input biaya, approval threshold, dan feed cash flow.
- Klien & Vendor: master data yang dipakai di proposal/invoice/biaya.
- Budgeting: budget vs actual dan alert kategori yang mendekati limit.
- Laporan Keuangan: ringkasan laba rugi, perbandingan periode, AI insight.
- AI Assistant: Q&A berbasis data demo + smart follow-up, document AI, rekonsiliasi, forecasting.
- Pengaturan: profil bisnis, approval, audit log, reminder, payment gateway.
- LocalStorage: perubahan data demo dipertahankan di browser.
- Responsive untuk desktop, tablet, dan mobile.

## Pemetaan ERD

Prototype mengikuti entitas utama: `USERS`, `CLIENTS_VENDORS`, `PROPOSALS`, `PROPOSAL_ITEMS`, `INVOICES`, `INVOICE_ITEMS`, `PAYMENTS`, `EXPENSES`, `CASHFLOW_TRANSACTIONS`, dan `BUDGETS`.

## Tahap produksi

Frontend prototype ini sengaja tidak mengklaim telah memiliki backend production. Untuk implementasi sesuai rekomendasi teknis, langkah berikutnya adalah memindahkan state demo ke Next.js App Router + Prisma/Drizzle + Neon Postgres, menambahkan auth/role-based access, Vercel Blob, job scheduler, payment gateway webhook, audit log, dan provider OCR/LLM.
