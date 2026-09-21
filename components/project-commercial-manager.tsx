'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'

type PO = { id:string; poNumber:string; poDate:string; receivedDate:string; status:string; totalAmount:any; taxAmount:any; grandTotal:any; overheadAmount?:any; roundingAmount?:any; roundedGrandTotal?:any; commercialVarianceAmount?:any; commercialVarianceReason?:string|null; reference?:string|null; remarks?:string|null; client:{id:string;name:string}; quotation?:{id:string;proposalNumber:string;projectName?:string|null;status:string}|null; project?:{id:string;projectCode:string;projectName:string;status:string}|null }
type Project = { id:string; projectCode:string; projectName:string; location?:string|null; status:string; contractValue:any; client:{id:string;name:string}; proposal?:{proposalNumber:string;status:string}|null; customerPO?:{poNumber:string;status:string;grandTotal:any}|null; executionMilestones?:{sequence:number;code:string;name:string;status:string;progressPct:any;plannedDate?:string|null;actualDate?:string|null}[] }
type Client = { id:string; name:string; type:string }
type Proposal = { id:string; proposalNumber:string; status:string; projectName?:string|null; client:Client; subtotalAmount:any; taxAmount:any; totalAmount:any; roundedTotalAmount?:any; overheadAmount?:any; roundingAmount?:any; taxIncluded?:boolean; quotationReference?:string|null }
async function body(r:Response){try{return await r.json()}catch{return {}}}
function tone(s:string){return s==='VERIFIED'||s==='ACTIVE'||s==='COMPLETED'?'green':s==='REJECTED'||s==='CANCELLED'?'red':s==='RECEIVED'||s==='PLANNED'?'amber':'blue'}

