# Phase 3.5A — Proposal Detail + Engineering BOQ PDF v2

Changes in this batch:
- Proposal list now has a Detail action.
- Added `/proposals/[id]` detail page with project summary, commercial summary, BOQ sections, category badges, and expandable technical specifications.
- Proposal PDF/print upgraded to engineering-style BOQ document with section grouping, material/service/other summary, brand/type, quantity/unit, unit price, total, specification and notes.
- Detailed proposal PDF prints A4 landscape for BOQ readability.
- Existing invoice/payment/report logic is unchanged.

UAT targets:
1. Open Proposal list and click Detail.
2. Verify 5 seeded sections and 65 items render.
3. Expand item specifications and verify Brand/Type/Specification/Notes.
4. Open PDF/Cetak and confirm section grouping and technical columns.
5. Print using A4 landscape and verify page breaks/table continuity.
