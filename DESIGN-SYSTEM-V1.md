# Finora UI/UX System v1

Design direction implemented from the approved Finora concept:
- Deep teal navigation shell
- White/off-white application canvas
- Emerald semantic success
- Blue client/information states
- Amber warning / vendor states
- Red danger / overdue states
- Rounded 12–16px surfaces
- Subtle borders and soft shadows
- Dense but readable financial tables
- Clear financial number hierarchy
- Desktop-first, responsive mobile behavior

## Implemented routes
- `/sign-in`
- `/sign-up`
- `/dashboard`
- `/clients`
- `/proposals`
- `/invoices`
- `/payments`
- `/cashflow`
- `/expenses`
- `/budgets`
- `/reports`
- `/ai`
- `/settings`

## Core workflows
1. Client/Vendor CRUD → Neon
2. Proposal creation → Neon
3. Proposal conversion → Invoice
4. Invoice payment → Payment + Cashflow
5. Expense creation → approval threshold → Cashflow
6. Budget creation → Neon
7. Reports/export → live DB data

## Explicit pending integrations
- Xendit/Midtrans real gateway
- Vercel Blob upload
- OCR / Document AI
- LLM/AI provider

These are intentionally not represented as completed integrations.
