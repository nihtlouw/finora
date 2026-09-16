# Finora Build Fix v2

Fixes stale Next.js dev type inclusion in tsconfig. Next.js 16 generates route-aware types under .next; including .next/dev/types can cause stale validator errors such as AppRouteHandlerRoutes/ParamMap failures during production builds.

Apply by overwriting tsconfig.json, then run:

```bash
rm -rf .next
npm run build
```

No Prisma migration is required.
