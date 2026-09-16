import 'dotenv/config'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const ownerEmails = String(process.env.FINORA_OWNER_EMAILS || '')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean)

const pool = new Pool({
  connectionString: dbUrl,
  max: 4,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: true },
})

const money = (n) => Number(n).toFixed(2)
const dateOffset = (days) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function getWorkspace(c) {
  let r
  if (ownerEmails.length) {
    r = await c.query(
      `select u.id as user_id, wm."workspaceId" as workspace_id, w.name as workspace_name
       from "User" u
       join "WorkspaceMember" wm on wm."userId"=u.id
       join "Workspace" w on w.id=wm."workspaceId"
       where lower(u.email)=any($1::text[])
         and wm.role='OWNER'
       order by wm."createdAt" asc
       limit 1`,
      [ownerEmails],
    )
  }
  if (!r?.rows?.[0]) {
    r = await c.query(
      `select u.id as user_id, wm."workspaceId" as workspace_id, w.name as workspace_name
       from "User" u
       join "WorkspaceMember" wm on wm."userId"=u.id
       join "Workspace" w on w.id=wm."workspaceId"
       where wm.role='OWNER'
       order by wm."createdAt" asc
       limit 1`,
    )
  }
  if (!r.rows[0]) throw new Error('Workspace OWNER tidak ditemukan.')
  return r.rows[0]
}

async function getProject(c, workspaceId) {
  const r = await c.query(
    `select id, "projectCode", "projectName", status
     from "Project"
     where "workspaceId"=$1
       and status <> 'CANCELLED'
     order by case when "projectCode" like 'BSM-UAT%' then 0 else 1 end, "createdAt" desc
     limit 1`,
    [workspaceId],
  )
  if (!r.rows[0]) throw new Error('Belum ada project aktif. Buat project terlebih dahulu.')
  return r.rows[0]
}

async function ensureVendor(c, workspaceId, actorId) {
  const name = 'PT Kabel Prima Nusantara'
  const found = await c.query(
    `select id, name from "ClientVendor" where "workspaceId"=$1 and name=$2 and type='VENDOR' limit 1`,
    [workspaceId, name],
  )
  if (found.rows[0]) return found.rows[0]

  const id = randomUUID()
  await c.query(
    `insert into "ClientVendor"
      (id, "workspaceId", name, type, category, offerings, "isActive", "createdAt", "updatedAt")
     values ($1,$2,$3,'VENDOR',$4,$5,true,now(),now())`,
    [id, workspaceId, name, 'Material & Electrical', 'Kabel, aksesoris kabel, electrical consumables'],
  )
  await c.query(
    `insert into "AuditLog"
      (id, "workspaceId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
     values ($1,$2,$3,'CREATE','CLIENT_VENDOR',$4,$5::jsonb,now())`,
    [randomUUID(), workspaceId, actorId, id, JSON.stringify({ type: 'VENDOR', seed: 'UAT-EXPENSE-CASES' })],
  )
  return { id, name }
}

const cases = ({ projectId, vendorId }) => [
  {
    key: '1',
    date: dateOffset(-2),
    vendorId,
    payeeName: null,
    category: 'MATERIAL',
    paymentMethod: 'BANK_TRANSFER',
    description: '[UAT-EXPENSE-CASE-1] Material project dari vendor',
    items: [
      { description: 'Kabel NYY 4 x 16 mm²', quantity: '50', unit: 'meter', unitPrice: '72000.00' },
      { description: 'Cable tie heavy duty', quantity: '10', unit: 'pack', unitPrice: '115000.00' },
    ],
    projectId,
  },
  {
    key: '2',
    date: dateOffset(-1),
    vendorId: null,
    payeeName: 'SPBU / Petugas BBM Lapangan',
    category: 'BBM',
    paymentMethod: 'CASH',
    description: '[UAT-EXPENSE-CASE-2] BBM kendaraan operasional lapangan',
    items: [
      { description: 'Pertalite / BBM kendaraan operasional', quantity: '42', unit: 'liter', unitPrice: '13500.00' },
    ],
    projectId,
  },
  {
    key: '3',
    date: dateOffset(0),
    vendorId: null,
    payeeName: 'Warung / Penanggung Jawab Konsumsi Lapangan',
    category: 'KONSUMSI',
    paymentMethod: 'PETTY_CASH',
    description: '[UAT-EXPENSE-CASE-3] Konsumsi harian tim proyek',
    items: [
      { description: 'Makan siang tim lapangan', quantity: '12', unit: 'porsi', unitPrice: '35000.00' },
      { description: 'Air mineral', quantity: '12', unit: 'botol', unitPrice: '5000.00' },
    ],
    projectId,
  },
]

