# Finora API & Authorization Contract

## Standard patterns

GET /api/<domain>
POST /api/<domain>
GET /api/<domain>/[id]
PATCH /api/<domain>/[id]

Use explicit action endpoints for state transitions:
- /verify
- /approve
- /pay
- /cancel
- /rebaseline
- /remind
- /reconcile

## Authorization

OWNER:
- full workspace administrative and financial control.

FINANCE:
- financial masters and finance transactions according to endpoint policy.

PROJECT:
- project operational data and execution workflows as allowed.

VIEWER:
- read-only access only.

Every API must:
1. resolve current workspace/user context,
2. authorize role,
3. scope by workspace,
4. validate state transition,
5. mutate authoritative source,
6. create linked derived records when domain-owned,
7. write audit log for sensitive mutations.

## Canonical derived-record rules

Payment → one income CashflowTransaction.
Paid Expense → one expense CashflowTransaction.
Paid PayrollRun → one payroll CashflowTransaction.
VendorBillPayment → one expense CashflowTransaction.

No endpoint may silently create duplicate cashflows.

## Error contract

Use clear HTTP semantics:
- 401 unauthenticated
- 403 unauthorized
- 404 not found in active workspace
- 409 invalid state/conflict/business-rule violation
- 400 malformed input
- 500 unexpected server failure

Error messages should explain the business rule, not expose secrets or internal stack traces.

## UI contract

UI consumes domain APIs. It must not infer success from optimistic local state for financial mutations. Refresh from source after mutation.
