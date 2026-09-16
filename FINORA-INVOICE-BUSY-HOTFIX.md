# Finora Invoice Busy State Hotfix

Fixes `ReferenceError: busy is not defined` in `InvoicesManager`.

Cause: invoice lifecycle actions (`Tandai terkirim`, `Catat pengingat`) referenced `busy`/`setBusy`, but the component did not declare that state.

Fix: added `const [busy, setBusy] = useState(false)` to `InvoicesManager`.

No schema or migration changes.
