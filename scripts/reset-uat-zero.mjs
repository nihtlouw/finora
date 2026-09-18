#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import process from "node:process";
import { Client } from "pg";
import dotenv from "dotenv";

const cwd = process.cwd();
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

// Keep only authentication / tenancy foundations so UAT starts before any
// client, proposal, commercial, finance, or project transaction exists.
const preservedTables = ["User", "Workspace", "WorkspaceMember"];
const businessTables = [
  "AuditLog",
  "ClientVendor",
  "Proposal",
  "ProposalSection",
  "ProposalItem",
  "CustomerPO",
  "Project",
  "BillingMilestone",
  "PaymentMilestone",
  "Invoice",
  "InvoiceItem",
  "Payment",
  "PaymentGatewayTransaction",
  "Expense",
  "ExpenseAllocation",
  "CashflowTransaction",
  "Budget",
  "ContractChangeOrder",
  "BillingRebaseline",
  "ProjectDocument",
  "ProjectBOQItem",
  "ProjectBOQSection",
  "BillingMilestoneCondition",
  "ProjectExecutionMilestone",
  "ProjectContractVersion",
  "ProposalRevision",
];

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 60_000,
});

const q = (name) => `"${name}"`;

async function countTable(name) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${q(name)}`);
  return result.rows[0].count;
}

function printHeader() {
  console.log("\n=== FINORA UAT RESET — ZERO BUSINESS DATA ===");
  console.log(`Database : ${database}`);
  console.log(`Host     : ${host}`);
  console.log("\nAKAN DIHAPUS SEMUA:");
  for (const table of businessTables) console.log(`  - ${table}`);
  console.log("\nTETAP DIPERTAHANKAN:");
  for (const table of preservedTables) console.log(`  - ${table}`);
  console.log("\nHasil akhir:");
  console.log("  User/Workspace tetap ada supaya Anda tetap bisa login.");
  console.log("  Tidak ada Client/Vendor, Proposal, PO, Project, Billing, Invoice,");
  console.log("  Payment, Expense, Cashflow, Budget, atau AuditLog transaksi tersisa.");
  console.log("  Schema dan migration TIDAK di-reset.");
}

async function main() {
  printHeader();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = (await rl.question("\nKetik RESET-UAT-ZERO untuk melanjutkan: ")).trim();
  await rl.close();

  if (confirmation !== "RESET-UAT-ZERO") {
    console.log("Dibatalkan. Tidak ada data yang diubah.");
    return;
  }

  await client.connect();

  try {
    const before = {};
    for (const table of businessTables) before[table] = await countTable(table);

    const preservedBefore = {};
    for (const table of preservedTables) preservedBefore[table] = await countTable(table);

    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${businessTables.map(q).join(", ")} RESTART IDENTITY CASCADE`);
    await client.query("COMMIT");

    const after = {};
    for (const table of businessTables) after[table] = await countTable(table);

    const preservedAfter = {};
    for (const table of preservedTables) preservedAfter[table] = await countTable(table);

    const remainingBusiness = businessTables.filter((table) => after[table] !== 0);
    if (remainingBusiness.length) {
      throw new Error(`Business tables masih berisi data: ${remainingBusiness.join(", ")}`);
    }

    for (const table of preservedTables) {
      if (preservedAfter[table] !== preservedBefore[table]) {
        throw new Error(`Data foundational table berubah: ${table}`);
      }
    }

    console.log("\n=== RESET BERHASIL ===");
    console.log("Business data:");
    for (const table of businessTables) {
      console.log(`  ${table}: ${before[table]} -> ${after[table]}`);
    }

    console.log("\nFoundational data:");
    for (const table of preservedTables) {
      console.log(`  ${table}: ${preservedBefore[table]} -> ${preservedAfter[table]}`);
    }

    console.log("\nFINORA sekarang berada pada UAT ZERO STATE.");
    console.log("Mulai simulasi dari master data -> Proposal -> WON -> PO -> Project -> dst.");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("\nRESET GAGAL.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(async (error) => {
  try { await client.end(); } catch {}
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
