# Finora Finance Core Hardening v1 — QA Matrix

## Gate 0 — local integrity
- `npm install`
- `npm run db:generate`
- `npm run db:validate`
- `npm run build`

## Gate 1 — proposal lifecycle
- Create proposal starts as DRAFT
- DRAFT → SENT
- SENT → ACCEPTED
- SENT → REJECTED
- DRAFT/ SENT cannot convert directly
- ACCEPTED converts exactly once
- Converted proposal gets one invoice

## Gate 2 — invoice/payment safety
- Invoice total equals sum of line items using decimal-safe cents calculation
- Payment cannot be <= 0
- Payment cannot exceed outstanding amount
- Fully paid invoice becomes PAID
- Partial payment becomes PARTIAL
- Past unpaid due date is shown as OVERDUE
- Payment generates exactly one derived cashflow row

## Gate 3 — expenses
- Vendor must belong to active workspace
- Amount must be positive
- Amount over `FINORA_EXPENSE_APPROVAL_THRESHOLD_CENTS` is PENDING
- Lower amount is APPROVED and creates one cashflow row
- Approval creates cashflow exactly once
- Only OWNER/FINANCE can approve

## Gate 4 — cashflow
- Payment cashflow is INCOME
- Expense cashflow is EXPENSE
- Manual cashflow allowed only to OWNER/FINANCE
- Manual transaction cannot spoof a paymentId/expenseId
- Transactions are workspace scoped

## Gate 5 — budgets
- Duplicate workspace/category/period is rejected
- Actual expense cashflow is summarized by category
- Budget values are workspace scoped

## Gate 6 — audit
Audit entries should exist for:
- client/vendor create/update/archive/delete
- proposal create/status/convert
- invoice create
- payment create
- expense create/approve
- budget create
- manual cashflow create

## Gate 7 — security
- Unauthenticated requests return 401
- Unauthorized roles return 403
- workspace id always comes from authenticated context, never request input
