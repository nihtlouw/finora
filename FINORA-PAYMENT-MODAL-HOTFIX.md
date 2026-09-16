# FINORA Payment Modal Hotfix

Fixes the invoice payment runtime crash caused by a missing `PaymentModal` component in `components/finance-managers.tsx`.

The modal is restored and uses the existing `/api/payments` endpoint. It defaults the payment amount to the invoice outstanding amount and reports server errors safely.

No database schema or migration changes are required.

Validation:
- Confirm `PaymentModal` is defined before `InvoicesManager`.
- ZIP archive validated successfully.

Recommended local verification:
1. Extract over the current Finora repo, preserving `.env`, `.env.local`, and `node_modules`.
2. Run `npm run build`.
3. Run `npm run dev`.
4. Open Invoices and click `Catat pembayaran` on an unpaid/partial invoice.
