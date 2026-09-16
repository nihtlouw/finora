# Phase 3.5D — Expense UAT Seed Hotfix

Fixes the UAT expense seed script against the current Prisma/PostgreSQL naming convention.

Changes:
- `WorkspaceMember.userId`, `workspaceId`, `createdAt` are now referenced with their actual quoted PostgreSQL column names.
- Removes the second `pool.end()` call from the outer error handler. The main function's `finally` block already closes the pool, preventing `Called end on pool more than once`.

After overwriting the script, run:

```bash
npm run seed:expenses
```
