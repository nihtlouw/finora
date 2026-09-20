# Finora Workflow & State Matrix

## Proposal
DRAFT → SENT → WON / LOST / EXPIRED
Guard: only valid commercial data can be sent; WON is required before downstream award conversion.

## Customer PO
RECEIVED → VERIFIED
RECEIVED → REJECTED
VERIFIED → CANCELLED
Guard: Project creation requires VERIFIED.

## Project
PLANNED → ACTIVE
ACTIVE → ON_HOLD / COMPLETED
ON_HOLD → ACTIVE / CANCELLED
COMPLETED → CLOSED
Guard: financial/document dependencies must be considered before close.

## Billing Milestone
PLANNED → READY
READY → BILLED
BILLED → SETTLED where applicable
READY cannot exist while required execution/document conditions are missing.

## Invoice
DRAFT → ISSUED
ISSUED → PARTIAL / PAID / VOID
Guard: project invoice requires a READY BillingMilestone.

## Payment
CAPTURED/POSTED
Guard: invoice outstanding cannot become negative.

## Expense
PENDING/DRAFT → APPROVED → PAID
Guard: approval != cash settlement. Pending approval must not create payment cashflow.

## Vendor Bill
DRAFT → APPROVED → PARTIAL → PAID
Guard: cannot pay beyond outstanding.

## Payroll
DRAFT → APPROVED → PAID
Guard: only PAID creates payroll cashflow. Payroll allocation must total 100% per line.

## Change Order
DRAFT → SUBMITTED → APPROVED / REJECTED
Guard: submitted amount does not alter contract value. Approved change requires controlled rebaseline/versioning where applicable.

## Credit Note
DRAFT → ISSUED → VOID
Guard: draft does not alter reported financial totals.

## Accounting Period
OPEN → CLOSED
CLOSED → OPEN only through explicit REOPEN with reason/authorization.
Guard: closed period rejects finance mutations.

## Bank Reconciliation
DRAFT → RECONCILED where modeled by workflow.
Unmatched statement items remain explicit exceptions; never silently mutate book cash.

## Cross-domain guard rules

1. Every state transition must be server-side validated.
2. UI visibility is not a permission boundary.
3. Sensitive transitions create AuditLog.
4. Derived totals are recalculated from source records.
5. No UI action should directly write a derived cashflow without the domain mutation that owns it.
