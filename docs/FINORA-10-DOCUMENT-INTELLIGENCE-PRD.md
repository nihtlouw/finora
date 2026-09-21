# Finora Document Intelligence / Smart Scan PRD

## Objective

Finora must accept customer and operational documents that arrive in heterogeneous formats. Customer letterheads, numbering conventions, PO codes, quotation references, invoice formats, BOQ layouts, BAP/BAST templates, and supporting documentation must not be forced into a single customer-facing format.

Smart Scan is therefore an intake and verification layer, not merely OCR.

Canonical flow:

Upload -> Detect document type -> Extract fields -> Normalize -> Confidence review -> User verification -> Create/update business entity -> Preserve source document -> Audit

## Current document foundation

Finora currently stores project documents as ProjectDocument records containing:
- projectId / workspaceId
- title
- category
- documentKey
- version
- documentDate
- tags
- source
- isCurrent
- fileName
- mimeType
- sizeBytes
- binary data
- uploader
- audit-relevant timestamps

The current model is suitable for document storage, versioning, project association, and current-version semantics. It does not yet represent OCR extraction results, confidence, verification state, or source-to-entity mappings. Those should be introduced as a separate document-intelligence layer rather than overloading the current document metadata.

## Supported document classes

### Commercial intake
- Customer RFQ / quotation request
- Customer PO
- Customer contract / SPK
- Customer scope / award letter
- Quotation / proposal

### Project execution
- BOQ
- FAT
- Delivery Note
- Progress report
- BAP
- BAST
- Testing / commissioning report
- SLO / NIDI
- Closeout documentation
- Project photos / evidence

### Financial source documents
- Invoice
- Receipt / struk
- Vendor bill
- Tax document
- Bank statement

### People / administration
- Employee supporting documents
- Other workspace administration records

## Smart Scan states

A scanned document must never directly create financial truth without user verification.

Recommended states:

UPLOADED
-> PROCESSING
-> EXTRACTED
-> NEEDS_REVIEW
-> VERIFIED
-> COMMITTED
-> SUPERSEDED / REJECTED

Failed extraction must remain observable and retryable.

## Extraction contract

Every extraction result should retain:

1. source document reference
2. detected document type
3. extractor/provider metadata
4. extraction timestamp
5. raw extracted text or structured payload where policy permits
6. normalized fields
7. field-level confidence
8. validation issues
9. human verification status
10. committed entity references

Example:

{
  documentType: "CUSTOMER_PO",
  customer: {
    externalName: "PT Customer ABC",
    confidence: 0.98
  },
  externalIdentifiers: {
    poNumber: "ABC/PO/026/IX/2026",
    customerProjectCode: "EL-2026-091"
  },
  commercial: {
    subtotal: 3338506000,
    overhead: 66770120,
    rounding: 3880,
    grandTotal: 3405280000
  },
  paymentTerms: [
    { stage: "DP", percentage: 50, dueDays: 7 },
    { stage: "PROGRESS", percentage: 45 },
    { stage: "RETENTION", percentage: 5, retentionMonths: 2 }
  ]
}

Numbers remain untrusted until normalized and verified.

## External vs internal identity

Customer identifiers must be preserved as external business identifiers.

Example:

Customer PO number:
ABC/PO/026/IX/2026

Customer project code:
EL-2026-091

Finora project code:
FIN-PROJ-0018

Never overwrite the customer identifier with a Finora-generated identifier. Store both and make the relationship searchable.

## Customer PO Smart Scan workflow

Upload PO
-> detect CUSTOMER_PO
-> identify customer
-> extract PO number and dates
-> extract commercial values
-> extract payment terms
-> extract BOQ / line items where present
-> compare against selected / matched proposal
-> calculate variance
-> show field-level review
-> user confirms
-> commit CustomerPO
-> optionally create Project from verified PO

Project creation remains a separate controlled action:

Proposal WON + Customer PO VERIFIED -> Project

## BOQ Smart Scan workflow

Upload BOQ
-> detect BOQ
-> extract section/item hierarchy
-> normalize:
Section -> Item -> Brand -> Type -> Specification -> Qty -> Unit -> Unit Price
-> show validation issues
-> user verifies
-> commit ProjectBOQSection / ProjectBOQItem

The parser must preserve customer item codes and descriptions as source data where available.

## Invoice Smart Scan workflow

Upload invoice
-> detect INVOICE
-> extract invoice number/date
-> identify customer/vendor
-> extract subtotal/tax/total
-> match to Project / Billing Milestone where possible
-> show candidate matches
-> user verifies
-> commit invoice or source document only

Invoice creation must not bypass existing billing-milestone controls for project invoices.

## BAP / BAST Smart Scan workflow

BAP / BAST is evidence, not merely a PDF attachment.

Extraction should identify:
- project
- work package / milestone
- document number
- document date
- parties
- progress / completion statement
- referenced PO / contract
- referenced BOQ or milestone
- signatures / approval indicators where technically possible

After verification the document should be attachable to the relevant execution or completion milestone and be discoverable from Project Detail.

## Receipt Smart Scan workflow

Receipt
-> extract date
-> merchant / payee
-> amount
-> payment method if available
-> category suggestion
-> project suggestion
-> duplicate warning
-> user confirms
-> create Expense draft

The scanned receipt must not automatically become an APPROVED or PAID expense.

## Matching / reconciliation behavior

The system may suggest matches but must distinguish:
- exact / high-confidence match
- possible match
- no safe match

Examples:
- Customer PO -> existing WON proposal
- Invoice -> billing milestone
- BAP -> execution milestone
- Receipt -> expense
- Bank statement -> cashflow transaction

Suggestions must show why the match was proposed.

## Human verification UI

Review screen should have two synchronized areas:

LEFT:
- original document preview

RIGHT:
- extracted structured fields
- confidence indicators
- validation issues
- proposed relationships
- editable values

Actions:
- Confirm
- Edit and confirm
- Reject
- Retry extraction

Never hide the original evidence.

## Audit requirements

For every committed extraction retain:
- source document
- previous value where applicable
- extracted value
- normalized value
- user who verified
- verification timestamp
- resulting entity ID
- extractor/provider version

This allows Finora to explain where a value came from.

## Security / reliability boundaries

Smart Scan must not:
- silently change an existing verified PO
- silently change invoice totals
- silently mark payments as received
- bypass accounting-period controls
- bypass authorization
- commit low-confidence financial values without human review

Document storage and intelligence processing are separate concerns. A document can exist even when extraction fails.

## Implementation sequence

Phase DI-1:
- document type taxonomy
- document intake UI
- review state machine
- extraction-result contract
- external identifier strategy

Phase DI-2:
- provider adapter interface
- text extraction
- PDF/image preprocessing
- field extraction

Phase DI-3:
- customer PO + invoice extraction
- verification UI
- candidate matching

Phase DI-4:
- BOQ + BAP/BAST + execution evidence
- project timeline/document linkage

Phase DI-5:
- receipt + bank statement intelligence
- duplicate and reconciliation suggestions

Phase DI-6:
- learning/normalization rules per customer format
- extraction quality monitoring
- confidence analytics

## UX principle

Smart Scan must make Finora easier, not more complicated.

The user experience should feel like:

Upload document -> Finora understands it -> user checks -> Finora connects it to the business workflow.

It must never feel like:

Upload document -> user retypes the whole document manually.

