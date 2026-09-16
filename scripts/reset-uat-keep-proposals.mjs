#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { Client } from 'pg';
import dotenv from 'dotenv';

const cwd = process.cwd();
const envLocal = path.join(cwd, '.env.local');
const envDefault = path.join(cwd, '.env');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
if (!process.env.DATABASE_URL && fs.existsSync(envDefault)) dotenv.config({ path: envDefault });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL tidak ditemukan. Pastikan .env.local tersedia.');
  process.exit(1);
}

const url = new URL(connectionString);
const host = url.hostname || 'unknown-host';
const database = url.pathname.replace(/^\//, '') || 'unknown-db';

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 60_000,
});

const businessTables = [
  'CashflowTransaction',
  'PaymentGatewayTransaction',
  'Payment',
  'InvoiceItem',
  'Invoice',
  'ExpenseAllocation',
  'Expense',
  'PaymentMilestone',
  'BillingMilestone',
  'Project',
  'CustomerPO',
  'Budget',
  'AuditLog',
];

function q(name) {
  return `"${name}"`;
}

async function count(table) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${q(table)}`);
  return result.rows[0].count;
}

async function proposalIds() {
  const result = await client.query(`SELECT id FROM ${q('Proposal')} ORDER BY id`);
  return result.rows.map((row) => row.id);
}

async function main() {
  console.log('\n=== FINORA UAT RESET — KEEP PROPOSALS ===');
  console.log(`Database : ${database}`);
  console.log(`Host     : ${host}`);
  console.log('\nDihapus:');
  console.log('  Customer PO, Project, Billing Milestone, Payment Milestone');
  console.log('  Invoice, Invoice Item, Payment, Payment Gateway Transaction');
  console.log('  Expense, Expense Allocation, Cashflow, Budget, Audit Log');
  console.log('  Client/Vendor yang TIDAK dipakai oleh Proposal');
  console.log('\nDipertahankan:');
  console.log('  Proposal');
  console.log('  Proposal Section');
  console.log('  Proposal Item');
  console.log('  Client/Vendor yang direferensikan Proposal');
  console.log('  User, Workspace, WorkspaceMember');
  console.log('\nTidak ada schema/migration yang diubah.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = (await rl.question('\nKetik RESET-UAT-KEEP-PROPOSALS untuk melanjutkan: ')).trim();
  await rl.close();

  if (confirmation !== 'RESET-UAT-KEEP-PROPOSALS') {
    console.log('Dibatalkan. Tidak ada data yang diubah.');
    return;
  }

  await client.connect();

  try {
    const before = {};
    for (const table of businessTables) before[table] = await count(table);
    const proposalsBefore = await proposalIds();
    const proposalCountBefore = proposalsBefore.length;
    const proposalClientsBefore = await client.query(`
      SELECT COUNT(DISTINCT p."clientId")::int AS count
      FROM "Proposal" p
    `);

    await client.query('BEGIN');

    // Delete from children to parents so Proposal is never cascaded away.
    await client.query(`DELETE FROM ${q('CashflowTransaction')}`);
    await client.query(`DELETE FROM ${q('PaymentGatewayTransaction')}`);
    await client.query(`DELETE FROM ${q('Payment')}`);
    await client.query(`DELETE FROM ${q('InvoiceItem')}`);
    await client.query(`DELETE FROM ${q('Invoice')}`);
    await client.query(`DELETE FROM ${q('ExpenseAllocation')}`);
    await client.query(`DELETE FROM ${q('Expense')}`);
    await client.query(`DELETE FROM ${q('PaymentMilestone')}`);
    await client.query(`DELETE FROM ${q('BillingMilestone')}`);
    await client.query(`DELETE FROM ${q('Project')}`);
    await client.query(`DELETE FROM ${q('CustomerPO')}`);
    await client.query(`DELETE FROM ${q('Budget')}`);
    await client.query(`DELETE FROM ${q('AuditLog')}`);

    // Keep only ClientVendor records still needed by preserved proposals.
    await client.query(`
      DELETE FROM "ClientVendor" cv
      WHERE NOT EXISTS (
        SELECT 1
        FROM "Proposal" p
        WHERE p."clientId" = cv."id"
      )
    `);

    await client.query('COMMIT');

    const after = {};
    for (const table of businessTables) after[table] = await count(table);
    const proposalsAfter = await proposalIds();
    const proposalClientsAfter = await client.query(`
      SELECT COUNT(DISTINCT p."clientId")::int AS count
      FROM "Proposal" p
    `);
    const clientVendorAfter = await count('ClientVendor');

    const proposalsPreserved =
      proposalsBefore.length === proposalsAfter.length &&
      proposalsBefore.every((id, index) => id === proposalsAfter[index]);

    console.log('\n=== RESET SELESAI ===');
    for (const table of businessTables) {
      console.log(`  ${table}: ${before[table]} -> ${after[table]}`);
    }

    console.log(`\nProposal: ${proposalCountBefore} -> ${proposalsAfter.length}`);
    console.log(`Proposal client references: ${proposalClientsBefore.rows[0].count} -> ${proposalClientsAfter.rows[0].count}`);
    console.log(`Proposal IDs preserved: ${proposalsPreserved ? 'YES' : 'NO'}`);
    console.log(`Client/Vendor retained for proposals: ${clientVendorAfter}`);

    if (!proposalsPreserved) {
      throw new Error('Safety check gagal: daftar Proposal berubah.');
    }

    console.log('\nDatabase siap untuk simulasi project dari Proposal yang sudah ada.');
    console.log('Workflow UAT yang disarankan: Proposal -> Customer PO -> Project -> Billing -> Invoice -> Payment -> Expense -> Profitability.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures; surface the original error.
    }
    console.error('\nRESET GAGAL. Transaksi di-rollback bila masih terbuka.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(async (error) => {
  try {
    await client.end();
  } catch {
    // Ignore cleanup errors.
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
