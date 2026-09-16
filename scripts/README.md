# Finora QA Enterprise Prisma import fix

Overwrite `scripts/qa-enterprise.mjs` in the repo root.

Reason: Prisma 7 generated client output is TypeScript (`generated/prisma/client.ts`), while the QA script imported a non-existent `client.js`.

After overwrite:

```bash
npm run db:generate
npm run qa:enterprise
```
