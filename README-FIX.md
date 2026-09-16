# Finora schema synchronization fix

Synchronizes prisma/schema.prisma with the already-applied database changes for:
- ClientVendor discovery fields: category, offerings
- Phase 3.5D Expense Cost Control: workspaceId, allocationType, description, paymentMethod, receiptUrl, ExpenseAllocation and required relations/indexes

No new migration is included. After overwriting prisma/schema.prisma, run `npm run db:generate` and `npx tsc --noEmit --incremental false`. Do not run `prisma migrate dev` for this patch.
