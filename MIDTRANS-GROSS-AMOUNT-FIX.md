# Finora Midtrans Gross Amount Fix

## What was fixed

Midtrans requires `transaction_details.gross_amount` to equal the exact sum of `item_details` (price × quantity). This release fixes commercial invoices with discount/tax and partial-payment checkouts.

### Full invoice payment
The gateway payload keeps the invoice item lines and adds:
- `Diskon` as a negative item line when discount > 0
- `Pajak` as a positive item line when tax > 0

Example:
- Service: Rp15,000,000
- Diskon: -Rp1,500,000
- Pajak: +Rp1,485,000
- Gross: Rp14,985,000

### Partial payment
When the outstanding amount is lower than the full invoice total, the gateway payload uses one synthetic `Sisa tagihan <invoice>` line so the item-detail sum exactly equals the amount being charged.

This prevents `transaction_details.gross_amount is not equal to the sum of item_details` while preserving the invoice's commercial totals inside Finora.

## UAT
1. Use a full outstanding invoice with discount/tax and click `Bayar online`.
2. Confirm Midtrans opens at the exact outstanding amount.
3. Use a partial invoice and confirm the checkout amount equals the outstanding balance.
4. Confirm payment, Cashflow, and Reconciliation still work as before.
