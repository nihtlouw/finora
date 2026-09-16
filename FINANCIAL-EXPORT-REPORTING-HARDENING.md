# Financial Export & Reporting Hardening

## Scope
This update hardens financial exports so exported values follow the same period and cashflow source-of-truth used by the UI.

## Report package export
`/api/reports/export` is restricted to OWNER and FINANCE and now exports one UTF-8 BOM CSV package containing:
- report metadata and active period
- Profit & Loss
- current vs previous-period comparison
- simple Balance Sheet snapshot
- receivables aging snapshot as of the report end date
- reconciliation summary
- cashflow detail
- payment detail (including payment method)
- expense detail (including approval status)
- outstanding receivables detail

The CSV is intentionally Excel-friendly and numeric money cells are exported as plain decimal values rather than localized currency strings.

## Receivables export
`/api/receivables/export` exports current outstanding receivables and aging buckets. Access is restricted to OWNER and FINANCE.

## Hardening rules
- Export scope is workspace-scoped.
- Active report period is preserved in the exported file.
- Payment/expense details use the same date range as the report.
- Receivables snapshot uses payment dates up to the report end and excludes fully paid invoices.
- Cashflow detail includes source classification: Payment, Expense, or Manual.
- Export responses use `Cache-Control: no-store`.
- CSV output includes UTF-8 BOM for spreadsheet compatibility.
