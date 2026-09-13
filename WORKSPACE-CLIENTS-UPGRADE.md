# Finora Workspace & Clients/Vendors v1

## Why this milestone exists

Before Proposal and Invoice become transactional modules, Finora needs a tenant boundary so business data cannot be mixed across companies. This update establishes a workspace per authenticated user and scopes the Client/Vendor master data to that workspace.

## What changed

- Added `Workspace` and `WorkspaceMember` models.
- Added `workspaceId` plus business master fields to `ClientVendor`.
- Current Clerk user now resolves to a Finora user + workspace + membership context.
- Added server-side authorization for Client/Vendor writes.
- Added real Client/Vendor CRUD endpoints backed by Prisma/Neon.
- Delete is safe: records with proposal/invoice/expense history are archived instead of physically deleted.
- Added a dedicated `/clients` UI with search, type filters, active/archive filter, create/edit form, and role-aware actions.
- The legacy dashboard navigation now opens the real Clients & Vendors module.

## Migration

Run against the development Neon branch only:

```bash
npm run db:migrate -- --name workspace_clients
```

Do not promote this migration to production until the development data shape has been checked.
