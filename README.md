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

## Phase 3.5F

Execution, commercial controls, project BOQ snapshot, evidence-gated billing, payment terms metadata, contract versions, explicit billing rebaseline, and project document versioning are documented in `PHASE3.5F-EXECUTION-COMMERCIAL-CONTROLS.md`.
