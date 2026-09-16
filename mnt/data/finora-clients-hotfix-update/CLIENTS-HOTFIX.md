# Finora Clients & Vendors Hotfix v1

Fixes the runtime `ReferenceError: Stat is not defined` in `components/clients/client-vendor-manager.tsx`.

The `Stat` component is now included as a local UI component for the active client/vendor/archive summary cards.

## Apply
Extract this ZIP into the root of the existing Finora repository and overwrite matching files.

Then run:

```bash
npm install
npm run dev
```

No database migration is required for this hotfix.
