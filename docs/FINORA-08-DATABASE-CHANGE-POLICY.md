# Finora Database Change & Migration Policy

## Purpose

Finora schema changes must be applied in the correct environment without modifying production accidentally.

## Repository reality

The repository currently ignores `prisma/migrations/`. Therefore the committed Prisma schema is the design source, while database application is controlled separately.

## Required workflow for additive UAT schema changes

For local/UAT only:

1. Update `prisma/schema.prisma`.
2. Generate client:
   `npm run db:generate`
3. Inspect drift:
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
4. Apply additive schema changes to the UAT database:
   `npx prisma db push`
5. Re-run seed and QA.
6. Run application build.

## Production rule

Do not run `prisma db push`, `prisma migrate dev`, database reset, or destructive schema operations against the production database from the UAT workflow.

Production schema changes require a separately reviewed migration/release procedure.

## Current Phase A schema change

Employee received:
- position
- department
- employmentType
- joinDate
- endDate

All five additions are nullable/default-safe for existing rows.

## Data fixture rule

After applying the schema change to UAT, rerun:
`npm run seed:uat-company-operations`
then:
`npm run qa:uat-company-operations`

The seed supplies UAT-only employee position/department/employmentType/joinDate data.
