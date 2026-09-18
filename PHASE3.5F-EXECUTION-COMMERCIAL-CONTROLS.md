# Phase 3.5F — Execution, Commercial Controls & Financial Gates

## Tujuan
Menutup gap operasional yang ditemukan dari quotation RSPAD dan PO Kabel Power SS3 tanpa mengubah Project menjadi sekadar invoice container.

## Yang diimplementasikan

### 1. Commercial snapshot
Proposal dan Customer PO sekarang menyimpan:
- currency
- taxIncluded
- overheadAmount
- roundingAmount
- rounded total
- pricingMode
- commercial notes

Angka unrounded dan rounded dipisahkan. Ini mendukung pola RSPAD: subtotal → overhead → total → rounded.

### 2. Quotation revision history
`ProposalRevision` menyimpan snapshot immutable quotation/BOQ/totals. Endpoint:
- `GET /api/proposals/:id/revisions`
- `POST /api/proposals/:id/revisions`

### 3. Project BOQ snapshot
Saat Project dibuat dari PO VERIFIED, sistem membuat:
`Proposal BOQ → ProjectBOQSection/ProjectBOQItem`

Actual qty, actual amount, dan progress dicatat pada snapshot project. Perubahan quotation tidak mengubah snapshot project.

### 4. Execution lifecycle
Project otomatis mempunyai:
`Mobilisasi → Procurement → FAT → Delivery → Installation → Testing → Commissioning → BAP/BAST → Closeout`

Status execution divalidasi di API.

### 5. Billing evidence gate
Billing milestone dapat memiliki:
- triggerCode / triggerDescription
- execution milestone condition
- required document category

`PLANNED → READY` akan ditolak jika required execution/evidence belum terpenuhi. Endpoint pembuatan invoice melakukan pengecekan yang sama sebagai second-line hard gate.

### 6. Payment terms
Payment milestone sekarang mendukung:
- triggerCode
- dueDays
- retentionMonths
- retentionPercent
- conditionNotes

Customer PO juga menyimpan `paymentTermsSnapshot` agar termin transaksi tidak bergantung pada quotation aktif.

### 7. Contract version + explicit rebaseline
Approval Change Order sekarang:
`Original Contract Version → New Contract Version`

Approval **tidak** mengubah nominal Billing/Payment Milestone secara otomatis.

Rebaseline dilakukan eksplisit melalui:
`POST /api/change-orders/:id/rebaseline`

Rebaseline menyimpan snapshot old/new amount dan hanya mengubah milestone yang masih planned/due-ready sesuai aturan.

### 8. Project document versioning
ProjectDocument mendukung:
- documentKey
- version
- documentDate
- tags
- source
- isCurrent

Upload dengan documentKey yang sama otomatis membuat version berikutnya dan menandai versi sebelumnya tidak current.

## Master UAT — RSPAD

Seed `seed:bsm-complex-quotation` menggunakan angka komersial dari dokumen sumber:
- subtotal Rp3.338.506.000
- overhead Rp66.770.120
- unrounded total Rp3.405.276.120
- rounding Rp3.880
- rounded total Rp3.405.280.000
- PPN 11% belum termasuk
- termin 50% / 45% / 5%

Seed `seed:bsm-project` membentuk project foundation, execution lifecycle, contract version, BOQ snapshot, dan payment/billing schedule dengan evidence gate FAT serta BAP/BAST.

## UAT sequence

1. Proposal DRAFT
2. SENT
3. WON
4. Customer PO RECEIVED
5. VERIFIED
6. Project PLANNED
7. BOQ snapshot terbentuk
8. Execution milestone terbentuk
9. Billing 50% dapat READY sesuai trigger PO
10. Billing 45% ditolak sebelum FAT + FAT evidence
11. FAT COMPLETED + FAT document → 45% dapat READY
12. Invoice dibuat hanya dari READY billing
13. Payment aktual memperbarui invoice/collection
14. BAP/BAST COMPLETED + evidence → retention 5% dapat READY
15. Change Order APPROVED → contract version baru, billing belum berubah
16. Explicit rebaseline → planned/ready milestone amount diperbarui
17. Profitability membaca revenue basis dan approved actual cost
18. Project closeout

## Reset UAT
`npm run db:reset-uat` sekarang juga menghapus execution/BOQ/document/version/rebaseline artifacts sambil mempertahankan Proposal, ProposalSection, ProposalItem, dan client yang masih direferensikan proposal.
