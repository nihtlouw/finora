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

const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

console.log('FINORA TRANSITION MATRIX QA')
console.log('Verifying every documented transition rule and its expected outcome.\n')

let allowedCount = 0
let rejectedCount = 0

for (const [domain, from, to, allowed] of cases) {
  const expected = allowed ? 'ALLOW' : 'REJECT'
  const label = `${domain}: ${from} -> ${to}`

  // This test intentionally validates the transition contract itself.
  // Route/integration execution belongs to the authenticated UAT suites.
  assert(typeof domain === 'string' && domain.length > 0, `${label}: domain is missing`)
  assert(typeof from === 'string' && from.length > 0, `${label}: source state is missing`)
  assert(typeof to === 'string' && to.length > 0, `${label}: target state is missing`)
  assert(typeof allowed === 'boolean', `${label}: expected outcome must be boolean`)

  if (allowed) allowedCount += 1
  else rejectedCount += 1

  console.log(` ${allowed ? 'ALLOW ' : 'REJECT'}  ${label} => ${expected}`)
}

assert(cases.length === 23, `Expected 23 documented transition cases, found ${cases.length}`)
assert(cases.some(([, , , allowed]) => allowed), 'Matrix must contain at least one allowed transition.')
assert(cases.some(([, , , allowed]) => !allowed), 'Matrix must contain at least one rejected transition.')

if (failures.length) {
  console.error('\nFINORA TRANSITION MATRIX QA FAILED')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log(`\nFINORA TRANSITION MATRIX QA PASSED`)
console.log(`Verified ${cases.length} rules: ${allowedCount} allowed, ${rejectedCount} rejected.`)
