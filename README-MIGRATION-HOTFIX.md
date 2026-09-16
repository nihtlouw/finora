# Phase 3.5D migration hotfix

The migration `20260915220000_project_expense_items_attachments` was using `MIN(projectId)` on a UUID column. PostgreSQL does not provide `min(uuid)`, so `prisma migrate dev` failed in the shadow database with P3006/P3018.

This replacement migration preserves the same schema/data intent but backfills `Expense.projectId` by selecting the single existing allocation directly when an expense has exactly one allocation.

No new migration is introduced. Replace the existing `migration.sql` in:

`prisma/migrations/20260915220000_project_expense_items_attachments/migration.sql`

Then run:

```bash
npm run db:generate
npx prisma migrate dev
npx tsc --noEmit --incremental false
```
