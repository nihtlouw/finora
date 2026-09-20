
# FINORA — MASTER ERP PRD + ERD ARCHITECTURE

Status: Draft architecture baseline for full-domain rebuild
Branch: `uat/full-three-projects`

## 0. Executive decision

Finora must be treated as an integrated **project-engineering ERP / financial operations system**, not as a collection of CRUD pages.

The current UAT proves that the database can contain realistic cross-module data, but the screenshots expose an architectural UI problem:

- Employees and Payroll are currently rendered through the generic `EnterpriseList`.
- Employee master data contains salary/bank information, but the page only displays name and bank.
- Payroll contains detailed payroll lines and project allocations, but the page only displays one summary row.
- Several modules therefore look "empty" or "broken" even when the underlying database has data.

**Rule for the next implementation:** each domain gets its own domain-specific page, manager, detail view, lifecycle actions, validation, and acceptance tests. Generic tables remain only for truly generic administrative lists.

---

# 1. System domain architecture

Finora is divided into 7 business domains.

## Domain A — Identity & Master Data
Entities:
- User
- Workspace
- WorkspaceMember
- ClientVendor
- Employee

Pages:
- Clients
- Employees
- Settings
- Settings / Members
- Settings / Audit

## Domain B — Commercial & Project Origination
Entities:
- Proposal
- ProposalSection
- ProposalItem
- ProposalRevision
- CustomerPO
- ProjectContractVersion
- ContractChangeOrder
- BillingRebaseline

Pages:
- Proposals
- Proposal Detail
- Customer POs
- Change Orders

Workflow:
`Proposal → WON → Customer PO → VERIFIED → Project`

## Domain C — Project Execution
Entities:
- Project
- ProjectBOQSection
- ProjectBOQItem
- ProjectExecutionMilestone
- ProjectDocument
- BillingMilestone
- BillingMilestoneCondition
- PaymentMilestone

Pages:
- Projects
- Project Detail
- Documents

Project detail is the operational cockpit.

## Domain D — Billing, AR & Collections
Entities:
- Invoice
- InvoiceItem
- Payment
- PaymentGatewayTransaction
- CreditNote

Pages:
- Invoices
- Receivables
- Payments
- Credit Notes

Workflow:
`Project → Billing Milestone READY → Invoice → Payment → Cashflow`

## Domain E — Cost, AP & Payroll
Entities:
- Expense
- ExpenseItem
- ExpenseAllocation
- VendorBill
- VendorBillPayment
- Employee
- PayrollRun
- PayrollLine
- PayrollAllocation

Pages:
- Expenses
- Vendor Bills
- Employees
- Payroll

Workflow:
`Expense / Vendor Bill / Payroll → Approval → Settlement → Cashflow → Project Cost`

## Domain F — Treasury & Accounting Control
Entities:
- BankAccount
- BankStatementTransaction
- BankReconciliation
- CashflowTransaction
- Budget
- AccountingPeriod

Pages:
- Banks
- Cashflow
- Budgets
- Reconciliation
- Period Closing

## Domain G — Reporting & Management
Derived from:
- Project
- Invoice
- Payment
- Expense
- Payroll
- VendorBill
- Cashflow
- Budget
- Bank reconciliation

Pages:
- Dashboard
- Reports
- Receivables
- AI

---

# 2. ERD — canonical relationship map

