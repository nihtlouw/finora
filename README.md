# Finora Platform — UI & Business Core v1

This update implements the approved Finora visual direction and real database-backed core workflows.

## Local setup
```bash
npm install
npm run db:generate
npm run db:migrate -- --name workspace_finance_scope
npm run dev
```

Use `.env.local` for Clerk and `.env` for Neon as in `.env.example`.

## Routes
`/dashboard`, `/clients`, `/proposals`, `/invoices`, `/payments`, `/cashflow`, `/expenses`, `/budgets`, `/reports`, `/ai`, `/settings`.

## Database
Prisma 7 + Neon PostgreSQL.

A migration adds optional workspace scoping to Budget and CashflowTransaction. Existing rows remain readable; new records written by this version receive the active workspace id.

## Important
After extraction, keep your existing `.env` / `.env.local`. Do not overwrite secrets from `.env.example`.
