# Finora Phase 3.5A — Quotation / BOQ Foundation

Batch 1 implements the commercial foundation for PT Berjaya Sukses Makmur (BSM): project information, quotation reference, BOQ sections, material/service categorization, brand/type/specification/unit fields, and structured proposal sections/items.

## UAT scope
1. Create proposal with 1 client and project info.
2. Add multiple BOQ sections (A/B/C/D).
3. Add material and service items with brand/type/specification/unit/qty/unit price.
4. Verify subtotal, discount, tax, and total.
5. Edit a DRAFT proposal and confirm sections/items persist.
6. Send/Accept the proposal.
7. Convert ACCEPTED proposal to invoice and confirm technical item fields carry forward.
8. Existing legacy proposals are backfilled into one default section `A — Pekerjaan Utama`.

## Not included in Batch 1
- Customer PO
- Project entity
- Payment milestones / billing milestones
- Shared expense allocation
- Proposal outcome/lost reasons


## Hardening sebelum Batch 3.5A ditutup
- API menegakkan bahwa hanya OWNER / FINANCE yang dapat mengubah proposal `SENT → ACCEPTED/REJECTED`; SALES tidak dapat bypass aturan UI lewat direct PATCH.
- Saat DRAFT diedit, legacy `ProposalItem` tanpa `sectionId` dibersihkan agar tidak ikut terbawa saat convert ke invoice.
- Dokumentasi seed diselaraskan dengan script yang benar: `npm run seed:bsm-complex-quotation`.
