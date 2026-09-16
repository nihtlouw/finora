# Finora Frontend + Backend Review — 2026-09-13

This update reviews the uploaded repository with focus on: pages being usable from the UI, buttons/actions actually reaching backend routes, workspace scoping, and removing dead/prototype controls from the active Next.js UI.

## Fixed in this update

- Cash Flow now has a real UI for manual INCOME/EXPENSE transactions and uses the workspace-scoped `/api/cashflow` backend.
- Cash Flow page no longer relies on relationship fallbacks that could mix sources; it reads the workspace's cashflow rows directly.
- Cash Flow manual transaction form includes type, category, amount, date, and reference.
- Top navigation search is now an actual working menu search with `Ctrl/Cmd + K`.
- Notification button is now functional and derives its count from real overdue invoices and pending expenses.
- The sidebar now includes Cash Flow directly.
- Budget UI now displays planned amount, actual expense, remaining amount, and over-budget state.
- Budget save/load errors are visible to the user.
- Proposal status actions now surface backend errors instead of silently ignoring failed PATCH requests.
- Proposal status transitions are hardened server-side to follow the intended lifecycle.
- Invoice UI now uses outstanding amount for receivables/payment context instead of treating the full invoice total as still due after partial payment.
- Payment modal now shows both total invoice and remaining balance.
- Dashboard receivables now subtract recorded payments and dashboard expense totals only include approved expenses.
- Client/Vendor table now shows the actual `createdAt` date instead of a placeholder string.
- Audit Log now has a protected API and Owner/Finance UI page at `/settings/audit`.
- Existing backend audit logging, workspace scoping, payment/expense cashflow derivation, proposal-to-invoice rules, and overpayment protection are retained.

## Intentionally not implemented here

These remain roadmap/planned items rather than broken buttons:

- AI provider integration and actual AI answers.
- Payment gateway integration/automatic gateway callbacks.
- OCR/document intake.
- Public proposal/invoice links, PDF generation, reminders, and e-signatures.
- Indonesian tax/e-Faktur automation.
- Advanced PDF/Excel reporting and accounting-grade reconciliation/balance-sheet modules.
- Full workspace member/role administration UI.

## Important validation note

The repository was statically reviewed and the ZIP contents were checked. A full `npm run build` could not be completed inside this isolated review container because the available `node_modules` copy is incomplete and package installation timed out. The project should therefore still be built locally after extracting this ZIP with the user's existing `.env` / `.env.local` and Neon/Clerk configuration.

## Follow-up: CRUD hardening v2

- Profile area now has an explicit Keluar button using Clerk SignOutButton; Clerk UserButton remains available for profile/account settings.
- Klien/Vendor add button is always visible; Viewer sees an explicit permission message instead of an apparently missing control.
- Proposal UI/API: create, read, edit while DRAFT, send, accept/reject, convert accepted proposal to invoice, delete DRAFT.
- Invoice UI/API: create, read, edit/delete manual invoices before payment, record partial/full payment. Invoices generated from proposals remain controlled by the proposal lifecycle.
- Expense UI/API: create, read, edit, approve, delete; approved expense cashflow is synchronized when edited and removed when deleted.
- Budget UI/API: create, read, edit, delete with planned vs actual display.
- Manual Cash Flow UI/API: create, read, edit/delete manual rows; system-generated payment/expense cashflow is protected from manual mutation.
- Payments remain append-only from the Invoice page; this is deliberate to preserve financial history.
