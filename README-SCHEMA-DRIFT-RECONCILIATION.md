# Schema Drift Reconciliation — corrected

The previous reconciliation migration targeted a different BankReconciliation shape (`statementDate`).
The current Finora enterprise schema uses `periodStart` / `periodEnd`, so that version could not apply to the shadow database.

Replace the existing `20260917040000_schema_drift_reconciliation/migration.sql` with the corrected file in this patch.

Then run:

```bash
npx prisma migrate dev
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
```

Expected:

- migration `20260917040000_schema_drift_reconciliation` applies cleanly;
- `Database schema is up to date!`;
- `No difference detected.`

Do not run `prisma migrate resolve` and do not reset the database for this correction.
