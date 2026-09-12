# Finora — Stabilization & UX v1

Tahap ini merapikan authentication/session behavior dan experience layer sebelum modul transaksi production dibangun.

## Yang berubah

- User baru **tidak otomatis menjadi OWNER**.
- Role OWNER hanya diberikan kepada email atau Clerk user ID yang terdaftar pada environment bootstrap.
- Existing OWNER yang tidak termasuk daftar bootstrap akan diturunkan menjadi VIEWER saat sesi Finora berikutnya dimuat.
- Menu profil sekarang memiliki status sesi, reset data demo, dan logout.
- Notification bell memiliki popover yang lebih informatif.
- Ada penanda `Development · Data demo` agar batas prototype vs production jelas.
- Greeting dan tanggal dashboard mengikuti waktu aplikasi, bukan hard-coded.
- Nama berbasis email diringkas agar sidebar/header tetap rapi.
- Fokus keyboard, popover, mobile spacing, dan visual session state dipoles.

## Environment tambahan

Tambahkan ke `.env`/`.env.local`:

```env
FINORA_OWNER_EMAILS=owner@example.com
FINORA_OWNER_CLERK_IDS=
FINORA_TIMEZONE=Asia/Jakarta
```

**Penting:** untuk menjadikan akun Clerk Anda sebagai Owner, masukkan email akun tersebut ke `FINORA_OWNER_EMAILS`. Jangan menggunakan mekanisme "user pertama = owner".

## Local development

```bash
npm install
npm run db:generate
npm run dev
```

Untuk logout, gunakan menu profil di pojok kanan atas → `Keluar`.

Untuk menguji akun lain:

1. Logout dari Finora.
2. Buka `/sign-in`.
3. Login dengan akun Clerk lain.
4. Akun baru akan menjadi `VIEWER` kecuali email/Clerk ID sudah diizinkan pada `FINORA_OWNER_EMAILS` / `FINORA_OWNER_CLERK_IDS`.

## Data demo

Modul UI yang belum terhubung ke backend masih menggunakan state browser untuk kebutuhan prototyping. Badge `Development · Data demo` dibuat sengaja supaya pengguna tidak salah menganggap tombol prototype sebagai transaksi produksi.

`Reset data demo` menghapus key `finora_state` dari `localStorage` lalu memuat ulang aplikasi.

## Checkpoint

Setelah tahap ini:

- Next.js ✅
- Clerk ✅
- Prisma ✅
- Neon ✅
- User sync ✅
- Session/logout UX ✅
- Role bootstrap hardening ✅
- UI stabilization v1 ✅

Tahap bisnis berikutnya tetap: Clients & Vendors → Proposal → Invoice → Payment → Cash Flow.
