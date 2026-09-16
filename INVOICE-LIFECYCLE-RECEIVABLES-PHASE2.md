# Invoice Lifecycle & Receivables — Phase 2

## Delivered
- Invoice lifecycle display: UNPAID, SENT, PARTIAL, PAID, OVERDUE.
- `Tandai terkirim` action for unpaid invoices before any payment exists.
- Automatic overdue calculation from due date and outstanding balance.
- Receivables page at `/receivables`, restricted to OWNER/FINANCE.
- Aging buckets: current, 1–30, 31–60, 61–90, >90 days.
- Receivables summary: total outstanding, current, overdue, and outstanding invoice count.
- Basic reminder action for overdue invoices, recorded to AuditLog as `REMINDER_SENT`.
- Payment button remains available until an invoice is fully paid.
- Workspace scoping is enforced in invoice and receivables queries.

## Reminder scope
This version records the reminder event in the audit log. It does not send email/WhatsApp. External notification delivery remains a later integration task.

## Migration
No database migration is required. Existing Invoice.status, Invoice.dueDate, Payment, and AuditLog structures are reused.

## QA
1. Invoice UNPAID with future due date -> shows UNPAID and `Tandai terkirim`.
2. Click `Tandai terkirim` -> status becomes SENT.
3. Add partial payment -> status becomes PARTIAL and outstanding decreases.
4. Add final payment -> status becomes PAID and outstanding becomes zero.
5. Invoice past due with outstanding balance -> status becomes OVERDUE.
6. Open Piutang -> aging buckets and outstanding totals match invoice data.
7. Overdue invoice -> `Catat pengingat` records `REMINDER_SENT` and does not change financial amounts.
8. SALES cannot open `/receivables`.
