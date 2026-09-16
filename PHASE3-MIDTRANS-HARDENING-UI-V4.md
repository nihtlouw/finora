# Finora Phase 3 — Midtrans Hardening + UI Refinement v4

## Payment gateway hardening

1. `capture` only settles when `fraud_status=accept`.
2. `capture + deny` becomes `FAILED`.
3. `capture` without an accepted fraud status becomes `REVIEW`.
4. `settlement` remains successful without requiring `fraud_status`.
5. Existing pending checkouts are verified against live Midtrans status before reuse.
6. Expired/cancelled/failed pending checkouts are no longer reused.
7. A live-settled previous checkout is reconciled before returning to the UI.
8. Live status errors put the previous checkout into `REVIEW` rather than silently reusing it.

## Payment method fidelity

Gateway settlement maps Midtrans `payment_type` to the persisted `Payment.method`:

- `qris` → `QRIS`
- `bank_transfer` → `BANK_TRANSFER`
- `gopay` → `GOPAY`
- `shopeepay` → `SHOPEEPAY`
- `credit_card` → `CREDIT_CARD`
- `cstore` → `CONVENIENCE_STORE`

Invoice payment history also resolves the friendly display label from the gateway transaction.

## Manual payment separation

Manual `/api/payments` accepts only:

- `BANK_TRANSFER`
- `CASH`

`PAYMENT_GATEWAY` is rejected server-side and removed from the manual-payment UI. Gateway payments must use the Midtrans flow.

## UI visual system v2

- More depth on cards and KPI/stat surfaces.
- Consistent hover/active states for cards, buttons, navigation and table rows.
- Subtle page/modal entrance animation.
- Richer Finora teal/green gradient treatment without changing the brand direction.
- Reduced-motion fallback using `prefers-reduced-motion`.
- Mobile hover effects are restrained/disabled where appropriate.

No new database migration is required for these changes.
