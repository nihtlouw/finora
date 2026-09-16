#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import process from "node:process";
import { Client } from "pg";
import dotenv from "dotenv";

const cwd = process.cwd();

// Prefer the local development environment. We intentionally do not fall back
// to production-style environment files silently.
const envLocal = path.join(cwd, ".env.local");
const envDefault = path.join(cwd, ".env");
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
if (!process.env.DATABASE_URL && fs.existsSync(envDefault)) dotenv.config({ path: envDefault });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL tidak ditemukan. Pastikan .env.local sudah tersedia.");
  process.exit(1);
}

const dbUrl = new URL(connectionString);
const host = dbUrl.hostname || "unknown-host";
const database = dbUrl.pathname.replace(/^\//, "") || "unknown-db";

const tables = [
  '"CashflowTransaction"',
  '"PaymentGatewayTransaction"',
  '"Payment"',
  '"Expense"',
  '"InvoiceItem"',
  '"Invoice"',
  '"ProposalItem"',
  '"Proposal"',
  '"ClientVendor"',
  '"Budget"',
  '"AuditLog"',
];

const preservedTables = ['User', 'Workspace', 'WorkspaceMember'];

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 60_000,
});

function printHeader() {
  console.log("\\n=== FINORA UAT DATABASE RESET ===");
  console.log(`Database : ${database}`);
  console.log(`Host     : ${host}`);
  console.log("\\nAKAN DIHAPUS:");
  console.log("  - Client/Vendor");
  console.log("  - Proposal & Proposal Items");
  console.log("  - Invoice & Invoice Items");
  console.log("  - Payment");
  console.log("  - Payment Gateway Transactions");
  console.log("  - Expense");
  console.log("  - Cashflow");
  console.log("  - Budget");
  console.log("  - Audit Log");
  console.log("\\nTETAP DIPERTAHANKAN:");
  console.log("  - User");
  console.log("  - Workspace");
  console.log("  - WorkspaceMember (Owner / Sales / Finance / role yang sudah ada)");
}

async function countTable(table) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return result.rows[0].count;
}

async function main() {
  printHeader();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = (await rl.question("\\nKetik RESET-UAT untuk melanjutkan: ")).trim();
  await rl.close();

  if (confirmation !== "RESET-UAT") {
    console.log("Dibatalkan. Tidak ada data yang diubah.");
    return;
  }

  await client.connect();

  try {
    const before = {};
    for (const table of tables) before[table] = await countTable(table);

    const preserved = {};
    for (const table of preservedTables) preserved[table] = await countTable(`"${table}"`);

    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
    await client.query("COMMIT");

    const after = {};
    for (const table of tables) after[table] = await countTable(table);

    const preservedAfter = {};
    for (const table of preservedTables) preservedAfter[table] = await countTable(`"${table}"`);

    console.log("\\n=== RESET SELESAI ===");
    console.log("Business data sekarang kosong:");
    for (const table of tables) {
      console.log(`  ${table.replaceAll('"', '')}: ${before[table]} -> ${after[table]}`);
    }

    console.log("\\nData yang dipertahankan:");
    for (const table of preservedTables) {
      console.log(`  ${table}: ${preserved[table]} -> ${preservedAfter[table]}`);
    }

    console.log("\\nFinora siap untuk UAT dari awal.");
    console.log("Schema/migration/database structure tidak di-reset.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and surface the original failure.
    }
    console.error("\\nRESET GAGAL. Tidak ada perubahan yang seharusnya dipertahankan dari transaksi yang gagal.");
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
