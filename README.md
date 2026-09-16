# QA Enterprise runner fix

Replace `scripts/qa-enterprise.mjs` in the repo with the included file.

Fixes:
- Uses `customerPO`, matching Prisma schema relation name on `Project`.
- Keeps the Prisma 7 TypeScript client import compatible with `npx tsx`.

After overwrite:

```bash
npx tsx scripts/qa-enterprise.mjs
```

If that passes, the package script can later be switched permanently to `tsx scripts/qa-enterprise.mjs`.
