'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Card, StatCard, money } from '@/components/finora-ui'

type Billing = {
  id: string; sequence: number; name: string; percentage: any; amount: any; plannedDate?: string|null; status: string; displayStatus?: string; notes?: string|null;
  invoice?: { id:string; invoiceNumber:string; status:string; dueDate?: string; totalAmount:any }|null
}
type Payment = {
  id: string; sequence: number; name: string; percentage:any; amount:any; dueDate?: string|null; status:string; displayStatus?: string; notes?: string|null;
  billingMilestone?: { id:string; sequence:number; name:string; status:string }|null
  actual?: { invoiceId:string; invoiceNumber:string; invoiceStatus:string; paidAmount:number; outstandingAmount:number }|null
}

type Props = { projectId:string; contractValue:number; role:string }

async function json(r:Response){ try{return await r.json()}catch{return {}} }
function tone(status:string){
  return ['BILLED','PAID'].includes(status)?'green':['CANCELLED','OVERDUE'].includes(status)?'red':['READY','DUE','PARTIAL'].includes(status)?'amber':'blue'
}
function pct(rows:{percentage:any}[]){return rows.reduce((s,r)=>s+Number(r.percentage||0),0)}

export default function ProjectMilestoneManager({projectId,contractValue,role}:Props){
  const can=role==='OWNER'||role==='FINANCE'
  const router=useRouter()
  const [billing,setBilling]=useState<Billing[]>([])
  const [payment,setPayment]=useState<Payment[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [bForm,setBForm]=useState({name:'',percentage:'',plannedDate:'',notes:''})
  const [pForm,setPForm]=useState({name:'',percentage:'',dueDate:'',billingMilestoneId:'',notes:''})

  async function load(){
    const [b,p]=await Promise.all([fetch(`/api/projects/${projectId}/billing-milestones`),fetch(`/api/projects/${projectId}/payment-milestones`)])
    const [bd,pd]=await Promise.all([json(b),json(p)])
    setBilling(bd.billingMilestones||[]); setPayment(pd.paymentMilestones||[])
  }
  useEffect(()=>{load()},[projectId])

  const billingTotal=pct(billing), paymentTotal=pct(payment)
  const billingAmount=billing.reduce((s,r)=>s+Number(r.amount||0),0)
  const paymentAmount=payment.reduce((s,r)=>s+Number(r.amount||0),0)
  const remainingBilling=Math.max(0,100-billingTotal), remainingPayment=Math.max(0,100-paymentTotal)
  const previewB=Number(bForm.percentage||0)>0?contractValue*Number(bForm.percentage)/100:0
  const previewP=Number(pForm.percentage||0)>0?contractValue*Number(pForm.percentage)/100:0

  async function create(kind:'billing'|'payment',e:React.FormEvent){
    e.preventDefault(); setBusy(true); setMessage('')
    try{
      const form=kind==='billing'?bForm:pForm
      const body=kind==='billing'?{...form,percentage:Number(form.percentage)}:{...form,percentage:Number(form.percentage)}
      const r=await fetch(`/api/projects/${projectId}/${kind==='billing'?'billing-milestones':'payment-milestones'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const d=await json(r); if(!r.ok) throw new Error(d.error||'Gagal membuat milestone.')
      setMessage(`${kind==='billing'?'Billing':'Payment'} milestone berhasil dibuat.`)
      if(kind==='billing') setBForm({name:'',percentage:'',plannedDate:'',notes:''})
      else setPForm({name:'',percentage:'',dueDate:'',billingMilestoneId:'',notes:''})
      await load()
    }catch(e){setMessage(e instanceof Error?e.message:'Gagal membuat milestone.')}finally{setBusy(false)}
  }

  async function remove(kind:'billing'|'payment',id:string){
    if(!confirm('Hapus milestone PLANNED ini?')) return
    setBusy(true); setMessage('')
    try{const r=await fetch(`/api/projects/${projectId}/${kind}-milestones/${id}`,{method:'DELETE'});const d=await json(r);if(!r.ok)throw new Error(d.error||'Gagal menghapus milestone.');setMessage('Milestone dihapus.');await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal menghapus milestone.')}finally{setBusy(false)}
  }

  async function setStatus(kind:'billing'|'payment',id:string,status:string){
    setBusy(true); setMessage('')
    try{const r=await fetch(`/api/projects/${projectId}/${kind}-milestones/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const d=await json(r);if(!r.ok)throw new Error(d.error||'Gagal mengubah status.');setMessage(`Milestone menjadi ${status}.`);await load();router.refresh()}catch(e){setMessage(e instanceof Error?e.message:'Gagal mengubah status.')}finally{setBusy(false)}
  }


  async function createInvoice(milestoneId:string){
    setBusy(true); setMessage('')
    try{
      const r=await fetch(`/api/projects/${projectId}/billing-milestones/${milestoneId}/invoice`,{method:'POST'})
      const d=await json(r); if(!r.ok) throw new Error(d.error||'Gagal membuat invoice dari billing milestone.')
      setMessage(`Invoice ${d.invoice?.invoiceNumber||''} berhasil dibuat.`); await load(); router.refresh()
    }catch(e){setMessage(e instanceof Error?e.message:'Gagal membuat invoice.')}finally{setBusy(false)}
  }

  const linkedBillingIds = useMemo(()=>new Set(payment.map(x=>x.billingMilestone?.id).filter(Boolean) as string[]),[payment])
  const billingOptions = useMemo(()=>billing.filter(x=>(x.displayStatus||x.status)!=='CANCELLED'&&!linkedBillingIds.has(x.id)),[billing,linkedBillingIds])
  const selectedBilling = useMemo(()=>billing.find(x=>x.id===pForm.billingMilestoneId),[billing,pForm.billingMilestoneId])

  return <div className="f-section-gap f-milestone-manager" id="billing-payment">
    {message&&<div className="f-inline-alert success f-milestone-alert">{message}</div>}

    <div className="f-grid-4 f-milestone-kpis">
      <StatCard label="Billing schedule" value={`${billingTotal.toFixed(2)}%`} icon="▤" />
      <StatCard label="Planned billing" value={money(billingAmount)} icon="Rp" />
      <StatCard label="Payment schedule" value={`${paymentTotal.toFixed(2)}%`} icon="◷" />
      <StatCard label="Planned payment" value={money(paymentAmount)} icon="Rp" />
    </div>
    <div className="f-inline-alert info f-milestone-semantics"><strong>Catatan:</strong> schedule menunjukkan rencana. <strong>Billed</strong> berasal dari invoice aktual, sedangkan <strong>Paid / Partial / Overdue</strong> mengikuti transaksi pembayaran aktual.</div>

    <div className="f-milestone-panels">
      <Card className="f-milestone-card">
        <div className="f-card-head f-milestone-card-head">
          <div className="f-milestone-head-copy">
            <div className="f-milestone-kicker">01 · PENAGIHAN CUSTOMER</div>
            <h3>Billing milestone</h3>
            <p>Rencanakan kapan invoice/tagihan diterbitkan. Nominal dihitung otomatis dari nilai kontrak project.</p>
          </div>
          <div className="f-milestone-head-side">
            <Badge tone={billingTotal>=99.99?'green':'amber'}>{remainingBilling.toFixed(2)}% tersisa</Badge>
            <span>{money(contractValue)} nilai kontrak</span>
          </div>
        </div>

        {can&&<form className="f-form f-milestone-form" onSubmit={e=>create('billing',e)}>
          <div className="f-milestone-form-grid billing">
            <label className="span-5">
              <span>Nama milestone</span>
              <input className="f-input" value={bForm.name} onChange={e=>setBForm(f=>({...f,name:e.target.value}))} placeholder="Contoh: DP / Progress 50% / Serah terima" />
              <small>Gunakan nama yang mudah dikenali saat nanti membuat invoice.</small>
            </label>
            <label className="span-2">
              <span>Persentase</span>
              <div className="f-percent-input"><input className="f-input" type="number" min="0.01" max="100" step="0.01" value={bForm.percentage} onChange={e=>setBForm(f=>({...f,percentage:e.target.value}))} placeholder="30" /><em>%</em></div>
              <small>Sisa: {remainingBilling.toFixed(2)}%</small>
            </label>
            <label className="span-2">
              <span>Tanggal rencana</span>
              <input className="f-input" type="date" value={bForm.plannedDate} onChange={e=>setBForm(f=>({...f,plannedDate:e.target.value}))} />
              <small>Kapan tagihan direncanakan.</small>
            </label>
            <label className="span-3 f-readonly-field">
              <span>Nilai otomatis</span>
              <input className="f-input" readOnly value={previewB?money(previewB):'—'} />
              <small>Kontrak × persentase.</small>
            </label>
            <label className="span-9">
              <span>Catatan</span>
              <textarea className="f-input" rows={2} value={bForm.notes} onChange={e=>setBForm(f=>({...f,notes:e.target.value}))} placeholder="Syarat tagihan, dokumen pendukung, atau milestone pekerjaan." />
            </label>
            <div className="f-milestone-form-actions span-3">
              <button className="f-btn primary" disabled={busy||!bForm.name||!bForm.percentage}>Tambah billing</button>
            </div>
          </div>
        </form>}

        <div className="f-milestone-list-head">
          <div><strong>Billing schedule</strong><span>{billing.length} milestone</span></div>
          <span>Total {billingTotal.toFixed(2)}% planned</span>
        </div>
        <div className="f-milestone-list">
          {billing.map(x=><div key={x.id} className="f-milestone-row">
            <div className="f-milestone-row-main">
              <div className="f-milestone-row-title"><span className="f-milestone-number">#{x.sequence}</span><strong>{x.name}</strong></div>
              <div className="f-milestone-meta">
                <span>{Number(x.percentage).toFixed(2)}%</span>
                <span>{money(Number(x.amount))}</span>
                {x.plannedDate&&<span>{new Date(x.plannedDate).toLocaleDateString('id-ID')}</span>}
                {x.invoice&&<span>Invoice {x.invoice.invoiceNumber} · {x.invoice.status}</span>}
              </div>
            </div>
            <div className="f-milestone-row-actions">
              <Badge tone={tone(x.displayStatus||x.status)}>{x.displayStatus||x.status}</Badge>
              {can&&(x.displayStatus||x.status)==='PLANNED'&&<button className="f-btn soft" disabled={busy} onClick={()=>setStatus('billing',x.id,'READY')}>Siap tagih</button>}
              {can&&(x.displayStatus||x.status)==='READY'&&!x.invoice&&<button className="f-btn primary" disabled={busy} onClick={()=>createInvoice(x.id)}>Buat invoice</button>}
              {x.invoice&&<a className="f-btn" href="/invoices">Invoice {x.invoice.invoiceNumber}</a>}
              {can&&x.status==='PLANNED'&&<button className="f-btn" disabled={busy} onClick={()=>remove('billing',x.id)}>Hapus</button>}
            </div>
          </div>)}
          {!billing.length&&<div className="f-empty f-milestone-empty"><strong>Belum ada billing milestone</strong><span>Tambahkan tahapan penagihan untuk project ini.</span></div>}
        </div>
        <div className="f-milestone-footnote">Status <strong>PLANNED</strong> dapat ditandai <strong>READY</strong>. Setelah invoice dibuat, status billing menjadi <strong>BILLED</strong> dan setelah invoice lunas menjadi <strong>PAID</strong>.</div>
      </Card>

      <Card className="f-milestone-card">
        <div className="f-card-head f-milestone-card-head">
          <div className="f-milestone-head-copy">
            <div className="f-milestone-kicker">02 · PENERIMAAN KAS</div>
            <h3>Payment milestone</h3>
            <p>Rencanakan kapan pembayaran customer diperkirakan masuk. Hubungkan ke billing agar hubungan tagihan dan penerimaan mudah ditelusuri.</p>
          </div>
          <div className="f-milestone-head-side">
            <Badge tone={paymentTotal>=99.99?'green':'amber'}>{remainingPayment.toFixed(2)}% tersisa</Badge>
            <span>{money(contractValue)} nilai kontrak</span>
          </div>
        </div>

        {can&&<form className="f-form f-milestone-form" onSubmit={e=>create('payment',e)}>
          <div className="f-milestone-form-grid payment">
            <label className="span-5">
              <span>Nama milestone</span>
              <input className="f-input" value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="Contoh: Pembayaran DP / Termin 2 / Pelunasan" />
              <small>Gunakan nama pembayaran yang mudah dibaca owner/finance.</small>
            </label>
            <label className="span-2">
              <span>Persentase</span>
              <div className={`f-percent-input${selectedBilling?' is-locked':''}`}><input className="f-input" type="number" min="0.01" max="100" step="0.01" value={pForm.percentage} onChange={e=>setPForm(f=>({...f,percentage:e.target.value}))} placeholder="30" disabled={Boolean(selectedBilling)} /><em>%</em></div>
              <small>{selectedBilling ? `Mengikuti billing ${selectedBilling.sequence}: ${Number(selectedBilling.percentage).toFixed(2)}%.` : `Sisa: ${remainingPayment.toFixed(2)}%`}</small>
            </label>
            <label className="span-2">
              <span>Jatuh tempo</span>
              <input className="f-input" type="date" value={pForm.dueDate} onChange={e=>setPForm(f=>({...f,dueDate:e.target.value}))} />
              <small>Kapan pembayaran diharapkan.</small>
            </label>
            <label className="span-3 f-readonly-field">
              <span>Nilai otomatis</span>
              <input className="f-input" readOnly value={previewP?money(previewP):'—'} />
              <small>Kontrak × persentase.</small>
            </label>
            <label className="span-6">
              <span>Hubungkan billing</span>
              <select className="f-input" value={pForm.billingMilestoneId} onChange={e=>{const id=e.target.value; const linked=billing.find(x=>x.id===id); setPForm(f=>({...f,billingMilestoneId:id,percentage:linked?Number(linked.percentage).toString():f.percentage}))}}>
                <option value="">{billingOptions.length?'Tidak dihubungkan':'Semua billing sudah terhubung'}</option>
                {billingOptions.map(x=><option key={x.id} value={x.id}>#{x.sequence} {x.name} ({Number(x.percentage).toFixed(2)}%)</option>)}
              </select>
              <small>{billingOptions.length ? 'Satu billing hanya dapat dihubungkan ke satu payment milestone.' : 'Tidak ada billing yang masih tersedia untuk dihubungkan.'}</small>
            </label>
            <label className="span-6">
              <span>Catatan</span>
              <textarea className="f-input" rows={2} value={pForm.notes} onChange={e=>setPForm(f=>({...f,notes:e.target.value}))} placeholder="Contoh: 14 hari setelah invoice diterbitkan." />
            </label>
            <div className="f-milestone-form-actions span-12">
              <button className="f-btn primary" disabled={busy||!pForm.name||!pForm.percentage}>Tambah payment</button>
            </div>
          </div>
        </form>}

        <div className="f-milestone-list-head">
          <div><strong>Payment schedule</strong><span>{payment.length} milestone</span></div>
          <span>Total {paymentTotal.toFixed(2)}% planned</span>
        </div>
        <div className="f-milestone-list">
          {payment.map(x=><div key={x.id} className="f-milestone-row">
            <div className="f-milestone-row-main">
              <div className="f-milestone-row-title"><span className="f-milestone-number">#{x.sequence}</span><strong>{x.name}</strong></div>
              <div className="f-milestone-meta">
                <span>{Number(x.percentage).toFixed(2)}%</span>
                <span>{money(Number(x.amount))}</span>
                {x.dueDate&&<span>Jatuh tempo {new Date(x.dueDate).toLocaleDateString('id-ID')}</span>}
                {x.billingMilestone&&<span>Billing #{x.billingMilestone.sequence}: {x.billingMilestone.name}</span>}
              </div>
            </div>
            <div className="f-milestone-row-actions">
              <Badge tone={tone(x.displayStatus||x.status)}>{x.displayStatus||x.status}</Badge>
              {x.actual&&<span className="f-muted">Collected {money(x.actual.paidAmount)} · Sisa {money(x.actual.outstandingAmount)}</span>}
              {can&&(x.displayStatus||x.status)==='PLANNED'&&<button className="f-btn soft" disabled={busy} onClick={()=>setStatus('payment',x.id,'DUE')}>Jatuh tempo</button>}
              {can&&(x.displayStatus||x.status)==='PLANNED'&&<button className="f-btn" disabled={busy} onClick={()=>remove('payment',x.id)}>Hapus</button>}
            </div>
          </div>)}
          {!payment.length&&<div className="f-empty f-milestone-empty"><strong>Belum ada payment milestone</strong><span>Tambahkan jadwal penerimaan kas untuk project ini.</span></div>}
        </div>
        <div className="f-milestone-footnote">Status <strong>PLANNED</strong> dapat ditandai <strong>DUE</strong>. Setelah invoice menerima pembayaran, status akan mengikuti actual collection: <strong>PARTIAL</strong>, <strong>PAID</strong>, atau <strong>OVERDUE</strong>.</div>
      </Card>
    </div>
  </div>
}
