# Finora PostgreSQL SSL + Next.js Hotfix

Perbaikan ini menghilangkan warning pg-connection-string dengan membuat `sslmode=verify-full` eksplisit, dan meng-upgrade Next.js 16.3.4 → 16.3.5.

## Yang berubah
- DATABASE_URL dinormalisasi ke `sslmode=verify-full` sebelum dipakai Prisma/pg.
- DIRECT_URL dinormalisasi dengan cara yang sama untuk Prisma CLI.
- `.env.example` memakai `sslmode=verify-full`.
- Next.js dan eslint-config-next diperbarui ke 16.3.5.

## Terapkan
```bash
npm install
npm run db:generate
npm run dev
```

Tidak perlu migration database untuk hotfix ini.