~~~mermaid
erDiagram

  WORKSPACE ||--o{ WORKSPACE_MEMBER : has
  USER ||--o{ WORKSPACE_MEMBER : joins
  WORKSPACE ||--o{ CLIENT_VENDOR : owns
  WORKSPACE ||--o{ EMPLOYEE : employs

  CLIENT_VENDOR ||--o{ PROPOSAL : receives
  PROPOSAL ||--o{ PROPOSAL_SECTION : contains
  PROPOSAL_SECTION ||--o{ PROPOSAL_ITEM : contains
  PROPOSAL ||--o{ PROPOSAL_REVISION : revisions

  PROPOSAL ||--o{ CUSTOMER_PO : becomes
  CLIENT_VENDOR ||--o{ CUSTOMER_PO : issues
  CUSTOMER_PO ||--o| PROJECT : creates

  PROJECT }o--|| CLIENT_VENDOR : belongs_to
  PROJECT ||--o{ PROJECT_BOQ_SECTION : has
  PROJECT_BOQ_SECTION ||--o{ PROJECT_BOQ_ITEM : contains
  PROJECT ||--o{ PROJECT_EXECUTION_MILESTONE : executes
  PROJECT ||--o{ PROJECT_DOCUMENT : stores

  PROJECT ||--o{ BILLING_MILESTONE : bills
  BILLING_MILESTONE ||--o{ BILLING_MILESTONE_CONDITION : gates
  PROJECT_EXECUTION_MILESTONE ||--o{ BILLING_MILESTONE_CONDITION : satisfies

  BILLING_MILESTONE ||--o| INVOICE : generates
  INVOICE ||--o{ INVOICE_ITEM : contains
  INVOICE ||--o{ PAYMENT : receives
  INVOICE ||--o{ CREDIT_NOTE : adjusted_by

  PROJECT ||--o{ EXPENSE : costs
  EXPENSE ||--o{ EXPENSE_ITEM : contains
  EXPENSE ||--o{ EXPENSE_ALLOCATION : allocates
  PROJECT ||--o{ EXPENSE_ALLOCATION : receives

  EMPLOYEE ||--o{ PAYROLL_LINE : paid
  PAYROLL_RUN ||--o{ PAYROLL_LINE : contains
  PAYROLL_LINE ||--o{ PAYROLL_ALLOCATION : allocates
  PROJECT ||--o{ PAYROLL_ALLOCATION : receives

  PROJECT ||--o{ VENDOR_BILL : receives
  VENDOR_BILL ||--o{ VENDOR_BILL_PAYMENT : settled_by
  BANK_ACCOUNT ||--o{ VENDOR_BILL_PAYMENT : pays

  BANK_ACCOUNT ||--o{ CASHFLOW_TRANSACTION : owns
  PAYMENT ||--o| CASHFLOW_TRANSACTION : creates
  EXPENSE ||--o| CASHFLOW_TRANSACTION : creates
  PAYROLL_RUN ||--o| CASHFLOW_TRANSACTION : creates
  VENDOR_BILL_PAYMENT ||--o| CASHFLOW_TRANSACTION : creates

  BANK_ACCOUNT ||--o{ BANK_STATEMENT_TRANSACTION : imports
  BANK_STATEMENT_TRANSACTION }o--o| CASHFLOW_TRANSACTION : matches
  BANK_ACCOUNT ||--o{ BANK_RECONCILIATION : reconciles

  WORKSPACE ||--o{ BUDGET : plans
  WORKSPACE ||--o{ ACCOUNTING_PERIOD : controls
~~~

---

# 3. Canonical lifecycle rules

## Commercial

| Object | Lifecycle |
|---|---|
| Proposal | DRAFT → SENT → WON / LOST / EXPIRED |
| Customer PO | RECEIVED → VERIFIED → REJECTED / CANCELLED |
| Project | PLANNED → ACTIVE → ON_HOLD / COMPLETED → CLOSED |
| Change Order | DRAFT → SUBMITTED → APPROVED / REJECTED |
| Contract version | V1 → V2 → V3 ... |

A Project must not be created from an unverified PO.

## Billing

| Object | Lifecycle |
|---|---|
| Billing milestone | PLANNED → READY → BILLED → PAID/SETTLED |
| Invoice | DRAFT → ISSUED → PARTIAL/PAID → VOID/CANCELLED |
| Payment | CAPTURED / POSTED |
| Credit Note | DRAFT → ISSUED → VOID |

Invoice source must be a READY billing milestone.

## Expense
`DRAFT/PENDING → APPROVED → PAID`

Approval does not itself equal cash settlement.

## Vendor bill
`DRAFT → APPROVED → PARTIAL → PAID`

Payment must never exceed outstanding.

## Payroll
`DRAFT → APPROVED → PAID`

Only PAID payroll produces payroll cashflow.

## Treasury
`Book cashflow ↔ Bank statement ↔ Reconciliation`

A bank statement difference must not silently change book cash.

---

# 4. PAGE PRD

## 4.1 Dashboard — `/dashboard`

### Purpose
Management command center.

### Must answer
- How much cash do we have?
- How much revenue has been billed/collected?
- What projects are running?
- Which projects are at risk?
- What receivables are outstanding?
- What costs have occurred?
- What needs owner action?

### Sections
1. Cash balance
2. Revenue / billed / collected
3. Expense / payroll / AP
4. Project portfolio
5. Project progress
6. AR aging
7. AP aging
8. Upcoming billing milestones
9. Alerts / exceptions

### No generic CRUD.
---

## 4.2 Clients — `/clients`

### Purpose
Authoritative client/vendor master.

### Entity
`ClientVendor`

### UI
- search
- type filter
- active/inactive
- category
- PIC
- contact
- commercial activity summary

### Detail
- identity
- contacts
- proposals
- POs
- projects
- invoices
- receivables

### Actions
Create / edit / deactivate.

---

## 4.3 Proposals — `/proposals`

### Purpose
Commercial origination.

### Entity graph
`Proposal → Sections → Items → Revisions`

### List
- proposal number
- client
- project
- value
- tax treatment
- status
- valid until
- revision

### Detail
1. Header/commercial status
2. BOQ
3. Pricing
4. overhead
5. rounding
6. tax
7. commercial terms
8. payment terms
9. revisions
10. conversion controls

### Critical rules
- totals are deterministic
- tax included/excluded explicit
- rounding visible as commercial component
- payment terms support trigger + days, not only percentages

---

## 4.4 Customer PO — `/customer-pos`

### Purpose
Control customer award received by Finora.

### Entity
`CustomerPO`

### List
- PO number
- client
- quotation
- date
- total
- tax
- status
- verification

### Detail
- source quotation snapshot
- PO commercial snapshot
- payment terms snapshot
- variance
- verification history
- project relationship

### Actions
Receive / verify / reject / cancel.

### Guard
Cannot create project from RECEIVED.

---

## 4.5 Projects — `/projects`

### Purpose
Portfolio view.

### List
- project code
- customer
- contract value
- revenue basis
- status
- progress
- billed
- collected
- cost
- gross profit

### Filters
Status, client, date, profitability, execution progress.

### Project detail is the real cockpit.

---

# 5. Project Detail — `/projects/[id]`

This page must become one of the most important Finora pages.

### Header
- project code
- customer
- contract value
- revenue basis
- current version
- status
- dates
- location

### Tabs

#### Overview
KPIs, progress, financial health, alerts.

#### Commercial
PO, proposal, contract versions, payment terms.

#### BOQ
Sections, item, planned qty, actual qty, progress, planned vs actual.

#### Execution
Milestone timeline with status and evidence.

#### Billing
Billing milestones, readiness, invoice source.

#### Payments
Invoices, payments, outstanding.

#### Cost
Expenses, payroll allocations, vendor bills.

#### Profitability
Revenue basis, actual cost, pending cost, GP, margin.

#### Documents
FAT, BAP/BAST, PO, contract, receipts, evidence.

#### Change Orders
Submitted / approved changes and rebaseline.

### Project page must not be one giant generic table.

---

# 6. Invoices — `/invoices`

### Purpose
AR invoice register.

### Detail
- invoice header
- source billing milestone
- project
- customer
- subtotal
- tax
- total
- due date
- payment history
- credit note history
- outstanding

### Actions
Issue, reminder, void according to status rules.

---

# 7. Receivables — `/receivables`

### Purpose
Collection management, not duplicate invoice listing.

### Must show
- total outstanding
- current
- 1–30
- 31–60
- 61–90
- >90 days
- customer
- invoice
- amount
- days overdue

### Actions
Open invoice / reminder / filter / export.

---

# 8. Payments — `/payments`

### Purpose
Cash collection.

### UI
Payment register plus invoice context.

### Detail
- invoice
- customer
- project
- payment date
- amount
- method
- reference
- bank account
- cashflow link

### Guards
- cannot overpay
- cannot pay cancelled invoice
- payment creates one canonical income cashflow.

---

# 9. Expenses — `/expenses`

### Purpose
Operational cost capture.

### List
- date
- vendor/payee
- category
- project
- amount
- approval status
- settlement status
- receipt

### Detail
- receipt/document
- item lines
- allocation
- approval audit
- payment
- cashflow

### Actions
Create / approve / pay.

### State separation
Approval ≠ settlement.

---

# 10. Employees — `/employees`

This page requires a **full replacement of the current generic implementation**.

### Current architectural problem

The current `Employee` entity contains:
- employeeNo
- name
- email
- taxId
- maritalStatus
- baseSalary
- bankName
- bankAccount
- isActive

But the current UI only shows:
- name
- bank
- generic status placeholder
- generic value placeholder

That is why the screenshot is misleading.

### Employee list must show

| Column | Source |
|---|---|
| Employee No | employeeNo |
| Name | name |
| Position | requires employee position field |
| Employment status | isActive |
| Base Salary | baseSalary |
| Tax ID | masked |
| Bank | bankName |
| Payroll status | derived from latest PayrollRun |

### Employee detail

1. Profile
2. Employment
3. Compensation
4. Tax
5. Bank
6. Payroll history
7. Project allocations
8. Audit history

### Required schema extension

Current schema lacks:
- position/title
- department
- employment type
- join date
- leave/end date

Recommended additions:
`position`
`department`
`employmentType`
`joinDate`
`endDate`

No fake field should be rendered until persisted.

---

# 11. Payroll — `/payroll`

This page also requires full replacement of `EnterpriseList`.

### Current architectural problem

The current page knows a PayrollRun has:
- gross
- deduction
- net
- payDate
- status
- lines

but only renders the PayrollRun summary row.

The detailed payroll is therefore invisible.

### List view

- Run number
- Period
- Employee count
- Gross
- Total deductions
- Net
- Status
- Approval
- Payment date

### Payroll detail

#### Header
- run number
- period
- pay date
- status

#### Summary cards
- headcount
- gross
- PPh 21
- BPJS
- other deduction
- net

#### Payroll lines
Employee | Gross | PPh21 | BPJS | Other | Net

#### Project allocation
Employee | Project | % | Amount

#### Workflow
DRAFT → APPROVED → PAID

#### Cashflow
One canonical payroll cashflow linked to PayrollRun.

### Important design rule
Payroll allocation should represent **cost basis** assigned to projects.

---

# 12. Vendor Bills — `/vendor-bills`

### Purpose
Accounts payable.

### List
- bill no
- vendor
- project
- invoice date
- due date
- amount
- status
- paid amount
- outstanding

### Detail
- bill
- project
- tax
- approval
- payments
- bank
- cashflow
- outstanding

### Workflow
DRAFT → APPROVED → PARTIAL → PAID

---

# 13. Banks — `/banks`

### Purpose
Bank account master, not only "list accounts".

### Bank detail
- bank
- account number masked
- currency
- opening balance
- book balance
- statement balance
- unreconciled amount
- latest transactions

### Related data
BankAccount → CashflowTransaction → BankStatementTransaction → Reconciliation.

---

# 14. Cashflow — `/cashflow`

### Purpose
Treasury transaction ledger.

### Must show
- date
- direction
- category
- amount
- source
- project
- bank account
- linked object

### Detail
- source entity
- transaction
- audit trail
- linked invoice/expense/payroll/vendor bill

### Rule
Cashflow should not become an independent duplicate accounting source.

---

# 15. Budgets — `/budgets`

### Purpose
Budget vs actual control.

### View
Category | Budget | Actual | Variance | Utilization %

### Period
Month / quarter / year.

### Actual sources
Cashflow categories.

### Future enhancement
Project budget and department budget can be separate from corporate cash budget.

---

# 16. Reconciliation — `/reconciliation`

Two reconciliation layers must be clearly separated.

### Layer A — System integrity
Payment/Expense/Payroll/Vendor Bill → automatic cashflow.

### Layer B — Bank reconciliation
Bank Statement ↔ Cashflow.

The current page should not confuse these two.

### Bank reconciliation UI
- bank account
- statement period
- statement ending balance
- book balance
- difference
- matched
- unmatched
- reconciliation status

---

# 17. Reports — `/reports`

### Purpose
Management reporting.

### Sections
- P&L
- Cash Flow
- AR
- AP
- Project profitability
- Budget variance
- Balance snapshot

### Every KPI must have drill-down.

A report number without a path to source transactions is not sufficient.

---

# 18. Change Orders — `/change-orders`

### Purpose
Commercial change control.

### List
- project
- change number
- requested
- approved
- status
- effective date

### Detail
- reason
- requested amount
- approval
- contract version
- billing impact
- rebaseline

### Rule
SUBMITTED ≠ APPROVED.

Unapproved change order cannot change contract value.

---

# 19. Credit Notes — `/credit-notes`

### Purpose
Invoice revenue adjustment.

### Detail
- invoice
- reason
- subtotal
- tax
- total
- status
- issuer
- void history

### Rule
DRAFT does not affect revenue.

ISSUED reduces receivable/revenue according to accounting policy.

---

# 20. Period Closing — `/periods`

### Purpose
Accounting lock.

### List
- period
- status
- closed date
- user

### Actions
Close / Reopen.

### Guard
A closed period must reject financial mutations.

---

# 21. Documents — project document library

### Purpose
Document evidence store.

### Categories
- PO
- Contract
- FAT
- Delivery
- Invoice
- BAP_BAST
- Receipt
- Test Report
- Other

### UI
- category filters
- document number
- version
- date
- current version
- preview/download
- audit metadata

---

# 22. AI — `/ai`

AI is an analytical layer.

It must not directly mutate financial state without normal API workflows.

Possible questions:
- Which project has largest overdue receivable?
- Which project has highest cost variance?
- Which billing milestone is blocked?
- Which vendor bill is due soon?

Every AI answer should link back to source records.

---

# 23. Settings

## `/settings`
Workspace configuration.

## `/settings/members`
Workspace access / role management.

## `/settings/audit`
Immutable audit trail.

Roles:
- OWNER
- FINANCE
- SALES
- VIEWER

Every sensitive financial mutation should produce AuditLog.

---

# 24. Navigation architecture

~~~text
COMMAND
├── Dashboard
└── Reports

COMMERCIAL
├── Proposals
├── Customer POs
└── Change Orders

PROJECTS
├── Projects
└── Documents

FINANCE
├── Invoices
├── Receivables
├── Payments
├── Expenses
├── Vendor Bills
├── Payroll
└── Credit Notes

TREASURY
├── Cash Flow
├── Banks
├── Reconciliation
└── Budgets

CONTROL
└── Period Closing

MASTER DATA
├── Clients / Vendors
└── Employees

ADMIN
├── Settings
├── Members
└── Audit
~~~

---

# 25. API architecture

Every domain should follow:

`GET /api/<domain>`
`POST /api/<domain>`
`GET /api/<domain>/[id]`
`PATCH /api/<domain>/[id]`

Domain actions use explicit verbs:
- /approve
- /pay
- /verify
- /cancel
- /rebaseline
- /remind
- /reconcile

UI should never bypass these state-transition APIs.

---

# 26. UI architecture

Generic components are allowed for:
- Card
- Table
- Badge
- Modal
- FormField
- PageHeader
- KPI card
- Filter bar
- Empty state

Generic **business pages are not allowed** when the domain has meaningful detail.

Therefore `EnterpriseList` must NOT be the primary implementation of:
- Employees
- Payroll
- Banks
- Vendor Bills
- Change Orders
- Credit Notes
- Documents

Each should have a domain manager.

---

# 27. Definition of done per page

A page is NOT complete when:
- route loads
- table contains rows
- API returns 200

A page is complete only when:
1. Master/detail data is visible.
2. Business status is visible.
3. Primary actions work.
4. Invalid transitions are rejected.
5. Related modules update correctly.
6. Audit trail is created where required.
7. Source transactions are traceable.
8. Empty/error/loading states are handled.
9. Role permissions are enforced.
10. Automated QA covers the lifecycle.

---

# 28. Implementation sequence

## Phase A — Foundation / domain UI
1. Employees
2. Payroll
3. Banks
4. Vendor Bills
5. Expenses

## Phase B — Treasury
6. Cashflow
7. Reconciliation
8. Budgets
9. Period Closing

## Phase C — Project cockpit
10. Project detail
11. BOQ
12. Execution
13. Billing
14. Cost
15. Profitability
16. Documents

## Phase D — Commercial
17. Proposals
18. Customer PO
19. Change Orders
20. Credit Notes

## Phase E — Management
21. Dashboard
22. Reports
23. Receivables
24. AI

## Phase F — Cross-cutting QA
- role matrix
- transition matrix
- negative cases
- reconciliation
- profitability consistency
- audit integrity
- production build

---

# 29. First refactor required from current screenshots

### Employees
Replace generic table with:
`EmployeeListPage`
→ filters
→ KPI summary
→ employee table
→ employee drawer/detail
→ create/edit modal
→ payroll history

### Payroll
Replace generic table with:
`PayrollListPage`
→ period filter
→ status filter
→ summary KPIs
→ payroll run table
→ payroll run detail
→ line items
→ allocation tab
→ approve/pay actions
→ cashflow reference

No further "half implementation" should be accepted for these modules.

---

# 30. UAT acceptance principle

Finora will be considered domain-complete only when a single September operational simulation can traverse:

`Employees → Payroll → Project Allocation → Expenses → Vendor Bills → Billing → Payments → Cashflow → Bank Statement → Reconciliation → Budget → Project Profitability → Reports`

with no manual duplicate entry of derived totals and with all source relationships traceable.

