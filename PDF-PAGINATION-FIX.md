# Finora PDF Pagination Fix v1

## Problem
Invoice/proposal print preview could spill a mostly-empty second A4 page.

## Fix
- A4 portrait print page with explicit 10mm margins.
- Remove full-viewport/min-height behavior during print.
- Compact document spacing/font sizes only in print mode.
- Keep invoice sections, tables, totals, terms, and footer together where possible.
- Remove screen-only background/shadows/padding in print mode.

## Expected
Typical invoices with short item lists fit on one A4 page. Long documents may still paginate naturally when content genuinely exceeds one page.