export function CustomerPOManager({role}:{role:string}){
  const params=useSearchParams(); const preselected=params.get('quotationId')||''
  const [rows,setRows]=useState<PO[]>([]),[clients,setClients]=useState<Client[]>([]),[proposals,setProposals]=useState<Proposal[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [form,setForm]=useState({clientId:'',quotationId:preselected,poNumber:'',poDate:new Date().toISOString().slice(0,10),receivedDate:new Date().toISOString().slice(0,10),reference:'',subtotalAmount:'',taxAmount:'0',overheadAmount:'0',roundingAmount:'0',dpPercent:'50',dpDueDays:'7',progressPercent:'45',progressTrigger:'FAT_AND_PRE_DELIVERY',retentionPercent:'5',retentionMonths:'2',commercialVarianceReason:'',remarks:''})
  const can=role==='OWNER'||role==='FINANCE'
  async function load(){const [a,b,c]=await Promise.all([fetch('/api/customer-pos'),fetch('/api/clients?type=CLIENT'),fetch('/api/proposals')]);const [ad,bd,cd]=await Promise.all([body(a),body(b),body(c)]);setRows(ad.customerPOs||[]);setClients(bd.clients||[]);setProposals((cd.proposals||[]).filter((x:Proposal)=>x.status==='WON'))}
  useEffect(()=>{load()},[])
  useEffect(()=>{if(preselected)setForm(f=>({...f,quotationId:preselected}))},[preselected])
  useEffect(()=>{const p=proposals.find(x=>x.id===form.quotationId);if(p){setForm(f=>({...f,clientId:p.client.id,subtotalAmount:String(Number(p.subtotalAmount||0)),taxAmount:String(Number(p.taxAmount||0)),overheadAmount:String(Number(p.overheadAmount||0)),roundingAmount:String(Number(p.roundingAmount||0)),commercialVarianceReason:'',reference:p.quotationReference||f.reference}))}},[form.quotationId,proposals])
  function update(k:string,v:string){setForm(f=>({...f,[k]:v}))}
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/customer-pos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,subtotalAmount:Number(form.subtotalAmount),taxAmount:Number(form.taxAmount),overheadAmount:Number(form.overheadAmount||0),roundingAmount:Number(form.roundingAmount||0),grandTotal:Number(form.subtotalAmount||0)+Number(form.taxAmount||0)+Number(form.overheadAmount||0)+Number(form.roundingAmount||0),paymentTermsSnapshot:{stages:[{name:'DP',percentage:Number(form.dpPercent||0),trigger:'PO_RELEASED',dueDays:Number(form.dpDueDays||0)},{name:'Progress',percentage:Number(form.progressPercent||0),trigger:form.progressTrigger},{name:'Retention',percentage:Number(form.retentionPercent||0),trigger:'RETENTION_END',retentionMonths:Number(form.retentionMonths||0)}]}})});const d=await body(r);if(!r.ok)throw new Error(d.error||'Gagal menyimpan PO.');setMessage('PO customer berhasil dicatat.');setForm(f=>({...f,poNumber:'',reference:'',subtotalAmount:'',taxAmount:'0',overheadAmount:'0',roundingAmount:'0',dpPercent:'50',dpDueDays:'7',progressPercent:'45',progressTrigger:'FAT_AND_PRE_DELIVERY',retentionPercent:'5',retentionMonths:'2',commercialVarianceReason:'',remarks:''}));await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan PO.')}finally{setBusy(false)}}
  async function setStatus(id:string,status:string){setBusy(true);setMessage('');try{const r=await fetch(`/api/customer-pos/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const d=await body(r);if(!r.ok)throw new Error(d.error||'Gagal memperbarui PO.');setMessage(`PO menjadi ${status}.`);await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal.')}finally{setBusy(false)}}
  const selectedProposal = proposals.find(x=>x.id===form.quotationId)
  const formGrandTotal = (Number(form.subtotalAmount)||0)+(Number(form.taxAmount)||0)+(Number(form.overheadAmount)||0)+(Number(form.roundingAmount)||0)
  const quotationGrandTotal = Number(selectedProposal?.roundedTotalAmount ?? selectedProposal?.totalAmount ?? 0)
  const commercialVariance = formGrandTotal - quotationGrandTotal
  const hasVariance = Math.abs(commercialVariance) > 0.009
  return <div className="f-content"><PageHeader eyebrow="COMMERCIAL / PURCHASE ORDER" title="PO Customer" description="Catat PO yang diterima dari customer dan hubungkan ke quotation yang sudah disetujui." action={message&&<span className="f-badge green">{message}</span>} />
    <div className="f-grid-4"><StatCard label="Total PO" value={rows.length} icon="▤"/><StatCard label="Verified" value={rows.filter(x=>x.status==='VERIFIED').length} icon="✓"/><StatCard label="Belum diverifikasi" value={rows.filter(x=>x.status==='RECEIVED').length} icon="!"/><StatCard label="Nilai PO" value={money(rows.reduce((s,x)=>s+Number(x.grandTotal||0),0))} icon="Rp"/></div>
    {can&&<Card className="f-section-gap"><div className="f-card-head"><div><h3>Catat PO customer</h3><p>Gunakan PO customer sebagai konfirmasi order sebelum project dibuat.</p></div></div><form className="f-form" onSubmit={save}><div className="f-form-grid"><label>Proposal WON<select className="f-input" value={form.quotationId} onChange={e=>update('quotationId',e.target.value)}><option value="">Pilih proposal WON</option>{proposals.map(p=><option key={p.id} value={p.id}>{p.proposalNumber} — {p.client.name}</option>)}</select></label><label>Klien<select className="f-input" value={form.clientId} onChange={e=>update('clientId',e.target.value)}><option value="">Pilih klien</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Nomor PO<input className="f-input" value={form.poNumber} onChange={e=>update('poNumber',e.target.value)} placeholder="PO-2026-001" /></label><label>Tanggal PO<input type="date" className="f-input" value={form.poDate} onChange={e=>update('poDate',e.target.value)} /></label><label>Diterima<input type="date" className="f-input" value={form.receivedDate} onChange={e=>update('receivedDate',e.target.value)} /></label><label>Reference<input className="f-input" value={form.reference} onChange={e=>update('reference',e.target.value)} placeholder="Nomor quotation customer" /></label><label>Subtotal PO<input className="f-input" inputMode="numeric" value={form.subtotalAmount} onChange={e=>update('subtotalAmount',e.target.value)} /></label><label>PPN PO<input className="f-input" inputMode="numeric" value={form.taxAmount} onChange={e=>update('taxAmount',e.target.value)} /></label><label>Overhead<input className="f-input" inputMode="numeric" value={form.overheadAmount} onChange={e=>update('overheadAmount',e.target.value)} /></label><label>Rounding adjustment<input className="f-input" inputMode="numeric" value={form.roundingAmount} onChange={e=>update('roundingAmount',e.target.value)} /></label><label>Grand total PO<input className="f-input" inputMode="numeric" value={String(formGrandTotal)} readOnly /></label><div className="f-inline-alert" style={{gridColumn:'1/-1'}}><strong>Payment terms terstruktur</strong></div><label>DP (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.dpPercent} onChange={e=>update('dpPercent',e.target.value)} /></label><label>DP due days<input className="f-input" type="number" min="0" value={form.dpDueDays} onChange={e=>update('dpDueDays',e.target.value)} /></label><label>Progress (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.progressPercent} onChange={e=>update('progressPercent',e.target.value)} /></label><label>Progress trigger<input className="f-input" value={form.progressTrigger} onChange={e=>update('progressTrigger',e.target.value)} /></label><label>Retention (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.retentionPercent} onChange={e=>update('retentionPercent',e.target.value)} /></label><label>Retention (bulan)<input className="f-input" type="number" min="0" value={form.retentionMonths} onChange={e=>update('retentionMonths',e.target.value)} /></label>{selectedProposal&&<div className="f-inline-alert" style={{gridColumn:'1/-1'}}><strong>Snapshot proposal:</strong> {money(Number(selectedProposal.subtotalAmount))} + {money(Number(selectedProposal.taxAmount))} = <strong>{money(Number(selectedProposal.roundedTotalAmount ?? selectedProposal.totalAmount))}</strong>. Nilai PO berbeda harus dijelaskan dan akan dicatat sebagai commercial variance.</div>}{hasVariance&&<label className="full">Alasan commercial variance <textarea className="f-input" rows={3} required value={form.commercialVarianceReason} onChange={e=>update('commercialVarianceReason',e.target.value)} placeholder="Contoh: Customer PO final berbeda karena scope disepakati ulang setelah negosiasi." /></label>}<label className="full">Catatan<textarea className="f-input" rows={3} value={form.remarks} onChange={e=>update('remarks',e.target.value)} /></label></div><div className="f-actions"><button className="f-btn primary" disabled={busy}>Simpan PO</button></div></form></Card>}
    <Card className="f-section-gap"><div className="f-card-head"><div><h3>Daftar PO customer</h3><p>PO menjadi sumber konfirmasi sebelum project dibuat.</p></div></div><div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>PO</th><th>Klien</th><th>Referensi</th><th>Tanggal</th><th>Nilai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.poNumber}</strong></td><td>{x.client.name}</td><td>{x.quotation?.proposalNumber||x.reference||'—'}</td><td>{new Date(x.poDate).toLocaleDateString('id-ID')}</td><td className="f-number">{money(Number(x.grandTotal))}</td><td><Badge tone={tone(x.status)}>{x.status}</Badge></td><td><div className="f-actions">{x.status==='RECEIVED'&&can&&<><button className="f-btn soft" disabled={busy} onClick={()=>setStatus(x.id,'VERIFIED')}>Verifikasi</button><button className="f-btn" disabled={busy} onClick={()=>setStatus(x.id,'REJECTED')}>Tolak</button></>}{x.status==='VERIFIED'&&can&&!x.project&&<><button className="f-btn" disabled={busy} onClick={()=>setStatus(x.id,'CANCELLED')}>Batalkan</button><a className="f-btn primary" href={`/projects?customerPoId=${x.id}`}>Buat Project</a></>}{x.project&&<a className="f-btn soft" href={`/projects/${x.project.id}`}>Lihat Project</a>}</div></td></tr>)}</tbody></table></div>{!rows.length&&<div className="f-empty"><strong>Belum ada PO customer</strong>Catat PO dari proposal yang sudah WON.</div>}</Card>
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
  const [form,setForm]=useState({customerPoId:preselected,projectCode:'',projectName:'',location:'',startDate:'',targetEndDate:'',notes:''})
  const can=role==='OWNER'||role==='FINANCE'

  async function load(){
    const [a,b,c]=await Promise.all([
      fetch('/api/projects',{cache:'no-store'}),
      fetch('/api/customer-pos',{cache:'no-store'}),
      fetch('/api/clients?type=CLIENT',{cache:'no-store'})
    ])
    const [ad,bd,cd]=await Promise.all([body(a),body(b),body(c)])
    setRows(ad.projects||[])
    setPos((bd.customerPOs||[]).filter((x:PO)=>x.status==='VERIFIED'&&!x.project))
    setClients(cd.clients||[])
  }

  useEffect(()=>{load()},[])
  useEffect(()=>{if(preselected)setForm(f=>({...f,customerPoId:preselected}))},[preselected])

  useEffect(()=>{
    const po=pos.find(x=>x.id===form.customerPoId)
    if(po)setForm(f=>({...f,projectName:po.quotation?.projectName||f.projectName,location:f.location}))
  },[form.customerPoId,pos])

  async function save(e:React.FormEvent){
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try{
      const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      const d=await body(r)
      if(!r.ok)throw new Error(d.error||'Gagal membuat project.')
      setMessage('Project berhasil dibuat.')
      setForm(f=>({...f,customerPoId:'',projectCode:'',projectName:'',location:'',startDate:'',targetEndDate:'',notes:''}))
      await load()
    }catch(e){
      setMessage(e instanceof Error?e.message:'Gagal membuat project.')
    }finally{
      setBusy(false)
    }
  }

  const visibleRows=rows.filter(x=>{
    const haystack=[
      x.projectCode,
      x.projectName,
      x.location||'',
      x.client.name,
      x.customerPO?.poNumber||'',
      x.proposal?.proposalNumber||''
    ].join(' ').toLowerCase()
    const matchesSearch=!q.trim()||haystack.includes(q.trim().toLowerCase())
    const matchesPO=!poNumber.trim()||(x.customerPO?.poNumber||'').toLowerCase().includes(poNumber.trim().toLowerCase())
    const matchesStatus=statusFilter==='ALL'||x.status===statusFilter
    const matchesClient=clientFilter==='ALL'||x.client.id===clientFilter
    return matchesSearch&&matchesPO&&matchesStatus&&matchesClient
  })

  const filteredContractValue=visibleRows.reduce((s,x)=>s+Number(x.contractValue||0),0)
  const filteredProgress=visibleRows.length?Math.round(visibleRows.reduce((sum,x)=>{
    const milestones=x.executionMilestones||[]
    return sum+(milestones.length?milestones.reduce((mSum,m)=>mSum+Number(m.progressPct||0),0)/milestones.length:0)
  },0)/visibleRows.length):0

  return <div className="f-content">
    <PageHeader
      eyebrow="PROJECT PORTFOLIO"
      title="Projects"
      description="Cari dan kelola project berdasarkan identitas commercial, customer, PO, progress, dan status lifecycle."
      action={can?<button className="f-btn primary" onClick={()=>document.getElementById('create-project-form')?.scrollIntoView({behavior:'smooth',block:'start'})}>+ Create Project</button>:undefined}
    />

    <div className="f-grid-4">
      <StatCard label="Projects" value={visibleRows.length} trend={rows.length===visibleRows.length?'Seluruh portfolio':'Hasil filter saat ini'} icon="▤"/>
      <StatCard label="Active" value={visibleRows.filter(x=>x.status==='ACTIVE').length} trend="Lifecycle aktif" icon="↗"/>
      <StatCard label="Contract value" value={money(filteredContractValue)} trend="Nilai contract hasil filter" icon="Rp"/>
      <StatCard label="Avg. progress" value={filteredProgress+'%'} trend="Rata-rata execution progress" icon="◷"/>
    </div>

    <Card className="f-section-gap f-project-search-card">
      <div className="f-project-search-toolbar">
        <div className="f-project-search-main">
          <div className="f-project-search-title">
            <div>
              <strong>Project portfolio</strong>
              <span>{visibleRows.length} dari {rows.length} project</span>
            </div>
          </div>
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

    {can&&<Card id="create-project-form" className="f-section-gap">
      <div className="f-card-head"><div><h3>Buat project dari PO</h3><p>Project memakai nilai kontrak dari grand total PO dan referensi quotation otomatis.</p></div></div>
      <form className="f-form" onSubmit={save}>
        <div className="f-form-grid">
          <label>PO Verified<select className="f-input" value={form.customerPoId} onChange={e=>setForm(f=>({...f,customerPoId:e.target.value}))}><option value="">Pilih PO</option>{pos.map(p=><option key={p.id} value={p.id}>{p.poNumber} — {p.client.name} — {money(Number(p.grandTotal))}</option>)}</select></label>
          <label>Kode project<input className="f-input" value={form.projectCode} onChange={e=>setForm(f=>({...f,projectCode:e.target.value}))} placeholder="BSM-2026-001" /></label>
          <label>Nama project<input className="f-input" value={form.projectName} onChange={e=>setForm(f=>({...f,projectName:e.target.value}))} /></label>
          <label>Lokasi<input className="f-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} /></label>
          <label>Mulai<input type="date" className="f-input" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></label>
          <label>Target selesai<input type="date" className="f-input" value={form.targetEndDate} onChange={e=>setForm(f=>({...f,targetEndDate:e.target.value}))} /></label>
          <label className="full">Catatan<textarea className="f-input" rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>
        </div>
        <div className="f-actions"><button className="f-btn primary" disabled={busy}>Buat Project</button></div>
      </form>
    </Card>}

    <Card className="f-section-gap">
      <div className="f-card-head">
        <div><h3>Daftar project</h3><p>Project adalah unit kerja utama untuk execution, billing, payment, cost, profitability, dan documents.</p></div>
      </div>
      {visibleRows.length?<div className="f-table-wrap">
        <table className="f-table f-project-table">
          <thead><tr><th>Project</th><th>Client</th><th>No. PO Customer</th><th>Progress</th><th>Contract Value</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {visibleRows.map(x=>{
              const milestones=x.executionMilestones||[]
              const progress=milestones.length?Math.round(milestones.reduce((sum,m)=>sum+Number(m.progressPct||0),0)/milestones.length):0
              return <tr key={x.id}>
                <td><strong>{x.projectCode}</strong><span className="f-table-sub">{x.projectName}</span><span className="f-table-sub">{x.location||'Lokasi belum ditentukan'}</span></td>
                <td><strong>{x.client.name}</strong></td>
                <td>{x.customerPO?<><strong>{x.customerPO.poNumber}</strong><span className="f-table-sub">{x.customerPO.status}</span></>:<span className="f-muted">—</span>}</td>
                <td><div className="f-project-table-progress"><div className="f-project-progress-head"><span>Execution</span><strong>{progress}%</strong></div><div className="f-progress"><span style={{width:`${progress}%`}}/></div></div></td>
                <td className="f-number"><strong>{money(Number(x.contractValue))}</strong></td>
                <td><Badge tone={tone(x.status)}>{x.status}</Badge></td>
                <td><a className="f-btn soft" href={`/projects/${x.id}`}>Detail</a></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>:<div className="f-empty"><strong>Tidak ada project yang cocok</strong><span>Coba ubah pencarian atau reset filter.</span></div>}
    </Card>
  </div>
}
