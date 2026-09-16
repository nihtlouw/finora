# Finora Build Fix v1

Fixes stale Prisma Client during `next build`.

Changes:
- `postinstall`: automatically runs `prisma generate`
- `build`: explicitly runs `prisma generate` before `next build`

This is intentionally a code-generation fix only. No database migration is added.

After extracting over the project:

```bash
npm install
npm run db:generate
npm run build
```
