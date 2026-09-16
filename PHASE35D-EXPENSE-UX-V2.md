# Phase 3.5D — Expense UX + Vendor-Optional Hardening

## Business change
Expense remains **project-first**, but Vendor is no longer treated as mandatory for every operational spend.

Supported patterns:
- Vendor master: use when the payee/supplier is an actual vendor in Client & Vendor.
- Non-vendor spend: use **Pihak / Penerima** for petty cash, employee reimbursement, field spend, daily fuel/transport, small labor, and similar transactions that should not force creation of a Vendor master record.

The API requires at least one of `vendorId` or `payeeName` so the source/payee remains traceable.

## UI changes
- Reworked expense modal into a cleaner 3-section flow: context → itemized cost → evidence.
- Project is visually primary and remains required.
- Vendor master is explicitly marked optional.
- Added free-text Pihak / Penerima field for non-vendor expenses.
- Item entry is now card-based and easier to scan on desktop/mobile.
- Total transaction is visible in the modal header and item footer.
- Evidence upload is visually separated from transaction details.
- Improved spacing, hierarchy, responsive layout, sticky footer, and modal backdrop.
- Expense list now shows **Pihak** rather than assuming every row has a Vendor.

## Backend/data changes
- `Expense.vendorId` becomes nullable.
- Added `Expense.payeeName` (`VARCHAR(200)`).
- Approval, reconciliation, financial export, budget actuals, cashflow listing, and reports no longer exclude non-vendor expenses.
- Cashflow `sourceRef` uses Vendor name, then Pihak / Penerima, then a safe fallback.

## Migration
New migration:
`20260915223000_expense_optional_vendor`

It runs after the Phase 3.5D item/attachment migration and only changes the Expense party fields.

## Validation
The previous category typing fix is retained (`Set<string>`), so the two `VALID_CATEGORIES.has(...)` errors are also covered.

Run locally after overwriting:

```bash
npm run db:generate
npx prisma migrate dev
npx tsc --noEmit --incremental false
```

Do not run `prisma migrate reset` against the UAT database.