async function insertCase(c, workspaceId, actorId, row) {
  const existing = await c.query(
    `select id, amount, status from "Expense"
     where "workspaceId"=$1 and description=$2 limit 1`,
    [workspaceId, row.description],
  )
  if (existing.rows[0]) return { created: false, ...existing.rows[0] }

  const total = row.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0)
  const amount = money(total)
  const expenseId = randomUUID()
  const allocationId = randomUUID()

  await c.query('begin')
  try {
    await c.query(
      `insert into "Expense"
        (id, "workspaceId", "vendorId", "projectId", "payeeName", category, "allocationType", description,
         "paymentMethod", "receiptUrl", amount, "expenseDate", status, "createdAt", "updatedAt")
       values ($1,$2,$3,$4,$5,$6,'DIRECT',$7,$8,null,$9,$10::date,'APPROVED',now(),now())`,
      [expenseId, workspaceId, row.vendorId, row.projectId, row.payeeName, row.category, row.description, row.paymentMethod, amount, row.date],
    )

    for (const item of row.items) {
      const lineTotal = money(Number(item.quantity) * Number(item.unitPrice))
      await c.query(
        `insert into "ExpenseItem"
          (id, "expenseId", description, quantity, unit, "unitPrice", "totalAmount", "createdAt", "updatedAt")
         values ($1,$2,$3,$4,$5,$6,$7,now(),now())`,
        [randomUUID(), expenseId, item.description, item.quantity, item.unit, item.unitPrice, lineTotal],
      )
    }

    await c.query(
      `insert into "ExpenseAllocation"
        (id, "expenseId", "projectId", percentage, amount, note, "createdAt", "updatedAt")
       values ($1,$2,$3,100.00,$4,$5,now(),now())`,
      [allocationId, expenseId, row.projectId, amount, 'UAT sample: direct project cost'],
    )

    await c.query(
      `insert into "CashflowTransaction"
        (id, "workspaceId", type, category, amount, "transactionDate", "sourceRef", "expenseId", "createdAt")
       values ($1,$2,'EXPENSE',$3,$4,$5::date,$6,$7,now())`,
      [randomUUID(), workspaceId, row.category, amount, row.date, row.vendorId ? 'PT Kabel Prima Nusantara' : row.payeeName, expenseId],
    )

    await c.query(
      `insert into "AuditLog"
        (id, "workspaceId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       values ($1,$2,$3,'CREATE','EXPENSE',$4,$5::jsonb,now())`,
      [
        randomUUID(),
        workspaceId,
        actorId,
        expenseId,
        JSON.stringify({ seed: 'UAT-EXPENSE-CASES', case: row.key, amount, category: row.category, projectId: row.projectId }),
      ],
    )

    await c.query('commit')
  } catch (error) {
    await c.query('rollback')
    throw error
  }

  return { created: true, id: expenseId, amount, status: 'APPROVED' }
}

async function main() {
  const c = await pool.connect()
  try {
    const workspace = await getWorkspace(c)
    const project = await getProject(c, workspace.workspace_id)
    const vendor = await ensureVendor(c, workspace.workspace_id, workspace.user_id)

    console.log(`Workspace : ${workspace.workspace_name}`)
    console.log(`Project   : ${project.projectCode} — ${project.projectName}`)
    console.log('')

    for (const row of cases({ projectId: project.id, vendorId: vendor.id })) {
      const result = await insertCase(c, workspace.workspace_id, workspace.user_id, row)
      console.log(
        `${result.created ? 'CREATED' : 'SKIPPED'} Case ${row.key}: ${row.category} — Rp ${Number(result.amount || 0).toLocaleString('id-ID')} — ${result.status}`,
      )
    }

    console.log('\n=== UAT EXPENSE CASES READY ===')
    console.log('1. MATERIAL + Vendor master + Bank Transfer')
    console.log('2. BBM + tanpa Vendor master + Cash + pihak/penerima')
    console.log('3. KONSUMSI + tanpa Vendor master + Petty Cash + pihak/penerima')
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(`\nSeed expense gagal: ${error.message || error}`)
  process.exitCode = 1
})
