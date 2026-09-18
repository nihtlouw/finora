# Phase 3.5F — UAT Transition Cases

## RSPAD master case

Source commercial snapshot:
- Net commercial subtotal: Rp3.338.506.000
- Overhead: Rp66.770.120
- Unrounded total: Rp3.405.276.120
- Rounding: Rp3.880
- Rounded total: Rp3.405.280.000
- PPN: 11%, excluded
- Payment: 50% DP / 45% FAT + pre-delivery / 5% retention 2 months

### Case F-01 — Project creation snapshot

Expected:
- Project created only from VERIFIED PO.
- Project BOQ sections/items are copied once.
- Execution lifecycle is created.
- Contract version 1 is created.

### Case F-02 — Quotation mutation isolation

1. Create project from WON proposal/VERIFIED PO.
2. Change quotation draft/revision data.
3. GET Project BOQ.

Expected: Project BOQ planned quantities/prices remain unchanged.

### Case F-03 — Billing gate rejection

1. Billing 45% has conditions FAT + FAT document.
2. FAT remains PLANNED.
3. Attempt `PATCH billing READY`.

Expected: HTTP 409 and missing conditions are returned.

### Case F-04 — Billing gate pass

1. Set FAT execution milestone to COMPLETED.
2. Upload current project document category FAT.
3. Attempt `PATCH billing READY`.

Expected: READY succeeds.

### Case F-05 — API bypass rejection

Call invoice endpoint directly while billing is PLANNED or while evidence is missing.

Expected: HTTP 409. UI is not the security boundary.

### Case F-06 — Retention gate

1. BAP/BAST execution is not COMPLETED or evidence missing.
2. Attempt retention billing READY.

Expected: HTTP 409.

3. Complete BAP/BAST and upload BAP_BAST evidence.
4. Attempt READY again.

Expected: succeeds.

### Case F-07 — Change order does not silently rebaseline

1. Create and approve Change Order +Rp100.000.000.
2. Read Billing/Payment Milestone amounts.

Expected:
- Contract version increments.
- Project contract value changes.
- Existing billing/payment schedule amounts do NOT change automatically.

### Case F-08 — Explicit rebaseline

1. Call `/api/change-orders/:id/rebaseline`.
2. Read billing/payment schedule.

Expected:
- Only eligible planned/ready billing and planned/due payment amounts are recalculated.
- Rebaseline snapshot records old/new amounts.
- Second application is rejected as duplicate.

### Case F-09 — Document revision

1. Upload `FAT_REPORT`.
2. Upload another file using the same document key.

Expected:
- First row becomes `isCurrent=false`.
- Second row becomes version 2 and `isCurrent=true`.

### Case F-10 — Tax/profit separation

For the Cable Power SS3 PO source:
- Subtotal Rp28.377.500
- PPN Rp3.121.525
- Grand Total Rp31.500.000
- Document states price includes PPN.

Expected project profitability must use net revenue basis Rp28.377.500 rather than tax as project profit.
