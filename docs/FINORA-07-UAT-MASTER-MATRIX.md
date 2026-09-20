# Finora Master UAT Matrix

## Definition of Done

For each domain:
1. schema is correct,
2. API GET/POST/PATCH/actions work,
3. list shows authoritative data,
4. detail shows related data,
5. valid transition succeeds,
6. invalid transition returns 409/appropriate error,
7. linked derived records are created exactly once,
8. audit exists where required,
9. role restrictions work,
10. page passes build and runtime smoke test.

## Phase A

### Employees
- Create employee.
- Edit employee.
- Deactivate employee.
- List shows persisted fields.
- Detail shows payroll history after payroll seed.
- Sensitive fields masked.
- Position/department only appear after schema support.

### Payroll
- Create DRAFT.
- Approve.
- Pay.
- Reject payment before approval.
- Block duplicate payroll period if constrained.
- Allocation totals equal 100% per line.
- Paid payroll creates exactly one cashflow.
- Project profitability includes paid payroll allocations.

### Banks
- Create bank account.
- Default-account behavior.
- Mask account number.
- Show linked cashflow.
- Show bank reconciliation state.

### Vendor Bills
- Create DRAFT.
- Approve.
- Partial pay.
- Full pay.
- Overpayment blocked.
- Paid bill creates exactly one cashflow.

### Expenses
- Create.
- Approve.
- Pay.
- Pending expense has no cashflow.
- Paid/settled expense has one cashflow.
- Allocation totals 100%.

## Phase B

### Cashflow
- Source links resolve.
- No duplicate derived cashflows.
- Filters work.

### Reconciliation
- Automatic system integrity matches Payment/Expense sources.
- Bank statement mismatch remains explicit.

### Budgets
- Budget versus actual calculates from authoritative cashflow categories.
- Variance and utilization are correct.

### Periods
- Close period.
- Mutation in closed period rejected.
- Reopen requires permission and reason.

## Phase C

Project Detail:
- Commercial snapshot
- BOQ
- Execution
- Billing readiness
- Invoice links
- Cost links
- Payroll allocation
- Vendor bills
- Documents
- Change Orders
- Profitability

## Phase D

Commercial:
Proposal, Customer PO, Change Orders, Credit Notes.

## Phase E

Management:
Dashboard, Reports, Receivables, AI.

## Current company-wide study case

September 2026:
- 8 employees.
- Payroll gross Rp83m, net Rp78.25m.
- 6 approved + 1 pending expenses.
- Vendor Bills: Rp125m paid + Rp40m approved unpaid.
- BCA default + Mandiri project.
- Bank reconciliation intentional Rp750k difference.
- 8 budget categories.
- Periods 2026-08 and 2026-09 open.

These figures are synthetic UAT data and should be treated as test fixtures, not production facts.

## Release gate

Do not merge a domain to production until its page-specific UAT passes and no unresolved architecture/documentation contradiction exists.
