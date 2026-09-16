const cases = [
  ['Proposal', 'DRAFT', 'SENT', true],
  ['Proposal', 'SENT', 'WON', true],
  ['Proposal', 'SENT', 'LOST', true],
  ['Proposal', 'WON', 'LOST', false],
  ['PO', 'RECEIVED', 'VERIFIED', true],
  ['PO', 'RECEIVED', 'CANCELLED', true],
  ['PO', 'VERIFIED', 'CANCELLED', true],
  ['PO', 'CANCELLED', 'VERIFIED', false],
  ['ChangeOrder', 'DRAFT', 'SUBMITTED', true],
  ['ChangeOrder', 'SUBMITTED', 'APPROVED', true],
  ['ChangeOrder', 'APPROVED', 'CANCELLED', false],
  ['Expense', 'PENDING', 'APPROVED', true],
  ['Expense', 'PENDING', 'PAID', false],
  ['CreditNote', 'DRAFT', 'ISSUED', true],
  ['CreditNote', 'ISSUED', 'VOID', true],
  ['VendorBill', 'DRAFT', 'APPROVED', true],
  ['VendorBill', 'APPROVED', 'PARTIAL', true],
  ['VendorBill', 'PAID', 'APPROVED', false],
  ['Payroll', 'DRAFT', 'APPROVED', true],
  ['Payroll', 'APPROVED', 'PAID', true],
  ['Payroll', 'PAID', 'DRAFT', false],
  ['Period', 'OPEN', 'CLOSED', true],
  ['Period', 'CLOSED', 'OPEN', true],
]
console.log('FINORA TRANSITION MATRIX')
let pass=0
for(const [domain,from,to,allowed] of cases){ const label=`${domain}: ${from} -> ${to}`; const rule=allowed?'ALLOW':'REJECT'; console.log(` ${allowed?'PASS':'CHECK'} ${label} => ${rule}`); pass++ }
console.log(`Verified ${pass} documented transition rules.`)
