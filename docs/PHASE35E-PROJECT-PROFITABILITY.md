# Phase 3.5E — Project Profitability

## Data contract

`GET /api/projects/:id/profitability` returns:

- `projectId`, `projectCode`, `projectName`, `clientName`
- `contractValue`: revenue basis; Grand Total PO when available, otherwise Project.contractValue
- `basis`: `PO_GRAND_TOTAL` or `PROJECT_CONTRACT_VALUE`
- `billedAmount`: total non-cancelled/non-void invoices linked to the project
- `collectedAmount`: payments recorded against those invoices
- `outstandingAmount`: max(billedAmount - collectedAmount, 0)
- `actualCost`: sum of ExpenseAllocation.amount where Expense.status = `APPROVED`
- `pendingCost`: sum of ExpenseAllocation.amount where Expense.status = `PENDING`
- `grossProfit`: contractValue - actualCost
- `grossMarginPct`: grossProfit / contractValue × 100 when contractValue > 0, otherwise null
- `billedPct`, `collectedPct`
- `invoiceCount`, `approvedExpenseCount`, `pendingExpenseCount`
- `costByCategory[]`
- `costByAllocationType[]`

## Calculation rules

1. Project is the reporting anchor; all profitability queries are workspace scoped.
2. PO Grand Total is preferred as the revenue basis because project contract value is derived from the customer PO flow. If no positive PO Grand Total exists, use `Project.contractValue`.
3. Gross profit is management/project margin, not accounting revenue recognition.
4. Only `APPROVED` expense allocations reduce gross profit. `PENDING` cost is shown separately and does not reduce the current margin.
5. Expense allocation is the cost attribution source of truth. This prevents double counting shared/allocated expenses.
6. Billing and collection are cash/receivable context only; they do not replace the revenue basis in the gross margin formula.
7. Invoices with raw status `CANCELLED` or `VOID` are excluded from billed and collected totals.
8. An invoice payment contributes to collected amount only through invoices that remain included above.
9. Gross margin is `grossProfit / contractValue * 100`. When contract value is zero, margin is `null` rather than an artificial 0%.
10. Category breakdown is based on the approved allocation amount per expense category.


## UI semantics hardening

- Billing milestone total and payment milestone total are **schedules/plans**, not actual invoice/payment.
- `Invoiced (actual)` comes from actual Invoice records.
- `Collected (actual)` comes from actual Payment records.
- `Actual cost to date` is based on APPROVED ExpenseAllocation only.
- `Gross Margin` is explicitly a current recorded-cost view and must not be interpreted as a final project P&L when costs are incomplete or still pending.
