# Finora Data Architecture

## Current canonical models

Workspace, User, WorkspaceMember, AuditLog, ClientVendor, Proposal, ProposalRevision, ProposalSection, ProposalItem, CustomerPO, Project, Invoice, BillingMilestone, PaymentMilestone, InvoiceItem, Payment, PaymentGatewayTransaction, Expense, ExpenseItem, ExpenseAttachment, ExpenseAllocation, CashflowTransaction, Budget, ContractChangeOrder, AccountingPeriod, CreditNote, VendorBill, VendorBillPayment, BankAccount, BankStatementTransaction, BankReconciliation, Employee, PayrollRun, PayrollLine, PayrollAllocation, ProjectDocument, ProjectBOQSection, ProjectBOQItem, ProjectExecutionMilestone, BillingMilestoneCondition, ProjectContractVersion, BillingRebaseline.

## Relationship anchors

- Workspace owns operational data.
- ClientVendor is shared by Proposal, CustomerPO, Project, Invoice, Expense and VendorBill according to type.
- Proposal contains commercial structure and revisions.
- CustomerPO snapshots commercial award and can create one Project.
- Project owns execution, BOQ, documents, billing milestones, expenses, allocations, payroll allocations, vendor bills and change orders.
- BillingMilestone is the controlled origin of project invoicing.
- Invoice owns payments and credit-note adjustments.
- ExpenseAllocation and PayrollAllocation assign costs to projects.
- VendorBillPayment and PayrollRun create canonical cashflow rows when paid.
- BankAccount links book cashflow to bank statements and reconciliation.
- Budget is period/category planning; actual is derived from cashflow.
- AccountingPeriod is the mutation control boundary.

## Employee gap identified by current UI/UAT

Current Employee fields:
employeeNo, name, email, taxId, maritalStatus, baseSalary, bankName, bankAccount, isActive.

Required HR fields for the approved UI concept are not currently persisted:
- position/title
- department
- employmentType
- joinDate
- endDate

Do not display these as authoritative data until they are added to schema and API.

## Data invariants

1. Project belongs to exactly one workspace and one ClientVendor.
2. CustomerPO must not be attached to multiple Projects.
3. Project invoice must originate from a BillingMilestone.
4. One BillingMilestone can create at most one invoice.
5. Payment cannot exceed invoice outstanding.
6. Expense approval and expense settlement are separate states.
7. Approved expense paid state creates the canonical expense cashflow.
8. PayrollRun has one line per employee for a given run.
9. Payroll allocations for a payroll line must total 100%.
10. Vendor Bill payment cannot exceed outstanding.
11. Paid PayrollRun has one canonical payroll cashflow.
12. Submitted/unapproved Change Order does not change contract value.
13. Closed AccountingPeriod rejects financial mutations.
