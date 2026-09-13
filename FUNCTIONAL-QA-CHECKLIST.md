# Finora Functional QA Checklist

## Auth
- [ ] Sign-up works
- [ ] Sign-in works
- [ ] Sign-out works
- [ ] Protected routes redirect anonymous users
- [ ] Role is server-checked

## Clients & Vendors
- [ ] Search
- [ ] Filter type
- [ ] Show archive
- [ ] Create client
- [ ] Create vendor
- [ ] Edit
- [ ] Archive/delete rules
- [ ] Data survives browser refresh
- [ ] Data is visible in Prisma Studio

## Proposal
- [ ] Create proposal
- [ ] Calculate item total
- [ ] Convert accepted proposal to invoice
- [ ] Prevent duplicate conversion

## Invoice / Payment
- [ ] Create invoice
- [ ] Record payment
- [ ] Partial payment updates status
- [ ] Full payment updates PAID
- [ ] Payment creates cashflow transaction

## Expense
- [ ] Create expense
- [ ] Threshold routes to PENDING
- [ ] Owner/Finance can approve
- [ ] Approval creates cashflow transaction

## Budget
- [ ] Create budget
- [ ] Budget belongs to workspace

## Reports
- [ ] Summary reads live data
- [ ] CSV export downloads successfully

## UX
- [ ] Loading state
- [ ] Error state
- [ ] Empty state
- [ ] Mobile layout
- [ ] Keyboard/focus behavior
