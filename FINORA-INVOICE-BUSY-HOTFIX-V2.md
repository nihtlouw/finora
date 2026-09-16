# Finora Invoice Busy Hotfix v2

Fixes `ReferenceError: busy is not defined` in `InvoicesManager`.

The invoice lifecycle actions `MARK_SENT` and overdue reminder use `busy`/`setBusy`, but the state was not declared in `InvoicesManager` after the Midtrans integration. This patch adds:

`const [busy, setBusy] = useState(false)`

No database schema or migration changes.
