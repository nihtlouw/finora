# BSM Complex Quotation Seed — Prisma 7

Prisma 7 with the `prisma-client` generator emits the generated client as TypeScript. The seed therefore runs with `tsx` instead of plain Node.js.

## Setup

```bash
npm install
npm run db:generate
npm run seed:bsm-complex-quotation
```

The complex quotation seed uses the generated client with the same `PrismaPg` adapter family as the application. The project seed (`npm run seed:bsm-project`) reuses the application Prisma singleton in `lib/db/prisma.ts`.
