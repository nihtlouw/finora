import 'dotenv/config'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

const ownerEmails = String(process.env.FINORA_OWNER_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL belum dikonfigurasi.')

const pool = new Pool({
  connectionString: dbUrl,
  max: 4,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: true },
})

const clients = [
  ['PT Grid Nusantara Energi', 'procurement@gridnusantara.example', '021-555-2101', 'Rizky Pratama', 'Jl. Industri Raya No. 18, Cikarang, Bekasi'],
  ['PT Arunika Smart Infrastruktur', 'project@arunikasmart.example', '021-555-2102', 'Nadia Putri', 'Jl. Kemang Industri No. 7, Jakarta Selatan'],
  ['PT Cipta Daya Integrasi', 'engineering@ciptadaya.example', '022-555-2103', 'Fajar Hidayat', 'Jl. Soekarno Hatta No. 88, Bandung'],
  ['PT Sagara Power Engineering', 'vendor.management@sagarapower.example', '031-555-2104', 'Dimas Santoso', 'Jl. Tanjung Perak Baru No. 12, Surabaya'],
  ['CV Maju Teknologi Sentosa', 'info@majutekno.example', '024-555-2105', 'Ayu Lestari', 'Jl. Majapahit No. 101, Semarang'],
]

const vendors = [
  ['PT Kabel Prima Nusantara', 'sales@kabelprima.example', '021-600-3101', 'Budi Hartono', 'Kawasan Industri MM2100, Bekasi'],
  ['PT Panelindo Energi', 'commercial@panelindo.example', '021-600-3102', 'Sari Wulandari', 'Jl. Raya Serang KM 12, Tangerang'],
  ['PT Sensorika IoT Indonesia', 'sales@sensorika.example', '021-600-3103', 'Reza Maulana', 'Jl. TB Simatupang No. 45, Jakarta Selatan'],
  ['CV Karya Instalasi Mandiri', 'operasional@karyainstalasi.example', '022-600-3104', 'Agus Setiawan', 'Jl. Soekarno Hatta No. 55, Bandung'],
  ['PT Proteksi Listrik Sejahtera', 'sales@proteksilistrik.example', '031-600-3105', 'Maya Kartika', 'Jl. Rungkut Industri No. 20, Surabaya'],
]

const proposals = [
  { number: 'PR-UAT-001', client: clients[0][0], days: 30, discount: 0, tax: 11, terms: 'Pembayaran 50% uang muka dan 50% setelah commissioning.', items: [['Survey dan engineering gardu distribusi 20kV', 1, 18500000], ['Pengadaan dan instalasi panel distribusi', 1, 47500000], ['Instalasi kabel, terminasi, dan testing', 1, 32500000], ['Commissioning dan dokumentasi as-built', 1, 12500000]] },
  { number: 'PR-UAT-002', client: clients[1][0], days: 21, discount: 5, tax: 11, terms: 'Pembayaran 40% DP, 40% setelah instalasi perangkat, 20% setelah UAT sistem IoT.', items: [['Site assessment dan desain arsitektur IoT', 1, 12000000], ['Gateway IoT dan sensor monitoring gardu', 12, 1850000], ['Instalasi dan konfigurasi perangkat', 1, 16500000], ['Dashboard monitoring dan integrasi API', 1, 28000000]] },
  { number: 'PR-UAT-003', client: clients[2][0], days: 45, discount: 2.5, tax: 0, terms: 'Pembayaran 50% DP dan pelunasan 14 hari setelah berita acara serah terima.', items: [['Retrofit proteksi relay dan metering', 1, 38500000], ['Pengadaan CT/PT dan accessories', 1, 22500000], ['Wiring, testing, dan relay setting', 1, 27500000], ['Training operator dan handover', 1, 8500000]] },
  { number: 'PR-UAT-004', client: clients[3][0], days: 30, discount: 3, tax: 11, terms: 'Penawaran berlaku 30 hari. Pekerjaan dilakukan bertahap mengikuti window shutdown area kerja.', items: [['Instalasi sistem grounding gardu', 1, 28500000], ['Lightning protection system', 1, 19500000], ['Pengujian earth resistance dan laporan', 1, 9500000], ['Material accessories dan consumables', 1, 7500000]] },
  { number: 'PR-UAT-005', client: clients[4][0], days: 14, discount: 0, tax: 11, terms: 'Pembayaran 50% DP, 50% setelah instalasi dan serah terima sistem.', items: [['IoT energy meter dan gateway', 8, 3200000], ['Instalasi jaringan dan panel komunikasi', 1, 14500000], ['Konfigurasi cloud dashboard', 1, 11500000], ['Uji konektivitas dan commissioning', 1, 6500000]] },
]

const money = (n) => Number(n).toFixed(2)
const addDays = (days) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10) }

