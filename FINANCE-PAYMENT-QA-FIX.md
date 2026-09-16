# Finance Payment QA Fix

## Payment behavior corrected

An invoice may receive multiple payments until the outstanding amount reaches zero.
The previous implementation incorrectly rejected a second payment whenever the invoice already had any payment-derived cashflow.

Expected flow:
- Invoice Rp15.000.000
- Payment 1 Rp5.000.000 -> PARTIAL, outstanding Rp10.000.000, cashflow INCOME Rp5.000.000
- Payment 2 Rp10.000.000 -> PAID, outstanding Rp0, cashflow INCOME Rp10.000.000
- Any further payment -> rejected as invoice already paid
- Any payment above outstanding -> rejected

The duplicate-prevention guarantee is per payment record via the unique `CashflowTransaction.paymentId` constraint, not per invoice.


## Expense approval lock

Approved expenses are immutable in the current workflow. The UI hides Edit/Delete for APPROVED records and shows a locked badge. The API returns HTTP 409 if PATCH or DELETE is attempted on an APPROVED expense, regardless of whether the actor is OWNER or FINANCE. Pending expenses remain editable/deletable according to role permissions. A future correction/void workflow should be used for post-approval changes.
