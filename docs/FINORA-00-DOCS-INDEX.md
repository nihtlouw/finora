# Finora Architecture Documentation Index

This folder is the controlled reference set for implementing Finora. Code changes should trace back to these documents.

## Source-of-truth order

1. `FINORA-01-BUSINESS-ARCHITECTURE.md` — business domains and boundaries.
2. `FINORA-02-DATA-ARCHITECTURE.md` — ERD, entities, ownership, data rules, schema gaps.
3. `FINORA-03-DOMAIN-PRD.md` — page-by-page functional requirements.
4. `FINORA-04-WORKFLOW-STATE-MATRIX.md` — allowed transitions and guards.
5. `FINORA-05-API-AUTH-CONTRACT.md` — API, roles, permissions, mutation rules.
6. `FINORA-06-UI-PAGE-SPEC.md` — UI structure and interaction contract.
7. `FINORA-07-UAT-MASTER-MATRIX.md` — acceptance tests and definition of done.
8. `FINORA-MASTER-PRD-ERD.md` — condensed master baseline and navigation.

## Change rule

A material schema/workflow/page change must update the relevant architecture document before implementation. A page is not considered complete merely because it renders data.

## Implementation rule

Build one domain end-to-end:
schema → API → page → detail → state transitions → cross-module effects → QA → UI UAT.
