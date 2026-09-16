# Finora UAT Database Reset

Script ini mengosongkan **business data** untuk memulai UAT dari awal tanpa menghapus identity/workspace setup.

## Dipertahankan

- `User`
- `Workspace`
- `WorkspaceMember`

## Dihapus

- `ClientVendor`
- `Proposal`
- `ProposalItem`
- `Invoice`
- `InvoiceItem`
- `Payment`
- `PaymentGatewayTransaction`
- `Expense`
- `CashflowTransaction`
- `Budget`
- `AuditLog`

## Menjalankan

Pastikan `.env.local` menunjuk ke **database development/UAT**, lalu:

```bash
npm run db:reset-uat
```

Script akan menampilkan host/database dan daftar tabel yang akan dibersihkan. Untuk konfirmasi, ketik persis:

```text
RESET-UAT
```

Jika teks konfirmasi salah, script berhenti tanpa perubahan.

> Script ini tidak menjalankan migration dan tidak menghapus schema/database. Jangan menjalankannya pada database production.
