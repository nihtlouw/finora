# Phase 3.5C — Billing & Payment Milestones

## Tujuan
Menambahkan fondasi jadwal commercial setelah Project terbentuk:

`Project → Billing Milestone → Invoice (opsional link) → Payment Milestone`

Billing milestone menjawab **kapan dan berapa nilai yang ditagihkan**.
Payment milestone menjawab **kapan dan berapa nilai yang diharapkan diterima**.

## Entitas

### BillingMilestone
- Project
- Sequence
- Nama milestone
- Persentase terhadap contract value
- Nilai milestone yang dihitung backend
- Planned date
- Status: `PLANNED / READY / BILLED / CANCELLED`
- Notes
- Opsional link ke Invoice

### PaymentMilestone
- Project
- Opsional link ke BillingMilestone
- Sequence
- Nama milestone
- Persentase terhadap contract value
- Nilai milestone yang dihitung backend
- Due date
- Status: `PLANNED / DUE / PARTIAL / PAID / OVERDUE / CANCELLED`
- Notes

## Aturan keamanan
- Hanya OWNER / FINANCE yang dapat mengelola milestone.
- Semua query di-scope ke workspace aktif melalui Project.
- Project `CLOSED` atau `CANCELLED` tidak dapat ditambah milestone.
- Total persentase Billing Milestone per project maksimal 100%.
- Total persentase Payment Milestone per project maksimal 100%.
- Nilai milestone tidak dipercaya dari browser; backend menghitung dari contract value × percentage.
- Sequence unik per project.
- Milestone yang sudah memiliki invoice tidak dapat dihapus.
- Payment milestone hanya dapat menghubungkan Billing Milestone dari project yang sama.

## Hubungan Invoice
`Invoice.projectId` dan `Invoice.billingMilestoneId` kini tersedia sebagai relasi opsional. Batch ini belum mengubah flow pembuatan invoice otomatis; integrasi generate invoice dari billing milestone dilakukan pada hardening berikutnya.

## UAT
1. Buka Detail Project.
2. Tambahkan Billing Milestone 30%, lalu 70%.
3. Pastikan total menjadi 100% dan percobaan >100% ditolak.
4. Tambahkan Payment Milestone 30% dan 70%.
5. Hubungkan Payment Milestone ke Billing Milestone yang sesuai.
6. Uji status billing `PLANNED → READY → BILLED`.
7. Uji status payment `PLANNED → DUE → PARTIAL → PAID`.
8. Pastikan milestone `BILLED`/`PAID` tidak dapat dihapus atau dikembalikan sembarangan.
9. Pastikan project `CLOSED/CANCELLED` menolak milestone baru.

## Catatan scope
Batch ini adalah **foundation**, bukan final payment reconciliation. Actual payment allocation, overdue otomatis, invoice generation dari billing milestone, dan profitability akan dilanjutkan pada batch finance/project cost berikutnya.
