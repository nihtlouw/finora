'use client'
import { useEffect, useState } from 'react'
import { SideDrawer } from '@/components/finora-side-drawer'

type Module = 'change-orders'|'periods'|'credit-notes'|'vendor-bills'|'banks'|'employees'|'payroll'|'documents'
const labels:Record<Module,string>={
  'change-orders':'Change Orders','periods':'Period Closing','credit-notes':'Credit Notes','vendor-bills':'Vendor Bills / AP','banks':'Bank Accounts','employees':'Employees','payroll':'Payroll','documents':'Project Documents'
}
const descriptions:Record<Module,string>={
  'change-orders':'Perubahan scope atau nilai kontrak yang harus disetujui sebelum memengaruhi baseline project.',
  'periods':'Batas kontrol mutasi keuangan. Tutup periode setelah checklist dampak dan transaksi terbuka diperiksa.',
  'credit-notes':'Penyesuaian invoice dan piutang. Setiap note harus dapat ditelusuri ke invoice sumber.',
  'vendor-bills':'Hutang usaha supplier/subkon. Pembayaran memengaruhi project cost dan cashflow.',
  'banks':'Sumber rekening dan saldo bank untuk cashflow serta rekonsiliasi bank.',
  'employees':'Master tenaga kerja yang menjadi sumber payroll, akses histori, dan alokasi biaya.',
  'payroll':'Payroll mengalir ke settlement, cashflow, dan bila dialokasikan membentuk project cost.',
  'documents':'Evidence project yang dapat ditelusuri ke PO, execution, BAP/BAST, invoice, dan closeout.'
}
const integrations:Record<Module,string>={
  'change-orders':'Proposal/PO → Project → Contract Baseline → Billing Rebaseline',
  'periods':'Accounting Period → Approval / Mutation Guard → Financial Reports',
  'credit-notes':'Invoice → Credit Note → Receivables / Reporting',
  'vendor-bills':'Vendor Bill → Approval → Payment → Project Cost / Cashflow',
  'banks':'Bank Account → Cashflow → Bank Statement → Reconciliation',
  'employees':'Employee → Payroll → Allocation → Project Cost',
  'payroll':'Employee → Payroll Run → Payment → Cashflow',
  'documents':'Project → Document Evidence → Execution / Billing / Closeout'
}

function money(v:any){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:2}).format(Number(v||0))}
function badge(status:any){return <span className="f-badge neutral">{String(status||'—')}</span>}

