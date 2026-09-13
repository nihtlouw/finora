# Clients styling hotfix

The Clients page was rendering as unstyled HTML because the repository's `globals.css`
did not import Tailwind CSS and the Tailwind v4 PostCSS plugin config was missing.

This update:
- adds `@import "tailwindcss";` to `app/globals.css`
- adds `postcss.config.mjs` with `@tailwindcss/postcss`
- keeps the existing Finora custom CSS
- keeps the `Stat` component hotfix in `components/clients/client-vendor-manager.tsx`

## Apply

Extract this ZIP into the root of `D:\Finora\finora-platform` and overwrite existing files.

Then run:

```bash
npm install
npm run dev
```

No database migration is required for this styling-only fix.
