# Finora Full Deployment UAT — Three Project Scenarios

## Tujuan

Dataset ini dipakai untuk menguji Finora sebagai **Project Commercial + Finance + Operations Control System** pada satu workspace, dengan tiga kondisi project yang sengaja berbeda:

1. **RSPAD — ACTIVE / ongoing**: project besar, execution berjalan, sudah billing dua milestone, pembayaran kedua masih partial, actual cost tinggi, BAP belum selesai.
2. **SS3 — CLOSED / completed**: project kecil berdasarkan PO nyata yang diberikan user, semua execution selesai, BAP/BAST tersedia, seluruh tagihan lunas, profitability dapat dihitung.
3. **Cikarang — ON_HOLD / stalled**: project synthetic berbasis pola retrofit electrical nyata, mobilisasi selesai tetapi procurement BLOCKED, progress billing berikutnya harus ditolak karena execution/evidence belum terpenuhi, serta ada submitted change order yang belum approved.

> **Source discipline:** RSPAD dan SS3 direkonstruksi dari dokumen nyata yang diberikan user. Cikarang adalah synthetic UAT scenario; bukan salinan dokumen customer.

## Skenario 1 — RSPAD ACTIVE

**Customer:** PT.KLIK UTAMA SYSTEM  
**Project:** GD PAV KARTIKA I RSPAD GATOT SUBROTO PUSKESAD  
**Quotation:** EST/KUS/0003-AE-07-2026  
**Commercial reference:** 0072/PH-BSM/KUS/VII/2026  
**Commercial snapshot:** subtotal Rp3.338.506.000 + overhead Rp66.770.120 + rounding Rp3.880 = Rp3.405.280.000  
**Tax treatment:** PPN belum termasuk.

### State yang diharapkan

- Project status: ACTIVE
- Mobilization: COMPLETED
- Procurement: COMPLETED
- FAT: COMPLETED
- Delivery: IN_PROGRESS
- Installation: IN_PROGRESS
- Testing: PLANNED
- BAP/BAST: PLANNED
- Billing: 50% PAID, 45% BILLED/PARTIAL, 5% PLANNED
- Collected: Rp2.702.640.000
- Actual approved cost: Rp2.350.000.000
- Evidence: FAT + DELIVERY

### UAT yang harus dilakukan

Finance harus dapat melihat bahwa:
- 50% sudah tertagih dan lunas.
- 45% sudah ditagihkan tetapi belum lunas seluruhnya.
- Retention belum dapat ditagih.
- Profitability menggunakan revenue basis Rp3.405.280.000 dan actual cost Rp2.350.000.000.
- BAP/BAST belum ada sehingga closeout belum boleh dianggap selesai.

## Skenario 2 — SS3 CLOSED

**Customer:** PT HURIP UTAMA  
**PO:** 00077/PO/HU/VIII/2026  
**Scope:** Jasa Terminasi Penarikan Kabel Power SS3 ke NPK-2  
**Source values:** material Rp22.000.000 + jasa Rp6.377.500 = subtotal Rp28.377.500; PPN 11% Rp3.121.525; grand total Rp31.500.000; tax included.  
**Payment:** 50% DP + 50% final setelah pekerjaan selesai dengan BAP.

### State yang diharapkan

- Project status: CLOSED
- Semua execution milestone: COMPLETED
- BAP/BAST: current evidence
- Closeout: current evidence
- 2 invoice, masing-masing Rp15.750.000
- Total collected: Rp31.500.000
- Revenue basis: Rp28.377.500
- Approved actual cost: Rp18.000.000
- Expected gross profit: Rp10.377.500

### UAT yang harus dilakukan

Owner harus dapat membuka satu project dan menjawab:
- Apakah pekerjaan sudah selesai?
- Apakah BAP tersedia?
- Apakah semua invoice sudah lunas?
- Berapa actual cost?
- Berapa profitability net of tax?
- Apakah status project sudah benar-benar CLOSED?

## Skenario 3 — CIKARANG ON_HOLD

**Customer:** PT Nusantara Properti Sentosa  
**Project:** Upgrade Panel Listrik & Backup Power — Cikarang  
**Scenario type:** synthetic UAT based on industrial electrical retrofit workflow patterns.

### State yang diharapkan

- Project status: ON_HOLD
- Mobilization: COMPLETED
- Procurement: BLOCKED
- FAT: PLANNED
- Delivery: PLANNED
- DP 30% sudah billed + paid
- Progress 60% belum boleh READY
- Pending expense Rp35.000.000
- Submitted change order Rp55.000.000, approvedAmount Rp0

### UAT paling penting

Billing 60% **HARUS ditolak** karena:
- Procurement belum COMPLETED.
- FAT belum COMPLETED.
- FAT evidence belum tersedia.

Dan approval change order belum boleh mengubah contract/billing schedule karena change order baru SUBMITTED.

## Commands

Pastikan DATABASE_URL dan FINORA_OWNER_EMAILS mengarah ke database deployment/UAT yang memang ingin diuji.

### Seed

```bash
npm run seed:uat-three-projects
```

### QA

```bash
npm run qa:uat-three-projects
```

### Enterprise consistency QA

```bash
npm run qa:enterprise
```

### Transition matrix

```bash
npm run qa:transition-matrix
```

## Urutan UAT melalui UI

### A. Portfolio / dashboard

Cek bahwa dashboard tidak hanya menampilkan total, tetapi tiga project mempunyai karakter berbeda:
- ongoing
- completed
- on hold

### B. Project ACTIVE — RSPAD

1. Buka project.
2. Cek BOQ snapshot.
3. Cek execution progress.
4. Buka FAT evidence.
5. Cek Billing 45%.
6. Cek Invoice.
7. Cek payment partial.
8. Cek expense.
9. Cek profitability.
10. Pastikan BAP belum selesai.

### C. Project CLOSED — SS3

1. Buka project.
2. Pastikan semua milestone COMPLETED.
3. Pastikan BAP/BAST tersedia.
4. Buka dua invoice.
5. Pastikan seluruh payment masuk.
6. Periksa cashflow.
7. Periksa profitability.
8. Pastikan status project CLOSED.

### D. Project ON_HOLD — Cikarang

1. Buka project.
2. Pastikan Procurement BLOCKED.
3. Buka Billing 60%.
4. Pastikan readiness menampilkan kondisi yang belum terpenuhi.
5. Pastikan invoice 60% tidak dapat dibuat.
6. Periksa pending expense.
7. Buka Change Order CO-UAT-001.
8. Pastikan status SUBMITTED dan approved amount Rp0.
9. Pastikan contract value dan billing schedule belum berubah.

## Negative tests

UAT dianggap lulus hanya jika sistem menolak:
- Project dari PO yang belum VERIFIED.
- Invoice project tanpa Billing Milestone READY.
- Billing milestone READY ketika required execution/evidence belum terpenuhi.
- Payment melebihi outstanding invoice.
- Change Order SUBMITTED mengubah contract/billing tanpa approval + explicit rebaseline.
- Project COMPLETED/CLOSED melakukan operasi yang seharusnya sudah final.

## Acceptance

Full deployment UAT dianggap **PASS** bila:

```
Data state benar
+
UI menampilkan state yang benar
+
API menolak bypass yang tidak valid
+
Financial totals konsisten
+
Evidence dapat ditelusuri
+
Profitability konsisten
+
Audit trail tersedia
```
