# Finora Stabilization & UX v1 — Upgrade Guide

## 1. Backup branch

```bash
git status
git add .
git commit -m "chore: checkpoint before stabilization ux v1"
```

## 2. Replace files

Extract this ZIP into the existing repository root and overwrite matching files.
Do not create a second project folder.

## 3. Install / generate

```bash
npm install
npm run db:generate
```

No database migration is required for this update because the Prisma schema is unchanged.

## 4. Owner configuration

Add these to `.env` or `.env.local`:

```env
FINORA_OWNER_EMAILS=your-clerk-email@example.com
FINORA_OWNER_CLERK_IDS=
FINORA_TIMEZONE=Asia/Jakarta
```

Only the configured email/Clerk ID can receive `OWNER`.

New users default to `VIEWER`.
Existing unauthorized `OWNER` users are demoted to `VIEWER` when their Finora session is loaded.

## 5. Start

```bash
npm run dev
```

## 6. Test

- `/sign-in` — Clerk login
- `/dashboard` — protected Finora app
- profile button → `Keluar` — terminate Clerk session
- profile button → `Reset data demo` — clear local demo state
- notification button — notification panel
- check `User` in Prisma Studio after login

## 7. Important behavior

Clerk sessions are persistent. Refreshing `localhost:3000` while a Clerk session exists means the user is still authenticated. That is expected. Use the profile menu's `Keluar` action to terminate the session.
