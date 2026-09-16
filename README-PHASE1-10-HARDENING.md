# Finora Phase 1–10 Hardening

This patch continues the enterprise workflow architecture from Commercial → Project → Billing → Cost → Treasury → Control.

## Included controls

- Customer PO commercial snapshot + variance reasoning + duplicate active-PO guard.
- Project can only originate from VERIFIED PO tied to WON Proposal.
- Contract Change Order with INCREASE / DECREASE semantics and accounting-period guard.
- Accounting Period OPEN/CLOSED + owner-only reopen with reason.
- Invoice ↔ Billing Milestone integrity and credit-note-aware outstanding.
- Credit Note subtotal + tax = total validation and workspace-unique numbering.
- Expense approval separated from settlement/payment; closed periods block mutation/posting.
- Vendor Bills / AP with duplicate supplier invoice protection and payment cap.
- Bank Account + statement matching + reconciliation control.
- Payroll workflow with project allocation support (manual statutory inputs; not a statutory tax engine).
- Project Documents upload/download/delete control.
- Project profitability includes approved expense cost, vendor-bill cost, payroll cost, and issued credits.
- Enterprise invariant QA + transition matrix scripts.

## Runtime verification required in the target repo

```bash
npm run db:generate
npx prisma migrate dev
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
npm run build
npx tsc --noEmit --incremental false
npm run qa:transition-matrix
npm run qa:enterprise
```

Do not reset the UAT database during this verification.

## Known business limitations

1. Payroll calculations accept PPh21/BPJS values as controlled inputs; there is not yet a complete Indonesian statutory tax engine.
2. Bank statement matching is exact one-to-one matching; production bank integrations should add CSV/API import and assisted matching rules.
3. Project documents are stored as DB bytes in this phase; object storage is recommended for scale.
4. The system is financial-control oriented but is not yet a full double-entry general ledger.
