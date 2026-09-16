# Finora Phase 2 — Commercial Proposal & Invoice

## Included
- Proposal and invoice subtotal, discount %, discount amount, tax %, tax amount, final total.
- Terms & Conditions stored on proposal and invoice.
- Proposal → Invoice conversion copies commercial fields.
- Validation uses integer cents for money and basis points for percentages.
- Existing records are migrated with subtotal=old total and discount/tax=0.
- Print-friendly proposal and invoice document routes with “Cetak / Simpan PDF”.
- Client/vendor detail UI refreshed with profile hero, KPI cards, timeline, and clearer invoice/expense history.

## Migration
Run on the intended Neon development branch:

```bash
npm run db:migrate -- --name commercial_documents
npm run db:generate
```

Then build:

```bash
npm run build
```

## UAT
1. Create a proposal with subtotal Rp15.000.000, discount 10%, tax 11%.
2. Verify discount = Rp1.500.000, taxable base = Rp13.500.000, tax = Rp1.485.000, total = Rp14.985.000.
3. Add terms & conditions and save.
4. Open `PDF / Cetak` and use the browser print dialog to Save as PDF.
5. Accept the proposal and convert it to invoice.
6. Verify the invoice carries the same discount, tax, terms, and total.
7. Record a partial payment and verify outstanding uses the final invoice total.
8. Open client detail and verify the updated financial summary and transaction history.
