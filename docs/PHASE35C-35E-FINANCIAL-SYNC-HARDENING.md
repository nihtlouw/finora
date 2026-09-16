# Phase 3.5C / 3.5E — Financial Synchronization Hardening

## Canonical source of truth

- Contract Value: Customer PO / project contract value.
- Billing Schedule: BillingMilestone. Ini adalah rencana penagihan, bukan actual invoice.
- Planned Payment: PaymentMilestone. Ini adalah rencana penerimaan, bukan actual collection.
- Invoiced (actual): SUM invoice yang terkait project, selain CANCELLED/VOID.
- Collected (actual): SUM Payment pada invoice project.
- Outstanding: Invoiced - Collected, minimum 0.
- Project Cost: SUM ExpenseAllocation untuk Expense APPROVED.
- Gross Profit: Revenue Basis - Approved Project Cost.
- Gross Margin: Gross Profit / Revenue Basis.

## Status synchronization

### Billing milestone

- PLANNED → READY: hanya manual oleh Owner/Finance.
- READY → BILLED: otomatis ketika invoice project dibuat dan ditautkan ke billing milestone.
- BILLED → PAID: otomatis ketika invoice terkait sudah lunas.
- CANCELLED: tetap terminal.

### Payment milestone

- PLANNED → DUE: hanya manual oleh Owner/Finance ketika jadwal payment sudah jatuh tempo.
- DUE → PARTIAL: otomatis setelah invoice terkait menerima sebagian pembayaran.
- DUE/PARTIAL → PAID: otomatis ketika invoice terkait lunas.
- DUE/PARTIAL → OVERDUE: otomatis ketika invoice masih punya outstanding dan due date terlewati.
- CANCELLED: tetap terminal.

Actual collection selalu berasal dari Payment, bukan dari percentage PaymentMilestone.

## Canonical workflow

Quotation → Customer PO → Project → Billing Schedule → READY → Invoice → Partial/Full Payment → Cashflow → Project Summary → Profitability.

Expense berjalan paralel dari Project → Expense Approval → Project Cost → Profitability.

## UX rule

Untuk invoice project, pengguna diarahkan membuat invoice dari Billing milestone agar projectId + billingMilestoneId tertaut otomatis. Halaman Invoice dan Pembayaran menampilkan project context sehingga alur dapat ditelusuri dua arah.
