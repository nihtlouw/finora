# Canonical Workflow + Navigation IA Update

This patch establishes the first implementation layer of the Finora canonical workflow and information architecture.

## Navigation hierarchy

- Workspace: Dashboard, Klien & Vendor
- Commercial: Proposal, PO Customer, Project
- Billing & Collection: Invoice, Piutang, Pembayaran
- Cost & Treasury: Biaya, Cash Flow, Anggaran
- Control & Insights: Laporan, Rekonsiliasi
- System: Pengaturan

Existing routes remain intact; this is a navigation IA consolidation, not a destructive route removal.

## Commercial workflow

`Client → Proposal → WON/LOST → Customer PO → VERIFIED → Project`

Legacy `ACCEPTED/REJECTED` proposal outcomes are migrated to `WON/LOST`.

Direct Proposal → Invoice conversion is rejected. Project invoices must originate from a `READY` Billing Milestone.

## Business semantics

- Billing milestone = planned billing schedule.
- Payment milestone = planned collection schedule.
- Invoice = actual receivable document.
- Payment = actual customer collection.
- Cashflow = actual cash movement.
- Expense allocation = actual project cost basis after approval.
- Profitability = derived from revenue basis and approved project cost.