export default function EnterpriseList({module,role}:{module:Module;role:string}){
  const [rows,setRows]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [open,setOpen]=useState(false);const [form,setForm]=useState<Record<string,string>>({})
  const endpoint=`/api/${module}`
  async function load(){setLoading(true);setError('');try{const r=await fetch(endpoint);const d=await r.json();if(!r.ok)throw new Error(d.error||'Gagal memuat data.');setRows(d[module==='change-orders'?'changeOrders':module==='periods'?'periods':module==='credit-notes'?'creditNotes':module==='vendor-bills'?'vendorBills':module==='banks'?'bankAccounts':module==='employees'?'employees':module==='payroll'?'payrollRuns':'documents']||[])}catch(e){setError(e instanceof Error?e.message:'Gagal memuat data.')}finally{setLoading(false)}}
  useEffect(()=>{load()},[module])
  async function create(){try{let body:any={...form};if(module==='banks')body.openingBalance=form.openingBalance||'0',body.isDefault=form.isDefault==='true';if(module==='employees')body.baseSalary=form.baseSalary||'0';if(module==='periods')body.action='OPEN';const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Gagal menyimpan.');setOpen(false);setForm({});await load()}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan.')}}
  async function periodAction(period:string,action:string){const reason=action==='REOPEN'?window.prompt('Alasan reopen periode?')||'Reopen koreksi':'';const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({period,action,reason})});const d=await r.json();if(!r.ok)setError(d.error||'Gagal mengubah periode.');await load()}
  const canWrite=['OWNER','FINANCE'].includes(role)
  return <div className="f-content"><div className="f-pagehead"><div className="f-eyebrow">CONTROL PLANE</div><h1>{labels[module]}</h1><p className="f-muted">{descriptions[module]}</p></div>{error&&<div className="f-inline-alert error">{error}</div>}<div className="f-card"><div className="f-card-head"><div><h3>{labels[module]}</h3><p>{rows.length} record · Integrasi: {integrations[module]}</p></div>{canWrite&&['banks','employees'].includes(module)&&<button className="f-btn primary" onClick={()=>setOpen(true)}>+ Tambah</button>}</div>{loading?<div className="f-empty">Memuat…</div>:rows.length===0?<div className="f-empty"><strong>Belum ada data</strong>Mulai dari workflow yang sesuai.</div>:<div className="f-table-wrap"><table className="f-table f-control-table"><thead><tr><th>Identitas</th><th>Status</th><th>Nilai</th><th>Tanggal / Periode</th><th>Aksi</th></tr></thead><tbody>{rows.map((r:any)=><tr key={r.id}><td><strong>{r.name||r.changeNumber||r.number||r.billNumber||r.runNumber||r.employeeNo||r.period||r.title||r.id.slice(0,8)}</strong><div className="f-muted">{r.bankName||r.vendor?.name||r.project?.projectName||r.invoice?.invoiceNumber||r.period||r.fileName||''}</div></td><td>{badge(r.status)}</td><td>{r.totalAmount!=null?money(r.totalAmount):r.grandTotal!=null?money(r.grandTotal):r.netAmount!=null?money(r.netAmount):r.openingBalance!=null?money(r.openingBalance):r.totalValue!=null?money(r.totalValue):'—'}</td><td>{r.period||r.billDate||r.issueDate||r.payDate||r.createdAt?new Intl.DateTimeFormat('id-ID').format(new Date(r.billDate||r.issueDate||r.payDate||r.createdAt)):''}</td><td>{module==='periods'&&canWrite&&<div style={{display:'flex',gap:6}}>{r.status==='OPEN'?<button className="f-btn soft" onClick={()=>periodAction(r.period,'CLOSE')}>Tutup</button>:<button className="f-btn soft" onClick={()=>periodAction(r.period,'REOPEN')}>Reopen</button>}</div>}</td></tr>)}</tbody></table></div>}</div>{open&&<SideDrawer
      open={open}
      onClose={()=>setOpen(false)}
      title={module==='banks'?'Tambah rekening bank':'Tambah karyawan'}
      description={module==='banks'?'Rekening menjadi sumber bank, cashflow, dan rekonsiliasi.':'Employee master menjadi sumber payroll dan histori biaya tenaga kerja.'}
      footer={<div className="f-drawer-actions"><button className="f-btn soft" type="button" onClick={()=>setOpen(false)}>Batal</button><button className="f-btn primary" type="button" onClick={create}>Simpan</button></div>}
    >
      <div className="f-form">{module==='banks'?<><label>Nama rekening<input className="f-input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Bank<input className="f-input" value={form.bankName||''} onChange={e=>setForm({...form,bankName:e.target.value})}/></label><label>Nomor rekening<input className="f-input" value={form.accountNumber||''} onChange={e=>setForm({...form,accountNumber:e.target.value})}/></label><label>Saldo awal<input className="f-input" value={form.openingBalance||''} onChange={e=>setForm({...form,openingBalance:e.target.value})}/></label><label>Default<select className="f-select" value={form.isDefault||'false'} onChange={e=>setForm({...form,isDefault:e.target.value})}><option value="false">Tidak</option><option value="true">Ya</option></select></label></>:<><label>Nomor karyawan<input className="f-input" value={form.employeeNo||''} onChange={e=>setForm({...form,employeeNo:e.target.value})}/></label><label>Nama<input className="f-input" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Email<input className="f-input" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Gaji pokok<input className="f-input" value={form.baseSalary||''} onChange={e=>setForm({...form,baseSalary:e.target.value})}/></label></>}</div>
    </SideDrawer>}</div>
}
