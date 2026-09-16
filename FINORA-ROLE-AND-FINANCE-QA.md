# Finora Role & Finance QA Update

## Owner bootstrap
The development bootstrap owner is configured via `FINORA_OWNER_EMAILS`, currently intended for `aiengineer2027life@gmail.com`. This variable is only used when the user has no existing `WorkspaceMember`. After membership exists, `WorkspaceMember.role` is the source of truth. Changing the user's Clerk email does not demote an existing Owner.

## Sales account
`mikiya0735@gmail.com` should be assigned `SALES` from **Settings → Anggota & Role** after that user has logged in at least once.

## Finance hardening
- Cashflow manual edit uses `/api/cashflow/[id]`.
- Automatic payment/expense cashflows are read-only from Cashflow UI.
- Budget actual is filtered by both category and budget period (`YYYY` or `YYYY-MM`).
- Expense create/update/delete/approve is restricted to OWNER/FINANCE; approved expense is locked.
- Reports and CSV export use Cashflow as the financial source of truth.
- Owner can add existing Finora users to a workspace, change member roles, remove members, and transfer ownership.

## Important membership note
To add a user via the Members UI, the target user must have logged into Finora at least once so a `User` row exists. The current implementation intentionally blocks moving an existing user who already belongs to another workspace, to avoid accidental cross-workspace migration.
