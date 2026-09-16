# QA — Invoice Lifecycle & Receivables

## Test A — Mark invoice sent
- Create a new invoice with a future due date.
- Confirm initial status `UNPAID`.
- Click `Tandai terkirim`.
- Expected: `SENT`.
- Payment remains enabled.

## Test B — Partial/full payment
- Pay less than outstanding -> `PARTIAL` and remaining balance decreases.
- Pay remaining balance -> `PAID`, outstanding `Rp0`.
- Further payment -> rejected.

## Test C — Overdue
- Use a test invoice whose due date is before today and has outstanding balance.
- Expected status: `OVERDUE`.
- Piutang aging shows the correct day bucket.

## Test D — Receivables summary
Expected:
- Total piutang = sum of outstanding invoices.
- Current = outstanding invoices not overdue.
- Overdue = sum of overdue outstanding invoices.
- Aging buckets sum to overdue amount.

## Test E — Reminder
- On an overdue invoice, click `Catat pengingat`.
- Expected: success message and audit entry `REMINDER_SENT`.
- Total/outstanding/payment values must not change.

## Test F — Permission
- OWNER/FINANCE can view `/receivables`.
- SALES/VIEWER are redirected away from `/receivables`.
