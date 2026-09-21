# Finora UI Page Specification

## Shared shell

All pages use the common Finora shell and design language: neutral sage/gray canvas, crisp surfaces, restrained borders, large readable headings, compact enterprise data tables, fixed desktop navigation and responsive mobile drawer.

## Required page anatomy

A business page normally contains:
1. Page header with purpose.
2. KPI strip where useful.
3. Filter/search controls.
4. Primary data region.
5. Detail/drawer or dedicated detail page.
6. Primary actions.
7. Empty/loading/error states.
8. Audit/status context where relevant.

## Table rule

Do not use placeholder columns such as generic Status, Value, Date when the domain has known business fields.

Every visible column must map to:
- a real persisted field,
- a clearly labelled derived field,
- or an explicit relation.

## Project page

Enterprise portfolio search must support free-text search across project code/name, client, location, customer PO number, proposal number and quotation reference. The primary project table displays customer PO number as a first-class business column when available. Advanced filters include status, client and customer PO number; subsequent releases may extend this with period and financial-state filters without changing the underlying project workflow.

## Employee page

Header: Employees + active headcount + payroll-period context.
Filters: active status, department, search.
Table: employee no, name, position, department, employment status, base salary, latest payroll status, bank masked.
Row action: open detail.
Detail: profile, employment, salary/tax/bank, payroll history, project allocations, audit.

## Payroll page
Access to payroll is restricted to OWNER/FINANCE because salary and deduction data is sensitive. The create action requires an OPEN accounting period and starts the run as DRAFT.


Header: selected period + headcount + gross + deductions + net.
Filters: period, status.
Table: run, period, headcount, gross, deductions, net, status, pay date.
Detail drawer/page:
- summary
- payroll lines
- deductions
- project allocations
- workflow actions
- cashflow reference
Never hide line items behind only a summary row.

## Banks

List: account name, bank, masked account, opening balance, book balance, statement balance, unreconciled, status.
Detail: transaction ledger and reconciliation.

## Vendor Bills

List: bill no, vendor, project, invoice date, due date, total, paid, outstanding, status.
Detail: bill + approval + payment history + cashflow.

## Expense

List: date, payee/vendor, category, project, amount, approval, settlement, receipt.
Detail: items, allocations, receipt, approval audit, payment and cashflow.

## Interaction rules

- Modals are for focused create/edit tasks.
- Details with multiple related sections deserve drawers or dedicated pages.
- Financial actions use confirmation with source/outstanding/status context.
- Disabled actions must explain why.
- Avoid movement-heavy animation.
- No decorative data that is not backed by the domain.

## Accessibility / clarity

- currency is consistently IDR formatted.
- dates use Indonesian locale.
- sensitive account/tax identifiers are masked.
- statuses use both label and visual treatment.
