# Finora UAT Demo Seed v1

Menambahkan 5 Client, 5 Vendor, dan 5 Proposal DRAFT untuk UAT. Data bersifat idempotent berdasarkan nama kontak dan nomor proposal: menjalankan script lagi tidak membuat duplikasi.

## Perintah

```powershell
npm run db:generate
npm run seed:uat-demo
```

`FINORA_OWNER_EMAILS` digunakan untuk memilih workspace OWNER. Jika kosong, script memilih workspace OWNER pertama.

## Demo Client
1. PT Grid Nusantara Energi
2. PT Arunika Smart Infrastruktur
3. PT Cipta Daya Integrasi
4. PT Sagara Power Engineering
5. CV Maju Teknologi Sentosa

## Demo Vendor
1. PT Kabel Prima Nusantara
2. PT Panelindo Energi
3. PT Sensorika IoT Indonesia
4. CV Karya Instalasi Mandiri
5. PT Proteksi Listrik Sejahtera

## Demo Proposal
- PR-UAT-001 — instalasi gardu distribusi 20kV
- PR-UAT-002 — monitoring IoT gardu
- PR-UAT-003 — retrofit proteksi relay dan metering
- PR-UAT-004 — grounding & lightning protection
- PR-UAT-005 — IoT energy monitoring

Semua proposal dibuat DRAFT agar UAT lifecycle tetap bisa dilakukan: DRAFT → SENT → ACCEPTED → Convert to Invoice.
