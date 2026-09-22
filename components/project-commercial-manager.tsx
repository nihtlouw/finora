'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import { SideDrawer } from '@/components/finora-side-drawer'

type PO = { id:string; poNumber:string; poDate:string; receivedDate:string; status:string; totalAmount:any; taxAmount:any; grandTotal:any; overheadAmount?:any; roundingAmount?:any; roundedGrandTotal?:any; commercialVarianceAmount?:any; commercialVarianceReason?:string|null; reference?:string|null; remarks?:string|null; client:{id:string;name:string}; quotation?:{id:string;proposalNumber:string;projectName?:string|null;status:string}|null; project?:{id:string;projectCode:string;projectName:string;status:string}|null }
type Project = { id:string; projectCode:string; projectName:string; location?:string|null; status:string; contractValue:any; client:{id:string;name:string}; proposal?:{proposalNumber:string;status:string}|null; customerPO?:{poNumber:string;status:string;grandTotal:any}|null; executionMilestones?:{sequence:number;code:string;name:string;status:string;progressPct:any;plannedDate?:string|null;actualDate?:string|null}[] }
type Client = { id:string; name:string; type:string }
type Proposal = { id:string; proposalNumber:string; status:string; projectName?:string|null; client:Client; subtotalAmount:any; taxAmount:any; totalAmount:any; roundedTotalAmount?:any; overheadAmount?:any; roundingAmount?:any; taxIncluded?:boolean; quotationReference?:string|null }
async function body(r:Response){try{return await r.json()}catch{return {}}}
function tone(s:string){return s==='VERIFIED'||s==='ACTIVE'||s==='COMPLETED'?'green':s==='REJECTED'||s==='CANCELLED'?'red':s==='RECEIVED'||s==='PLANNED'?'amber':'blue'}

