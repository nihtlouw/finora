# Finora Finance Core Hardening v1

Focus: prevent accounting inconsistencies before Phase 1 proposal/invoice/payment/cashflow QA.

## Included
- Proposal status gate: only ACCEPTED proposals can convert to invoice.
- Finance input validation for money, dates, quantities and required strings.
- Payment overpayment protection and remaining-balance validation.
- Unique payment/expense cashflow links to prevent duplicate derived cashflow rows.
- Invoice GET derives PAID / PARTIAL / OVERDUE presentation state.
- Expense approval avoids duplicate cashflow creation.
- Budget actual summary from workspace expense cashflow.
- Manual cashflow transaction endpoint for OWNER/FINANCE.
- AuditLog table and audit events for core financial mutations and client/vendor changes.
- Effective workspace membership role is used for authorization context.
- Proposal UI now follows DRAFT → SENT → ACCEPTED/REJECTED → CONVERT.
- Payment modal defaults to outstanding amount.

## Migration
Run in development only:

```bash
npm run db:migrate -- --name finance_core_hardening
```

Then:

```bash
npm run db:generate
npm run build
```
