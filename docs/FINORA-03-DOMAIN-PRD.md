# Finora Domain PRD

## Definition

Each page owns a business responsibility, not a generic CRUD responsibility.

## Dashboard
Purpose: management command center.
Must show cash, revenue, billed/collected, cost, projects, AR/AP, upcoming billing and exceptions.
Every KPI requires drill-down to source records.

## Clients
Purpose: Client/Vendor master.
List, filters, identity, contacts, commercial history, projects, invoices, receivables.
Actions: create, edit, activate/deactivate.

## Employees
Purpose: employee master and HR-facing operational context.
List: employee no, name, position, department, status, base salary, bank, payroll status.
Detail: profile, employment, compensation, tax, bank, payroll history, project allocation, audit.
Actions: create, edit, deactivate.
Do not expose sensitive data broadly; mask bank/tax identifiers.

## Proposals
Purpose: commercial origination.
List: number, customer, project, total, tax mode, status, valid until, revision.
Detail: BOQ sections/items, pricing, overhead, rounding, tax, commercial terms, payment terms, revisions, conversion.
Rule: commercial totals are deterministic and explainable.

## Customer PO
Purpose: verify customer award.
Detail: source quotation snapshot, PO totals/tax, payment terms, variance, verification history.
Actions: receive, verify, reject, cancel.
Guard: only VERIFIED can create a project.

## Projects
Purpose: portfolio.
List: project, client, status, value, revenue basis, progress, billed, collected, cost, gross profit.
Filters: status, client, period and financial state.

## Project Detail
Purpose: operational cockpit.
Tabs: Overview, Commercial, BOQ, Execution, Billing, Payments, Cost, Profitability, Documents, Change Orders.
No generic single-table page.

## Invoices
Purpose: AR invoice register.
Detail must include source billing milestone, project, customer, amounts, due date, payment history, credit notes and outstanding.

## Receivables
Purpose: collection management.
Show current and aging buckets, customer, invoice, amount, days overdue.
Must not simply duplicate invoice register.

## Payments
Purpose: customer cash collection.
Show invoice/customer/project/date/amount/method/reference/cashflow.
Guard overpayment and cancelled invoice payment.

## Expenses
Purpose: operational cost capture.
List and detail receipt/items/allocation/approval/payment/cashflow.
Actions: create, approve, pay.
Approval is not settlement.

## Vendor Bills
Purpose: AP.
List vendor, bill, project, dates, total, paid, outstanding, status.
Detail includes approval, payment, bank and cashflow.

## Payroll
Purpose: payroll processing and cost allocation.
List: run number, period, headcount, gross, deductions, net, status, approval, pay date.
Detail: summary + employee lines + project allocations + workflow + cashflow reference.

## Banks
Purpose: bank-account and treasury context.
List bank/name/masked account/opening/book/statement/unreconciled.
Detail includes latest transactions and reconciliation.

## Cashflow
Purpose: canonical treasury ledger view.
Columns: date, direction, category, amount, bank account, source, project and linked object.
Source links must be traceable.

## Budgets
Purpose: budget-vs-actual.
View: category, budget, actual, variance, utilization. Period filter required.

## Reconciliation
Two distinct concerns:
A. system-integrity reconciliation: automatic cashflows from Payment/Expense/etc.
B. bank reconciliation: Bank Statement versus Book Cashflow.
UI must keep them distinct.

## Reports
P&L, Cash Flow, AR, AP, project profitability, budget variance, balance snapshot. Source drill-down required.

## Change Orders
Requested amount, approved amount, reason, status, effective date, contract version, rebaseline impact.
Submitted does not alter contract.

## Credit Notes
Invoice, reason, subtotal, tax, total, status, issuer, void history.
Draft does not affect financial totals.

## Periods
Open/closed status, close/reopen metadata. Closed period blocks financial mutations.

## Documents
Evidence library by project. Categories include PO, Contract, FAT, Delivery, Invoice, BAP/BAST, Receipt, Test Report and Other. Version/current controls required.

## AI
Read/analysis layer. No direct financial mutation without normal domain APIs. Responses should reference source entities.