export function CustomerPOManager({role}:{role:string}){
  const params=useSearchParams(); const preselected=params.get('quotationId')||''
  const [rows,setRows]=useState<PO[]>([]),[clients,setClients]=useState<Client[]>([]),[proposals,setProposals]=useState<Proposal[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[drawerOpen,setDrawerOpen]=useState(Boolean(preselected))
  const [form,setForm]=useState({clientId:'',quotationId:preselected,poNumber:'',poDate:new Date().toISOString().slice(0,10),receivedDate:new Date().toISOString().slice(0,10),reference:'',subtotalAmount:'',taxAmount:'0',overheadAmount:'0',roundingAmount:'0',dpPercent:'50',dpDueDays:'7',progressPercent:'45',progressTrigger:'FAT_AND_PRE_DELIVERY',retentionPercent:'5',retentionMonths:'2',commercialVarianceReason:'',remarks:''})
  const can=role==='OWNER'||role==='FINANCE'
  async function load(){const [a,b,c]=await Promise.all([fetch('/api/customer-pos'),fetch('/api/clients?type=CLIENT'),fetch('/api/proposals')]);const [ad,bd,cd]=await Promise.all([body(a),body(b),body(c)]);setRows(ad.customerPOs||[]);setClients(bd.clients||[]);setProposals((cd.proposals||[]).filter((x:Proposal)=>x.status==='WON'))}
  useEffect(()=>{load()},[])
  useEffect(()=>{if(preselected)setForm(f=>({...f,quotationId:preselected}))},[preselected])
  useEffect(()=>{const p=proposals.find(x=>x.id===form.quotationId);if(p){setForm(f=>({...f,clientId:p.client.id,subtotalAmount:String(Number(p.subtotalAmount||0)),taxAmount:String(Number(p.taxAmount||0)),overheadAmount:String(Number(p.overheadAmount||0)),roundingAmount:String(Number(p.roundingAmount||0)),commercialVarianceReason:'',reference:p.quotationReference||f.reference}))}},[form.quotationId,proposals])
  function update(k:string,v:string){setForm(f=>({...f,[k]:v}))}
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/customer-pos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,subtotalAmount:Number(form.subtotalAmount),taxAmount:Number(form.taxAmount),overheadAmount:Number(form.overheadAmount||0),roundingAmount:Number(form.roundingAmount||0),grandTotal:Number(form.subtotalAmount||0)+Number(form.taxAmount||0)+Number(form.overheadAmount||0)+Number(form.roundingAmount||0),paymentTermsSnapshot:{stages:[{name:'DP',percentage:Number(form.dpPercent||0),trigger:'PO_RELEASED',dueDays:Number(form.dpDueDays||0)},{name:'Progress',percentage:Number(form.progressPercent||0),trigger:form.progressTrigger},{name:'Retention',percentage:Number(form.retentionPercent||0),trigger:'RETENTION_END',retentionMonths:Number(form.retentionMonths||0)}]}})});const d=await body(r);if(!r.ok)throw new Error(d.error||'Gagal menyimpan PO.');setMessage('PO customer berhasil dicatat.');setDrawerOpen(false);setForm(f=>({...f,poNumber:'',reference:'',subtotalAmount:'',taxAmount:'0',overheadAmount:'0',roundingAmount:'0',dpPercent:'50',dpDueDays:'7',progressPercent:'45',progressTrigger:'FAT_AND_PRE_DELIVERY',retentionPercent:'5',retentionMonths:'2',commercialVarianceReason:'',remarks:''}));await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan PO.')}finally{setBusy(false)}}
  function openCreate(){setMessage('');setDrawerOpen(true)}
  function closeCreate(){if(!busy)setDrawerOpen(false)}
  async function setStatus(id:string,status:string){setBusy(true);setMessage('');try{const r=await fetch(`/api/customer-pos/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const d=await body(r);if(!r.ok)throw new Error(d.error||'Gagal memperbarui PO.');setMessage(`PO menjadi ${status}.`);await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal.')}finally{setBusy(false)}}
  const selectedProposal = proposals.find(x=>x.id===form.quotationId)
  const formGrandTotal = (Number(form.subtotalAmount)||0)+(Number(form.taxAmount)||0)+(Number(form.overheadAmount)||0)+(Number(form.roundingAmount)||0)
  const quotationGrandTotal = Number(selectedProposal?.roundedTotalAmount ?? selectedProposal?.totalAmount ?? 0)
  const commercialVariance = formGrandTotal - quotationGrandTotal
  const hasVariance = Math.abs(commercialVariance) > 0.009
  return <div className="f-content"><PageHeader eyebrow="COMMERCIAL / PURCHASE ORDER" title="PO Customer" description="Kelola PO customer sebagai sumber order, payment terms, dan dasar pembentukan project." action={<>{message&&<span className="f-badge green">{message}</span>}{can&&<button className="f-btn primary" type="button" onClick={openCreate}>+ Catat PO</button>}</>} />
    <div className="f-grid-4"><StatCard label="Total PO" value={rows.length} icon="▤"/><StatCard label="Finance checked" value={rows.filter(x=>x.status==='VERIFIED').length} icon="✓"/><StatCard label="Belum diverifikasi" value={rows.filter(x=>x.status==='RECEIVED').length} icon="!"/><StatCard label="Nilai PO" value={money(rows.reduce((s,x)=>s+Number(x.grandTotal||0),0))} icon="Rp"/></div>
    <Card className="f-section-gap"><div className="f-card-head"><div><h3>Daftar PO customer</h3><p>PO menjadi sumber konfirmasi sebelum project dibuat.</p></div></div><div style={{overflowX:'auto'}}><table className="f-table f-responsive-table f-customer-po-table"><thead><tr><th>PO</th><th>Klien</th><th>Referensi</th><th>Tanggal</th><th>Nilai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.poNumber}</strong></td><td>{x.client.name}</td><td>{x.quotation?.proposalNumber||x.reference||'—'}</td><td>{new Date(x.poDate).toLocaleDateString('id-ID')}</td><td className="f-number">{money(Number(x.grandTotal))}</td><td><Badge tone={tone(x.status)}>{x.status}</Badge></td><td><div className="f-actions">{x.status==='RECEIVED'&&can&&<><button className="f-btn soft" disabled={busy} onClick={()=>setStatus(x.id,'VERIFIED')}>Finance check</button><button className="f-btn" disabled={busy} onClick={()=>setStatus(x.id,'REJECTED')}>Tolak</button></>}{x.status==='VERIFIED'&&can&&!x.project&&<><button className="f-btn" disabled={busy} onClick={()=>setStatus(x.id,'CANCELLED')}>Batalkan</button><a className="f-btn primary" href={`/projects?customerPoId=${x.id}`}>Buat Project</a></>}{x.project&&<a className="f-btn soft" href={`/projects/${x.project.id}`}>Lihat Project</a>}</div></td></tr>)}</tbody></table></div>{!rows.length&&<div className="f-empty"><strong>Belum ada PO customer</strong>Catat PO dari proposal yang sudah WON.</div>}</Card>
    <SideDrawer
      className="f-full-workspace customer-po-entry-workspace"
      open={drawerOpen}
      onClose={closeCreate}
      title="Catat PO customer"
      description="Hubungkan PO customer ke proposal WON. Data commercial dan payment terms akan menjadi snapshot dasar workflow project."
      footer={<div className="f-drawer-actions"><button className="f-btn" type="button" onClick={closeCreate} disabled={busy}>Cancel</button><button className="f-btn primary" form="create-customer-po-form" type="submit" disabled={busy}>{busy?'Saving…':'Simpan PO'}</button></div>}
    >
      <form id="create-customer-po-form" className="f-form" onSubmit={save}>
        <label>Proposal WON
          <select className="f-input" value={form.quotationId} onChange={e=>update('quotationId',e.target.value)} required>
            <option value="">Pilih proposal WON</option>
            {proposals.map(p=><option key={p.id} value={p.id}>{p.proposalNumber} — {p.client.name}</option>)}
          </select>
        </label>
        <label>Klien
          <select className="f-input" value={form.clientId} onChange={e=>update('clientId',e.target.value)} required>
            <option value="">Pilih klien</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="f-drawer-source">
          <div><span>Proposal snapshot</span><strong>{selectedProposal?selectedProposal.proposalNumber:'Pilih proposal terlebih dahulu'}</strong></div>
          <div><span>Customer</span><strong>{selectedProposal?.client.name||'—'}</strong></div>
          <div><span>Quotation value</span><strong>{money(quotationGrandTotal)}</strong></div>
          <div><span>PO draft total</span><strong>{money(formGrandTotal)}</strong></div>
        </div>
        <div className="f-form-grid">
          <label>Nomor PO
            <input className="f-input" value={form.poNumber} onChange={e=>update('poNumber',e.target.value)} placeholder="PO customer / nomor order" required />
          </label>
          <label>Tanggal PO
            <input type="date" className="f-input" value={form.poDate} onChange={e=>update('poDate',e.target.value)} required />
          </label>
          <label>Diterima
            <input type="date" className="f-input" value={form.receivedDate} onChange={e=>update('receivedDate',e.target.value)} required />
          </label>
          <label>Reference
            <input className="f-input" value={form.reference} onChange={e=>update('reference',e.target.value)} placeholder="Nomor quotation / kontrak customer" />
          </label>
          <label>Subtotal PO
            <input className="f-input" inputMode="numeric" value={form.subtotalAmount} onChange={e=>update('subtotalAmount',e.target.value)} required />
          </label>
          <label>PPN PO
            <input className="f-input" inputMode="numeric" value={form.taxAmount} onChange={e=>update('taxAmount',e.target.value)} />
          </label>
          <label>Overhead
            <input className="f-input" inputMode="numeric" value={form.overheadAmount} onChange={e=>update('overheadAmount',e.target.value)} />
          </label>
          <label>Rounding adjustment
            <input className="f-input" inputMode="numeric" value={form.roundingAmount} onChange={e=>update('roundingAmount',e.target.value)} />
          </label>
          <label>Grand total PO
            <input className="f-input" inputMode="numeric" value={String(formGrandTotal)} readOnly />
          </label>
        </div>
        <div className="f-inline-alert"><strong>Payment terms terstruktur</strong><span>Atur tahap DP, progress, dan retention. Nilai persentase harus mencerminkan terms customer.</span></div>
        <div className="f-form-grid">
          <label>DP (%)
            <input className="f-input" type="number" min="0" max="100" step="0.01" value={form.dpPercent} onChange={e=>update('dpPercent',e.target.value)} />
          </label>
          <label>DP due days
            <input className="f-input" type="number" min="0" value={form.dpDueDays} onChange={e=>update('dpDueDays',e.target.value)} />
          </label>
          <label>Progress (%)
            <input className="f-input" type="number" min="0" max="100" step="0.01" value={form.progressPercent} onChange={e=>update('progressPercent',e.target.value)} />
          </label>
          <label>Progress trigger
            <input className="f-input" value={form.progressTrigger} onChange={e=>update('progressTrigger',e.target.value)} />
          </label>
          <label>Retention (%)
            <input className="f-input" type="number" min="0" max="100" step="0.01" value={form.retentionPercent} onChange={e=>update('retentionPercent',e.target.value)} />
          </label>
          <label>Retention (bulan)
            <input className="f-input" type="number" min="0" value={form.retentionMonths} onChange={e=>update('retentionMonths',e.target.value)} />
          </label>
        </div>
        {selectedProposal&&<div className="f-inline-alert"><strong>Snapshot proposal:</strong> {money(Number(selectedProposal.subtotalAmount))} + {money(Number(selectedProposal.taxAmount))} = <strong>{money(Number(selectedProposal.roundedTotalAmount ?? selectedProposal.totalAmount))}</strong>. Nilai PO yang berbeda akan dicatat sebagai commercial variance.</div>}
        {hasVariance&&<label>Alasan commercial variance
          <textarea className="f-input" rows={4} required value={form.commercialVarianceReason} onChange={e=>update('commercialVarianceReason',e.target.value)} placeholder="Contoh: customer mengubah scope setelah negosiasi final." />
        </label>}
        <label>Catatan
          <textarea className="f-input" rows={4} value={form.remarks} onChange={e=>update('remarks',e.target.value)} />
        </label>
      </form>
    </SideDrawer>
  </div>
}

export function ProjectsManager({role}:{role:string}){
  const params=useSearchParams()
  const preselected=params.get('customerPoId')||''
  const [rows,setRows]=useState<Project[]>([])
  const [pos,setPos]=useState<PO[]>([])
  const [clients,setClients]=useState<Client[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [q,setQ]=useState('')
  const [poNumber,setPoNumber]=useState('')
  const [statusFilter,setStatusFilter]=useState('ALL')
  const [clientFilter,setClientFilter]=useState('ALL')
  const [filtersOpen,setFiltersOpen]=useState(false)
  const [loading,setLoading]=useState(true)
  const [drawerOpen,setDrawerOpen]=useState(false)
  const [form,setForm]=useState({customerPoId:preselected,projectCode:'',projectName:'',location:'',startDate:'',targetEndDate:'',notes:''})
  const can=role==='OWNER'||role==='FINANCE'

  async function loadProjects(){
    setLoading(true)
    try{
      const search=new URLSearchParams()
      if(q.trim())search.set('q',q.trim())
      if(poNumber.trim())search.set('poNumber',poNumber.trim())
      if(statusFilter!=='ALL')search.set('status',statusFilter)
      if(clientFilter!=='ALL')search.set('clientId',clientFilter)
      const suffix=search.toString()
      const response=await fetch('/api/projects'+(suffix?'?'+suffix:''),{cache:'no-store'})
      const data=await body(response)
      if(!response.ok)throw new Error(data.error||'Gagal memuat project.')
      setRows(data.projects||[])
    }catch(e){
      setMessage(e instanceof Error?e.message:'Gagal memuat project.')
    }finally{
      setLoading(false)
    }
  }

  async function loadSupportingData(){
    const [b,c]=await Promise.all([
      fetch('/api/customer-pos',{cache:'no-store'}),
      fetch('/api/clients?type=CLIENT',{cache:'no-store'})
    ])
    const [bd,cd]=await Promise.all([body(b),body(c)])
    setPos((bd.customerPOs||[]).filter((x:PO)=>x.status==='VERIFIED'&&!x.project))
    setClients(cd.clients||[])
  }

  useEffect(()=>{void loadSupportingData();void loadProjects()},[])
  useEffect(()=>{
    const timer=window.setTimeout(()=>void loadProjects(),250)
    return()=>window.clearTimeout(timer)
  },[q,poNumber,statusFilter,clientFilter])

  useEffect(()=>{
    if(preselected){
      setForm(f=>({...f,customerPoId:preselected}))
      setDrawerOpen(true)
    }
  },[preselected])

  useEffect(()=>{
    const po=pos.find(x=>x.id===form.customerPoId)
    if(po)setForm(f=>({...f,projectName:po.quotation?.projectName||f.projectName,location:f.location||''}))
  },[form.customerPoId,pos])

  function openCreate(){
    setMessage('')
    setForm(f=>({...f}))
    setDrawerOpen(true)
  }

  function closeCreate(){
    if(busy)return
    setDrawerOpen(false)
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try{
      const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      const d=await body(r)
      if(!r.ok)throw new Error(d.error||'Gagal membuat project.')
      setMessage('Project berhasil dibuat.')
      setDrawerOpen(false)
      setForm({customerPoId:'',projectCode:'',projectName:'',location:'',startDate:'',targetEndDate:'',notes:''})
      await Promise.all([loadProjects(),loadSupportingData()])
    }catch(e){
      setMessage(e instanceof Error?e.message:'Gagal membuat project.')
    }finally{
      setBusy(false)
    }
  }

  const selectedPO=pos.find(x=>x.id===form.customerPoId)
  const activeCount=rows.filter(x=>x.status==='ACTIVE').length
  const plannedCount=rows.filter(x=>x.status==='PLANNED').length
  const filteredContractValue=rows.reduce((s,x)=>s+Number(x.contractValue||0),0)

  return <div className="f-content">
    <PageHeader
      eyebrow="PROJECT PORTFOLIO"
      title="Projects"
      description="Satu daftar kerja untuk memahami project, customer, PO, progress, nilai kontrak, dan status."
      action={<>
        {message&&<span className="f-badge green">{message}</span>}
        {can&&<button className="f-btn primary" type="button" onClick={openCreate}>+ New Project</button>}
      </>}
    />

    <div className="f-project-summary" aria-label="Ringkasan project">
      <span><strong>{rows.length}</strong> project</span>
      <span><strong>{activeCount}</strong> aktif</span>
      <span><strong>{plannedCount}</strong> planned</span>
      <span><strong>{money(filteredContractValue)}</strong> nilai contract</span>
    </div>

    <Card className="f-project-search-card f-section-gap">
      <div className="f-project-search-toolbar">
        <div className="f-project-search-main">
          <label className="f-project-search-box">
            <span>⌕</span>
            <input
              className="f-input"
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Cari project, client, no. PO, quotation, atau lokasi..."
              aria-label="Cari project"
            />
          </label>
          <button className="f-btn" type="button" onClick={()=>setFiltersOpen(v=>!v)}>
            {filtersOpen?'Tutup filter':'Filter'}
          </button>
        </div>
        <div className="f-project-quick-tabs">
          {[
            ['ALL','All'],
            ['ACTIVE','Active'],
            ['ON_HOLD','On Hold'],
            ['COMPLETED','Completed'],
          ].map(([value,label])=><button key={value} className={statusFilter===value?'is-active':''} type="button" onClick={()=>setStatusFilter(value)}>{label}</button>)}
        </div>
      </div>

      {filtersOpen&&<div className="f-project-filter-panel">
        <label>
          <span>No. PO Customer</span>
          <input className="f-input" value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="Contoh: 00077/PO/HU/VIII/2026"/>
        </label>
        <label>
          <span>Client</span>
          <select className="f-select" value={clientFilter} onChange={e=>setClientFilter(e.target.value)}>
            <option value="ALL">Semua client</option>
            {clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select className="f-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PLANNED">PLANNED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ON_HOLD">ON HOLD</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <div className="f-project-filter-actions">
          <button className="f-btn" type="button" onClick={()=>{setQ('');setPoNumber('');setClientFilter('ALL');setStatusFilter('ALL')}}>Reset</button>
        </div>
      </div>}

      {(q||poNumber||clientFilter!=='ALL'||statusFilter!=='ALL')&&<div className="f-project-filter-chips">
        {q&&<button type="button" onClick={()=>setQ('')}>Search: {q} ×</button>}
        {poNumber&&<button type="button" onClick={()=>setPoNumber('')}>PO: {poNumber} ×</button>}
        {clientFilter!=='ALL'&&<button type="button" onClick={()=>setClientFilter('ALL')}>Client: {clients.find(x=>x.id===clientFilter)?.name||clientFilter} ×</button>}
        {statusFilter!=='ALL'&&<button type="button" onClick={()=>setStatusFilter('ALL')}>Status: {statusFilter} ×</button>}
      </div>}
    </Card>

    <Card className="f-section-gap">
      <div className="f-card-head">
        <div><h3>All projects</h3><p>Open a project to see commercial, execution, billing, payment, cost, profitability, and documents in one context.</p></div>
        <span className="f-muted">{loading?'Loading…':rows.length+' result'}</span>
      </div>
      {loading?<div className="f-empty">Memuat project…</div>:rows.length?<div className="f-table-wrap">
        <table className="f-table f-responsive-table f-project-table">
          <thead><tr><th>Project</th><th>Customer</th><th>No. PO</th><th>Progress</th><th>Contract Value</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map(x=>{
              const milestones=x.executionMilestones||[]
              const progress=milestones.length?Math.round(milestones.reduce((sum,m)=>sum+Number(m.progressPct||0),0)/milestones.length):0
              return <tr key={x.id}>
                <td><strong>{x.projectCode}</strong><span className="f-table-sub">{x.projectName}</span><span className="f-table-sub">{x.location||'Lokasi belum ditentukan'}</span></td>
                <td><strong>{x.client.name}</strong><span className="f-table-sub">{x.proposal?.proposalNumber||'No quotation'}</span></td>
                <td>{x.customerPO?<><strong>{x.customerPO.poNumber}</strong><span className="f-table-sub">{x.customerPO.status}</span></>:<span className="f-muted">—</span>}</td>
                <td><div className="f-project-table-progress"><div className="f-project-progress-head"><span>Execution</span><strong>{progress}%</strong></div><div className="f-progress"><span style={{width:String(progress)+'%'}}/></div></div></td>
                <td className="f-number"><strong>{money(Number(x.contractValue))}</strong></td>
                <td><Badge tone={tone(x.status)}>{x.status}</Badge></td>
                <td><a className="f-btn soft" href={'/projects/'+x.id}>Open</a></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>:<div className="f-empty"><strong>Tidak ada project yang cocok</strong><span>Coba ubah pencarian atau reset filter.</span></div>}
    </Card>

    <SideDrawer
      className="f-project-create-drawer"
      open={drawerOpen}
      onClose={closeCreate}
      title="Create project"
      description="Project hanya dibuat dari Customer PO yang sudah VERIFIED dan terhubung ke proposal WON."
      footer={<div className="f-drawer-actions"><button className="f-btn" type="button" onClick={closeCreate} disabled={busy}>Cancel</button><button className="f-btn primary" form="create-project-drawer-form" type="submit" disabled={busy}>{busy?'Creating…':'Create Project'}</button></div>}
    >
      <form id="create-project-drawer-form" className="f-form" onSubmit={save}>
        {selectedPO&&<div className="f-drawer-source">
          <div><span>Source PO</span><strong>{selectedPO.poNumber}</strong></div>
          <div><span>Customer</span><strong>{selectedPO.client.name}</strong></div>
          <div><span>Value</span><strong>{money(Number(selectedPO.grandTotal))}</strong></div>
          <div><span>Proposal</span><strong>{selectedPO.quotation?.proposalNumber||'—'}</strong></div>
        </div>}
        <label>PO Verified
          <select className="f-input" value={form.customerPoId} onChange={e=>setForm(f=>({...f,customerPoId:e.target.value}))} required>
            <option value="">Pilih PO Verified</option>
            {pos.map(p=><option key={p.id} value={p.id}>{p.poNumber+' — '+p.client.name+' — '+money(Number(p.grandTotal))}</option>)}
          </select>
        </label>
        <label>Kode project
          <input className="f-input" value={form.projectCode} onChange={e=>setForm(f=>({...f,projectCode:e.target.value}))} placeholder="FIN-PROJ-2026-001" required />
        </label>
        <label>Nama project
          <input className="f-input" value={form.projectName} onChange={e=>setForm(f=>({...f,projectName:e.target.value}))} placeholder="Nama project" required />
        </label>
        <label>Lokasi
          <input className="f-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Lokasi pekerjaan" />
        </label>
        <div className="f-form-grid">
          <label>Mulai
            <input type="date" className="f-input" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} />
          </label>
          <label>Target selesai
            <input type="date" className="f-input" value={form.targetEndDate} onChange={e=>setForm(f=>({...f,targetEndDate:e.target.value}))} />
          </label>
        </div>
        <label>Catatan
          <textarea className="f-input" rows={4} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Catatan internal project, scope, atau konteks awal." />
        </label>
        <div className="f-inline-alert">Setelah dibuat, Finora otomatis menyiapkan snapshot BOQ, execution foundation, dan contract version awal dari PO ini.</div>
      </form>
    </SideDrawer>
  </div>
}
