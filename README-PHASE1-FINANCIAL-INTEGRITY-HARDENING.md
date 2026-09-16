# Finora Phase 1 — Financial Integrity & Workflow Hardening

This patch is the first production-hardening layer after the canonical workflow review.

## Scope

### Customer PO commercial integrity
- PO created from WON proposal defaults to the proposal subtotal, tax, and grand total.
- The proposal commercial snapshot is stored on the PO.
- A PO value may differ from the proposal only with an explicit commercial variance reason.
- At most one active PO (`RECEIVED` / `VERIFIED`) is allowed per WON proposal at a time.
- PO verification and cancellation record actor/time.
- Cancelled PO remains history; a new PO may be created from the same WON proposal after the previous PO is cancelled.
- Project creation is rejected when a PO has an unexplained commercial variance.

### Invoice relationship integrity
- A project invoice must be linked to a Billing Milestone.
- Generic invoice creation now persists `projectId` and `billingMilestoneId` instead of silently dropping the relationship.
- Billing milestone invoices use the milestone amount as the canonical invoice amount.
- Project/billing-milestone invoices are locked from arbitrary edit/delete through the generic invoice endpoint.
- Payments are rejected for `CANCELLED` / `VOID` invoices.

### Expense accounting integrity
- Expense approval is no longer treated as cash settlement.
- New approved expenses remain `UNPAID` until an explicit payment action occurs.
- `POST /api/expenses/:id/pay` creates the cashflow movement and marks the expense `PAID`.
- Historical approved expenses that already had a cashflow transaction are migrated to `PAID`.

## Intended financial semantics

`Expense incurred -> Approval -> Paid -> Cashflow`

Approval answers: "Can this cost be accepted?"
Settlement answers: "Has cash actually left the company?"

This prevents project cost and cashflow from becoming the same event.

## UAT impact

The Golden Path now expects:

`Proposal WON -> Customer PO RECEIVED -> PO VERIFIED -> Project`

The PO screen should prefill the proposal's exact commercial values.
A cancelled PO may be replaced without creating another proposal.

## Remaining phases

This patch intentionally does not pretend to complete the entire target architecture. The next hardening phases are:

1. Contract change order / amendment with versioned contract value.
2. Vendor Bills / Accounts Payable separate from project expense.
3. Payroll / employee master and payroll runs.
4. Bank accounts, reconciliation, and statement matching.
5. Accounting periods and month-end close/lock.
6. Credit note / invoice correction / void workflow.
7. Shared and unallocated expense allocation workflow.
8. Document center and project file lifecycle.
9. Stronger audit/event history and immutable transaction corrections.
10. Full end-to-end regression/UAT automation.
