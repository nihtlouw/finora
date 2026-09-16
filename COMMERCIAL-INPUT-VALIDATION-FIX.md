# Commercial Input Validation Fix

Fixed Proposal and Invoice `Harga satuan` inputs to use `step="1"` instead of `step="1000"`.

Users can now type any positive whole-Rupiah amount directly, including `15000000`, without the browser reporting a step/multiple validation error.

Backend financial validation remains authoritative; this change only removes an overly restrictive browser-side constraint.
