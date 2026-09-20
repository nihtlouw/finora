# Finora Business Architecture

## Product role

Finora is a project-engineering ERP / financial operations system connecting commercial intake, project execution, billing, cost, treasury, controls and management reporting.

## Business domains

### 1. Master Data
Client/Vendor, Employee, Workspace, Users.

### 2. Commercial
Proposal → Customer PO → Project, including revisions, contract versions and change orders.

### 3. Project Execution
Project, BOQ, execution milestones, evidence/documents and billing conditions.

### 4. Billing & AR
Billing milestone → Invoice → Payment → Receivable/Cashflow; Credit Note adjusts issued receivables according to status.

### 5. Cost / AP / Payroll
Expense, Vendor Bill, Employee, Payroll. Approved/paid states feed project cost and cashflow according to each domain rule.

### 6. Treasury / Control
Bank Accounts, Cashflow, Bank Statements, Reconciliation, Budgets, Accounting Periods.

### 7. Management
Dashboard, Reports, Receivables views and AI analytical access.

## Core business chains

Commercial:
Proposal → WON → Customer PO VERIFIED → Project

Execution:
Project → BOQ + Execution + Documents

Billing:
Project → Billing Milestone READY → Invoice → Payment → Cashflow

Cost:
Expense / Vendor Bill / Payroll → approval → settlement → Project Cost / Cashflow

Treasury:
Cashflow ↔ Bank Statement → Reconciliation

Management:
Source transactions → derived metrics → Dashboard / Reports

## Architectural principle

No derived value should be maintained manually in multiple places when it can be calculated from an authoritative source.