async function getWorkspace(c) {
  let r = null
  if (ownerEmails.length) {
    r = await c.query(`select u.id user_id, wm.workspace_id, w.name workspace_name from "User" u join "WorkspaceMember" wm on wm.user_id=u.id join "Workspace" w on w.id=wm.workspace_id where lower(u.email)=any($1::text[]) and wm.role='OWNER' order by wm.created_at asc limit 1`, [ownerEmails])
  }
  if (!r?.rows?.[0]) r = await c.query(`select u.id user_id, wm.workspace_id, w.name workspace_name from "User" u join "WorkspaceMember" wm on wm.user_id=u.id join "Workspace" w on w.id=wm.workspace_id where wm.role='OWNER' order by wm.created_at asc limit 1`)
  if (!r.rows[0]) throw new Error('Workspace OWNER tidak ditemukan. Set FINORA_OWNER_EMAILS atau buat workspace terlebih dahulu.')
  return r.rows[0]
}

async function audit(c, workspaceId, actorId, action, type, id, metadata) {
  await c.query(`insert into "AuditLog" (id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata, created_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,now())`, [randomUUID(), workspaceId, actorId, action, type, id, JSON.stringify(metadata)])
}

async function ensureContact(c, workspaceId, actorId, row, type) {
  const [name,email,phone,pic,address] = row
  const found = await c.query(`select id, name from "ClientVendor" where workspace_id=$1 and name=$2 limit 1`, [workspaceId, name])
  if (found.rows[0]) return found.rows[0]
  const id = randomUUID()
  await c.query(`insert into "ClientVendor" (id, workspace_id, name, type, email, phone, pic_name, address, is_active, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,true,now(),now())`, [id,workspaceId,name,type,email,phone,pic,address])
  await audit(c, workspaceId, actorId, 'CREATE', 'CLIENT_VENDOR', id, { type, seed: 'UAT-DEMO' })
  return { id, name }
}

async function ensureProposal(c, workspaceId, actorId, p, clientId) {
  const found = await c.query(`select id, proposal_number, total_amount from "Proposal" where proposal_number=$1 limit 1`, [p.number])
  if (found.rows[0]) return { ...found.rows[0], created:false }
  const subtotal = p.items.reduce((s, [,qty,unit]) => s + qty*unit, 0)
  const discountAmount = Math.round(subtotal * p.discount / 100)
  const taxAmount = Math.round((subtotal-discountAmount) * p.tax / 100)
  const total = subtotal-discountAmount+taxAmount
  const proposalId = randomUUID()
  const c2 = await c.query('select 1')
  void c2
  await c.query('begin')
  try {
    await c.query(`insert into "Proposal" (id,client_id,proposal_number,status,subtotal_amount,discount_percent,discount_amount,tax_percent,tax_amount,total_amount,terms_and_conditions,valid_until,created_at,updated_at) values ($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8,$9,$10,$11::date,now(),now())`, [proposalId,clientId,p.number,money(subtotal),money(p.discount),money(discountAmount),money(p.tax),money(taxAmount),money(total),p.terms,addDays(p.days)])
    for (const [description,qty,unitPrice] of p.items) await c.query(`insert into "ProposalItem" (id,proposal_id,description,qty,unit_price) values ($1,$2,$3,$4,$5)`, [randomUUID(),proposalId,description,qty,money(unitPrice)])
    await audit(c, workspaceId, actorId, 'CREATE', 'PROPOSAL', proposalId, { proposalNumber:p.number, total })
    await c.query('commit')
  } catch(e) { await c.query('rollback'); throw e }
  return { id:proposalId, proposal_number:p.number, total_amount:String(total), created:true }
}

async function main() {
  const c = await pool.connect()
  try {
    const ws = await getWorkspace(c)
    console.log(`Workspace: ${ws.workspace_name}`)
    const clientRows = []
    for (const row of clients) clientRows.push(await ensureContact(c,ws.workspace_id,ws.user_id,row,'CLIENT'))
    const vendorRows = []
    for (const row of vendors) vendorRows.push(await ensureContact(c,ws.workspace_id,ws.user_id,row,'VENDOR'))
    const map = new Map(clientRows.map(x => [x.name,x.id]))
    const proposalRows = []
    for (const p of proposals) proposalRows.push(await ensureProposal(c,ws.workspace_id,ws.user_id,p,map.get(p.client)))
    console.log('\n=== UAT DEMO DATA READY ===')
    console.log(`Clients: ${clientRows.length}`)
    console.log(`Vendors: ${vendorRows.length}`)
    console.log(`Proposals: ${proposalRows.length} (DRAFT)`)
    console.log('\nLifecycle UAT: DRAFT → SENT → WON → Customer PO → Project → Billing → Invoice')
    for (const p of proposalRows) console.log(`- ${p.proposal_number}${p.created === false ? ' (sudah ada)' : ''}`)
  } finally { c.release(); await pool.end() }
}
main().catch(async e => { console.error(`\nSeed UAT gagal: ${e.message || e}`); await pool.end(); process.exit(1) })
