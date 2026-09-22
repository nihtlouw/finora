'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import { SideDrawer } from '@/components/finora-side-drawer'
import { createPortal } from 'react-dom'
import MidtransPaymentButton from '@/components/midtrans-payment-button'

type Client={id:string;name:string;type:string}
type Proposal={id:string;proposalNumber:string;status:string;quotationReference?:string|null;projectName?:string|null;projectLocation?:string|null;scopeSummary?:string|null;subtotalAmount:any;discountPercent:any;discountAmount:any;taxPercent:any;taxAmount:any;totalAmount:any;roundedTotalAmount?:any;overheadAmount?:any;roundingAmount?:any;taxIncluded?:boolean;termsAndConditions?:string|null;validUntil:string;client:Client;items:any[];sections?:any[];invoice?:any;customerPOs?:Array<{id:string;poNumber:string;status:string;project?:{id:string;projectCode:string;projectName:string;status:string}|null}>}
type Invoice={id:string;invoiceNumber:string;status:string;subtotalAmount:any;discountPercent:any;discountAmount:any;taxPercent:any;taxAmount:any;totalAmount:any;termsAndConditions?:string|null;paidAmount?:any;outstandingAmount?:any;dueDate:string;client:Client;payments:any[];items?:any[];proposalId?:string|null;project?:{id:string;projectCode:string;projectName:string}|null;billingMilestone?:{id:string;sequence:number;name:string}|null}
type InvoiceDraftItem={description:string;category:string;qty:number;unit:string;unitPrice:number}
type Payment={id:string;amount:any;paymentDate:string;method:string;invoice:any;gatewayTransaction?:{paymentType?:string|null}|null}
type Expense={id:string;category:string;amount:any;expenseDate:string;status:string;vendor:Client}
type Budget={id:string;category:string;period:string;plannedAmount:any;actualAmount?:any}

const canWrite=(role:string)=>['OWNER','FINANCE','SALES'].includes(role)
const canFinance=(role:string)=>['OWNER','FINANCE'].includes(role)
const canExpense=(role:string)=>['OWNER','FINANCE'].includes(role)

async function readResponseBody(r:Response){
 try {
  const text=await r.text()
  if(!text) return {}
  try { return JSON.parse(text) } catch { return {error:`Server mengembalikan respons yang tidak valid (${r.status}).`} }
 } catch {
  return {error:`Gagal membaca respons server (${r.status}).`}
 }
}

function PaymentModal({invoice,onClose,onSaved}:{invoice:Invoice;onClose:()=>void;onSaved:()=>void}){const [amount,setAmount]=useState(String(Math.max(0,Number(invoice.outstandingAmount??(Number(invoice.totalAmount)-(Number(invoice.paidAmount)||0))))));const [method,setMethod]=useState('BANK_TRANSFER');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');async function submit(e:any){e.preventDefault();setBusy(true);const r=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoiceId:invoice.id,amount:Number(amount),paymentDate:new Date().toISOString().slice(0,10),method})});const d=await readResponseBody(r);if(!r.ok)setErr(d.error||`Gagal menyimpan pembayaran (${r.status}).`);else onSaved();setBusy(false)}return <Modal title={`Pembayaran ${invoice.invoiceNumber}`} onClose={onClose}><form className="f-form" onSubmit={submit}><div className="f-card pad"><div style={{display:'flex',justifyContent:'space-between'}}><span className="f-muted">Total</span><span className="f-muted">Sisa</span></div><div style={{display:'flex',justifyContent:'space-between'}}><strong>{money(Number(invoice.totalAmount))}</strong><strong>{money(Number(invoice.outstandingAmount??0))}</strong></div></div><label>Nominal<input className="f-input" type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Metode<select className="f-select" value={method} onChange={e=>setMethod(e.target.value)}><option value="BANK_TRANSFER">Transfer Bank</option><option value="CASH">Cash</option></select></label>{err&&<span className="f-badge red">{err}</span>}<button className="f-btn primary" disabled={busy}>{busy?'Menyimpan...':'Simpan pembayaran'}</button></form></Modal>}
export function ProposalsManager({role}:{role:string}){
 const emptyItem=()=>({description:'',category:'SERVICE',brand:'',itemType:'',specification:'',qty:1,unit:'UNIT',unitPrice:0,notes:''})
 const emptySection=()=>({code:'A',name:'Pekerjaan Utama',description:'',items:[emptyItem()]})
 const [rows,setRows]=useState<Proposal[]>([]),[clients,setClients]=useState<Client[]>([]),[open,setOpen]=useState(false),[editId,setEditId]=useState<string|null>(null),[busy,setBusy]=useState(false),[q,setQ]=useState(''),[message,setMessage]=useState('')
 const [form,setForm]=useState<any>({clientId:'',validUntil:'',quotationReference:'',projectName:'',projectLocation:'',scopeSummary:'',sections:[emptySection()],discountPercent:0,taxPercent:0,overheadAmount:0,roundingAmount:0,taxIncluded:false,termsAndConditions:''})
 async function load(){const [a,b]=await Promise.all([fetch('/api/proposals',{cache:'no-store'}),fetch('/api/clients?type=CLIENT',{cache:'no-store'})]);const ad=await readResponseBody(a),bd=await readResponseBody(b);setRows(ad.proposals||[]);setClients(bd.clients||[])}
 useEffect(()=>{load()},[])
 function startNew(){setEditId(null);setForm({clientId:'',validUntil:'',quotationReference:'',projectName:'',projectLocation:'',scopeSummary:'',sections:[emptySection()],discountPercent:0,taxPercent:0,overheadAmount:0,roundingAmount:0,taxIncluded:false,termsAndConditions:''});setOpen(true);setMessage('')}
 function startEdit(x:Proposal){const sections=x.sections?.length?x.sections:[{code:'A',name:'Pekerjaan Utama',description:'',items:x.items||[]}];setEditId(x.id);setForm({clientId:x.client.id,validUntil:String(x.validUntil).slice(0,10),quotationReference:(x as any).quotationReference||'',projectName:(x as any).projectName||'',projectLocation:(x as any).projectLocation||'',scopeSummary:(x as any).scopeSummary||'',sections:sections.map((s:any,si:number)=>({code:s.code||String.fromCharCode(65+si),name:s.name||'Pekerjaan Utama',description:s.description||'',items:(s.items||[]).map((i:any)=>({description:i.description||'',category:i.category||'SERVICE',brand:i.brand||'',itemType:i.itemType||'',specification:i.specification||'',qty:i.qty||1,unit:i.unit||'UNIT',unitPrice:Number(i.unitPrice||0),notes:i.notes||''}))})),discountPercent:Number(x.discountPercent||0),taxPercent:Number(x.taxPercent||0),overheadAmount:Number(x.overheadAmount||0),roundingAmount:Number(x.roundingAmount||0),taxIncluded:Boolean(x.taxIncluded),termsAndConditions:x.termsAndConditions||''});setOpen(true);setMessage('')}
 const allItems=form.sections.flatMap((s:any)=>s.items);const subtotal=allItems.reduce((sum:number,i:any)=>sum+(Number(i.qty)||0)*(Number(i.unitPrice)||0),0);const discount=subtotal*(Number(form.discountPercent||0)/100),taxable=Math.max(0,subtotal-discount),tax=taxable*(Number(form.taxPercent||0)/100),commercialTotal=taxable+(Number(form.overheadAmount)||0)+tax,grandTotal=commercialTotal+(Number(form.roundingAmount)||0)
 function updateSection(si:number,patch:any){setForm((f:any)=>({...f,sections:f.sections.map((s:any,i:number)=>i===si?{...s,...patch}:s)}))}
 function updateItem(si:number,ii:number,patch:any){setForm((f:any)=>({...f,sections:f.sections.map((s:any,i:number)=>i===si?{...s,items:s.items.map((it:any,j:number)=>j===ii?{...it,...patch}:it)}:s)}))}
 function addSection(){setForm((f:any)=>({...f,sections:[...f.sections,{code:String.fromCharCode(65+f.sections.length),name:'Bagian Pekerjaan Baru',description:'',items:[emptyItem()]}]}))}
 function removeSection(si:number){if(form.sections.length===1)return;setForm((f:any)=>({...f,sections:f.sections.filter((_:any,i:number)=>i!==si)}))}
 function addItem(si:number){setForm((f:any)=>({...f,sections:f.sections.map((s:any,i:number)=>i===si?{...s,items:[...s.items,emptyItem()]}:s)}))}
 function removeItem(si:number,ii:number){setForm((f:any)=>({...f,sections:f.sections.map((s:any,i:number)=>i===si?{...s,items:s.items.length===1?s.items:s.items.filter((_:any,j:number)=>j!==ii)}:s)}))}
 async function save(e:any){e.preventDefault();setBusy(true);setMessage('');try{const body={clientId:form.clientId,validUntil:form.validUntil||new Date(Date.now()+14*864e5).toISOString().slice(0,10),quotationReference:form.quotationReference,projectName:form.projectName,projectLocation:form.projectLocation,scopeSummary:form.scopeSummary,discountPercent:form.discountPercent,taxPercent:form.taxPercent,overheadAmount:form.overheadAmount,roundingAmount:form.roundingAmount,taxIncluded:form.taxIncluded,pricingMode:'ITEM_SUM',termsAndConditions:form.termsAndConditions,sections:form.sections};const r=await fetch(editId?`/api/proposals/${editId}`:'/api/proposals',{method:editId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(editId?{action:'EDIT',...body}:body)});const d=await readResponseBody(r);if(!r.ok)throw new Error(d.error||'Gagal menyimpan proposal.');setOpen(false);setMessage(editId?'Proposal diperbarui.':'Proposal berhasil dibuat.');await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan.')}finally{setBusy(false)}}
 async function action(id:string,body:any,success:string){setBusy(true);setMessage('');try{const r=await fetch(`/api/proposals/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await readResponseBody(r);if(!r.ok)throw new Error(d.error||'Gagal memperbarui proposal.');setMessage(success);await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal memperbarui.')}finally{setBusy(false)}}
 async function remove(id:string){if(!confirm('Hapus proposal DRAFT ini?'))return;setBusy(true);setMessage('');try{const r=await fetch(`/api/proposals/${id}`,{method:'DELETE'});const d=await readResponseBody(r);setMessage(r.ok?'Proposal dihapus.':(d.error||`Gagal menghapus proposal (${r.status}).`));if(r.ok)await load()}catch(e){setMessage(e instanceof Error?e.message:'Gagal menghapus.')}finally{setBusy(false)}}
 const filtered=rows.filter(x=>`${x.proposalNumber} ${x.client.name} ${(x as any).projectName||''}`.toLowerCase().includes(q.toLowerCase()))
 return <div className="f-content">
  <PageHeader eyebrow="Penjualan / Proposal" title="Proposal" description="Buat penawaran berbasis project dan BOQ, kirim ke customer, lalu tetapkan outcome WON/LOST sebelum masuk PO customer." action={canWrite(role)&&<button className="f-btn primary" onClick={startNew}>＋ Buat Proposal</button>}/>
  <div className="f-grid-3"><StatCard label="Total proposal" value={rows.length} icon="▤"/><StatCard label="Won" value={rows.filter(x=>x.status==='WON').length} icon="✓"/><StatCard label="Nilai proposal" value={money(rows.reduce((s,x)=>s+Number(x.totalAmount),0))} icon="Rp"/></div><div style={{height:16}}/>
  <Card><div className="f-toolbar"><input className="f-input" placeholder="Cari nomor, klien, atau project..." value={q} onChange={e=>setQ(e.target.value)}/>{message&&<span className="f-badge green">{message}</span>}</div><div style={{overflowX:'auto'}}><table className="f-table f-proposal-table"><thead><tr><th>Proposal</th><th>Project</th><th>Klien</th><th>Valid sampai</th><th>Nilai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map(x=>{
   const activePO=x.customerPOs?.find(po=>po.status==='RECEIVED'||po.status==='VERIFIED')
   const project=activePO?.project||null
   const handoverStep=x.status!=='WON'?0:project?4:activePO?.status==='VERIFIED'?3:activePO?.status==='RECEIVED'?2:1
   return <tr key={x.id}>
     <td><strong>{x.proposalNumber}</strong>{(x as any).quotationReference&&<div className="f-muted" style={{fontSize:11}}>Ref {(x as any).quotationReference}</div>}</td>
     <td>{(x as any).projectName||'-'}</td>
     <td>{x.client.name}</td>
     <td>{new Date(x.validUntil).toLocaleDateString('id-ID')}</td>
     <td className="f-number">{money(Number(x.totalAmount))}</td>
     <td>
       <div className="f-proposal-status-stack">
         <Badge tone={x.status==='WON'?'green':x.status==='LOST'?'red':'blue'}>{x.status}</Badge>
         {x.status==='WON'&&<span className="f-status-sub">{project?'Project terbentuk':activePO?.status==='VERIFIED'?'PO verified':activePO?.status==='RECEIVED'?'PO diterima':'Menunggu PO'}</span>}
       </div>
     </td>
     <td>
       <div className="f-proposal-action-stack">
         <div className="f-actions">
           <a className="f-btn soft" href={'/proposals/'+x.id}>Detail</a>
           <a className="f-btn" href={'/documents/proposals/'+x.id} target="_blank" rel="noreferrer">PDF / Cetak</a>
           {x.invoice?<a className="f-btn soft" href="/invoices">Lihat invoice</a>:<>{canWrite(role)&&x.status==='DRAFT'&&<><button className="f-btn soft" disabled={busy} onClick={()=>startEdit(x)}>Edit</button><button className="f-btn" disabled={busy} onClick={()=>remove(x.id)}>Hapus</button><button className="f-btn soft" disabled={busy} onClick={()=>action(x.id,{status:'SENT'},'Proposal dikirim.')}>Kirim</button></>}{canFinance(role)&&x.status==='SENT'&&<><button className="f-btn" disabled={busy} onClick={()=>action(x.id,{status:'NEGOTIATION'},'Proposal masuk NEGOTIATION.')}>Negosiasi</button><button className="f-btn soft" disabled={busy} onClick={()=>action(x.id,{status:'WON'},'Proposal dimenangkan.')}>Menangkan</button><button className="f-btn" disabled={busy} onClick={()=>action(x.id,{status:'LOST'},'Proposal ditetapkan LOST.')}>Tolak / LOST</button></>}</>}
         </div>
         {x.status==='WON'&&<div className="f-commercial-handover">
           <div className="f-commercial-handover-head"><strong>Commercial handover</strong><span>{project?'Project siap':activePO?.status==='VERIFIED'?'Siap buat project':activePO?.status==='RECEIVED'?'Menunggu verifikasi':'Belum ada PO'}</span></div>
           <div className="f-commercial-handover-steps">
             <span className={handoverStep>=1?'done':''}>1. WON</span>
             <span className={handoverStep>=2?'done':''}>2. PO</span>
             <span className={handoverStep>=3?'done':''}>3. Verify</span>
             <span className={handoverStep>=4?'done':''}>4. Project</span>
           </div>
           <div className="f-commercial-handover-action">
             {!activePO&&<a className="f-btn primary" href={'/customer-pos?quotationId='+x.id}>Catat PO</a>}
             {activePO?.status==='RECEIVED'&&<a className="f-btn primary" href="/customer-pos">Verifikasi PO</a>}
             {activePO?.status==='VERIFIED'&&!project&&<a className="f-btn primary" href={'/projects?customerPoId='+activePO.id}>Buat Project</a>}
             {project&&<a className="f-btn soft" href={'/projects/'+project.id}>Buka Project</a>}
           </div>
         </div>}
       </div>
     </td>
   </tr>
 })}</tbody></table></div>{!filtered.length&&<div className="f-empty"><strong>Belum ada proposal</strong>Buat proposal pertama untuk memulai.</div>}</Card>
  {open&&<Modal className="f-proposal-create-modal f-full-workspace-modal" title={editId?'Edit Proposal':'Buat Proposal'} subtitle="Gunakan struktur section/BOQ agar penawaran project lebih rapi dan mudah dikembangkan." onClose={()=>setOpen(false)}><form className="f-form f-commercial-form" onSubmit={save}>
   <div className="f-form-section"><div className="f-form-section-title">Informasi project</div><div className="f-form-grid"><label>Klien<select className="f-select" required value={form.clientId} onChange={e=>setForm({...form,clientId:e.target.value})}><option value="">Pilih klien</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>No. referensi quotation <input className="f-input" value={form.quotationReference} onChange={e=>setForm({...form,quotationReference:e.target.value})} placeholder="Contoh EST/KUS/0003-AE-07-2026"/></label><label>Nama project <input className="f-input" value={form.projectName} onChange={e=>setForm({...form,projectName:e.target.value})} placeholder="Contoh GD PAV Kartika I RSPAD"/></label><label>Lokasi project <input className="f-input" value={form.projectLocation} onChange={e=>setForm({...form,projectLocation:e.target.value})} placeholder="Jakarta Pusat"/></label><label>Berlaku sampai<input className="f-input" type="date" value={form.validUntil} onChange={e=>setForm({...form,validUntil:e.target.value})}/></label></div><label>Ringkasan scope<textarea className="f-textarea" rows={3} value={form.scopeSummary} onChange={e=>setForm({...form,scopeSummary:e.target.value})} placeholder="Contoh: Pengadaan trafo, panel, kabel, grounding, dan jasa instalasi."></textarea></label></div>
   {form.sections.map((section:any,si:number)=><div className="f-form-section" key={si}><div className="f-form-section-title" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><span>Section {section.code} — {section.name||'Tanpa nama'}</span><button type="button" className="f-btn" onClick={()=>removeSection(si)} disabled={form.sections.length===1}>Hapus section</button></div><div className="f-form-grid"><label>Kode<input className="f-input" value={section.code} onChange={e=>updateSection(si,{code:e.target.value})}/></label><label>Nama pekerjaan<input className="f-input" required value={section.name} onChange={e=>updateSection(si,{name:e.target.value})}/></label></div><label>Catatan section<textarea className="f-textarea" rows={2} value={section.description} onChange={e=>updateSection(si,{description:e.target.value})} placeholder="Contoh: Pengadaan panel TM 24kV dan jasa instalasi."></textarea></label>{section.items.map((item:any,ii:number)=><div key={ii} className="f-card pad" style={{marginTop:10,border:'1px solid rgba(6,74,69,.12)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8}}><strong>Item {ii+1}</strong><button type="button" className="f-btn" onClick={()=>removeItem(si,ii)} disabled={section.items.length===1}>Hapus</button></div><label>Deskripsi<textarea className="f-textarea" rows={2} value={item.description} onChange={e=>updateItem(si,ii,{description:e.target.value})} placeholder="Contoh: Panel Cubicle TM 24kV"></textarea></label><div className="f-form-grid"><label>Kategori<select className="f-select" value={item.category} onChange={e=>updateItem(si,ii,{category:e.target.value})}><option value="MATERIAL">Material</option><option value="SERVICE">Jasa / Instalasi</option><option value="OTHER">Lainnya</option></select></label><label>Unit<input className="f-input" value={item.unit} onChange={e=>updateItem(si,ii,{unit:e.target.value})} placeholder="LOT / PCS / MTR / UNIT"/></label><label>Brand<input className="f-input" value={item.brand} onChange={e=>updateItem(si,ii,{brand:e.target.value})} placeholder="Schneider / Trafindo / Lokal"/></label><label>Type<input className="f-input" value={item.itemType} onChange={e=>updateItem(si,ii,{itemType:e.target.value})} placeholder="F-SM6R-IM-A1-C"/></label><label>Qty<input className="f-input" type="number" min="1" step="1" value={item.qty} onChange={e=>updateItem(si,ii,{qty:Math.max(1,Number(e.target.value)||1)})}/></label><label>Harga satuan<input className="f-input" type="number" min="0" step="1" value={item.unitPrice} onChange={e=>updateItem(si,ii,{unitPrice:Math.max(0,Number(e.target.value)||0)})}/></label></div><label>Spesifikasi<textarea className="f-textarea" rows={2} value={item.specification} onChange={e=>updateItem(si,ii,{specification:e.target.value})} placeholder="Contoh: 24kV, 630A, IK 16kA-1 sec"></textarea></label><label>Catatan item<textarea className="f-textarea" rows={2} value={item.notes} onChange={e=>updateItem(si,ii,{notes:e.target.value})} placeholder="Opsional"></textarea></label></div>)}<button type="button" className="f-btn soft" onClick={()=>addItem(si)}>＋ Tambah item</button></div>)}
   <div className="f-form-section"><button type="button" className="f-btn soft" onClick={addSection}>＋ Tambah section BOQ</button></div>
   <div className="f-form-section"><div className="f-form-section-title">Komponen komersial</div><div className="f-form-grid"><label>Diskon (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={e=>setForm({...form,discountPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></label><label>Pajak (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.taxPercent} onChange={e=>setForm({...form,taxPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></label><label>Overhead<input className="f-input" type="number" min="0" step="1" value={form.overheadAmount} onChange={e=>setForm({...form,overheadAmount:Math.max(0,Number(e.target.value)||0)})}/></label><label>Rounding adjustment<input className="f-input" type="number" step="1" value={form.roundingAmount} onChange={e=>setForm({...form,roundingAmount:Number(e.target.value)||0})}/></label><label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.taxIncluded} onChange={e=>setForm({...form,taxIncluded:e.target.checked})}/> Harga sudah termasuk pajak</label></div></div>
   <div className="f-form-section"><div className="f-form-section-title">Terms & Conditions <span className="f-optional">opsional</span></div><textarea className="f-textarea" rows={4} value={form.termsAndConditions} onChange={e=>setForm({...form,termsAndConditions:e.target.value})} placeholder="Contoh: Harga belum termasuk PPN 11%; berlaku 7 hari; garansi 1 tahun."></textarea></div>
   <div className="f-summary-card"><div className="f-summary-head"><div><strong>Ringkasan penawaran</strong><span>{form.sections.length} section · {allItems.length} item</span></div><div className="f-summary-total">{money(grandTotal)}</div></div><div className="f-summary-lines"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Diskon</span><strong className={discount>0?'negative':''}>- {money(discount)}</strong></div><div><span>Pajak</span><strong>{money(tax)}</strong></div><div><span>Overhead</span><strong>{money(Number(form.overheadAmount)||0)}</strong></div><div><span>Rounding</span><strong>{money(Number(form.roundingAmount)||0)}</strong></div><div className="total"><span>Rounded total</span><strong>{money(grandTotal)}</strong></div></div></div>
   <div className="f-modal-actions"><button type="button" className="f-btn" onClick={()=>setOpen(false)}>Batal</button><button className="f-btn primary" disabled={busy||!form.sections.every((s:any)=>s.items.length>0)}>{busy?'Menyimpan...':'Simpan proposal'}</button></div>
  </form></Modal>}
 </div>
}

export function InvoicesManager({role}:{role:string}){
 const searchParams=useSearchParams()
 const [rows,setRows]=useState<Invoice[]>([])
 const [clients,setClients]=useState<Client[]>([])
 const [open,setOpen]=useState(false)
 const [payId,setPayId]=useState<string|null>(null)
 const [editId,setEditId]=useState<string|null>(null)
 const [msg,setMsg]=useState('')
 const [msgTone,setMsgTone]=useState<'success'|'error'|'info'>('success')
 const [busy,setBusy]=useState(false)
 const [form,setForm]=useState({
   invoiceNumber:'',
   clientId:'',
   dueDate:'',
   discountPercent:0,
   taxPercent:0,
   termsAndConditions:'',
   items:[{description:'Jasa profesional',category:'SERVICE',qty:1,unit:'UNIT',unitPrice:0}] as InvoiceDraftItem[],
 })

 async function load(){
   const [a,b]=await Promise.all([
     fetch('/api/invoices',{cache:'no-store'}),
     fetch('/api/clients?type=CLIENT',{cache:'no-store'}),
   ])
   const ad=await readResponseBody(a),bd=await readResponseBody(b)
   setRows(ad.invoices||[])
   setClients(bd.clients||[])
 }

 useEffect(()=>{load()},[])

 useEffect(()=>{
   const orderId=searchParams.get('gatewayOrderId')
   if(!orderId) return
   let cancelled=false
   const sync=async()=>{
     setMsg('Memverifikasi pembayaran Midtrans...');setMsgTone('info')
     try{
       const r=await fetch(`/api/payments/gateway/midtrans/status?orderId=${encodeURIComponent(orderId)}`,{cache:'no-store'})
       const d=await readResponseBody(r)
       if(cancelled)return
       if(!r.ok) throw new Error(d.error||`Gagal menyinkronkan pembayaran (${r.status}).`)
       const labels:any={SETTLEMENT:'Pembayaran berhasil dikonfirmasi. Invoice diperbarui menjadi PARTIAL/PAID.',PENDING:'Pembayaran masih menunggu konfirmasi Midtrans.',REVIEW:'Pembayaran memerlukan pemeriksaan lebih lanjut.',FAILED:'Pembayaran gagal.',EXPIRED:'Pembayaran kedaluwarsa.',CANCELLED:'Pembayaran dibatalkan.'}
       setMsg(labels[d.status]||`Status pembayaran: ${d.status||'tidak diketahui'}.`)
       setMsgTone(d.status==='SETTLEMENT'?'success':d.status==='FAILED'||d.status==='EXPIRED'||d.status==='CANCELLED'||d.status==='REVIEW'?'error':'info')
       await load()
     }catch(e){
       if(!cancelled){setMsg(e instanceof Error?e.message:'Gagal menyinkronkan pembayaran.');setMsgTone('error')}
     }finally{
       const url=new URL(window.location.href)
       url.searchParams.delete('gatewayOrderId')
       url.searchParams.delete('invoiceId')
       window.history.replaceState({},'',url.toString())
     }
   }
   void sync()
   return()=>{cancelled=true}
 },[searchParams])

 function resetForm(){
   setForm({
     invoiceNumber:'',
     clientId:'',
     dueDate:'',
     discountPercent:0,
     taxPercent:0,
     termsAndConditions:'',
     items:[{description:'Jasa profesional',category:'SERVICE',qty:1,unit:'UNIT',unitPrice:0}],
   })
 }

 function startNew(){
   setEditId(null)
   resetForm()
   setMsg('')
   setOpen(true)
 }

 function startEdit(x:Invoice){
   setEditId(x.id)
   setForm({
     invoiceNumber:x.invoiceNumber||'',
     clientId:x.client.id,
     dueDate:String(x.dueDate).slice(0,10),
     discountPercent:Number(x.discountPercent||0),
     taxPercent:Number(x.taxPercent||0),
     termsAndConditions:x.termsAndConditions||'',
     items:x.items?.length
       ? x.items.map((item:any)=>({
           description:item.description||'',
           category:item.category||'SERVICE',
           qty:Number(item.qty||1),
           unit:item.unit||'UNIT',
           unitPrice:Number(item.unitPrice||0),
         }))
       : [{description:'',category:'SERVICE',qty:1,unit:'UNIT',unitPrice:0}],
   })
   setMsg('')
   setOpen(true)
 }

 function updateItem(index:number,patch:Partial<InvoiceDraftItem>){
   setForm(current=>({...current,items:current.items.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item)}))
 }

 function addItem(){
   setForm(current=>({...current,items:[...current.items,{description:'',category:'SERVICE',qty:1,unit:'UNIT',unitPrice:0}]}))
 }

 function removeItem(index:number){
   setForm(current=>({...current,items:current.items.length===1?current.items:current.items.filter((_,itemIndex)=>itemIndex!==index)}))
 }

 const subtotal=useMemo(()=>form.items.reduce((sum,item)=>sum+item.qty*item.unitPrice,0),[form.items])
 const discount=useMemo(()=>subtotal*(Number(form.discountPercent||0)/100),[subtotal,form.discountPercent])
 const taxable=Math.max(0,subtotal-discount)
 const tax=useMemo(()=>taxable*(Number(form.taxPercent||0)/100),[taxable,form.taxPercent])
 const grandTotal=taxable+tax

 async function save(e:any){
   e.preventDefault()
   setBusy(true)
   setMsg('')
   try{
     if(!form.clientId) throw new Error('Klien wajib dipilih.')
     if(!form.items.length) throw new Error('Minimal satu item invoice harus ada.')
     if(form.items.some(item=>!item.description.trim()||item.qty<=0||item.unitPrice<0||!item.unit.trim())) throw new Error('Lengkapi deskripsi, qty, satuan, dan harga setiap item.')
     const body={
       invoiceNumber:form.invoiceNumber.trim()||undefined,
       clientId:form.clientId,
       dueDate:form.dueDate||new Date(Date.now()+14*864e5).toISOString().slice(0,10),
       discountPercent:form.discountPercent,
       taxPercent:form.taxPercent,
       termsAndConditions:form.termsAndConditions,
       items:form.items.map(item=>({
         description:item.description.trim(),
         category:item.category||'SERVICE',
         qty:item.qty,
         unit:item.unit.trim(),
         unitPrice:item.unitPrice,
       })),
     }
     const r=await fetch(editId?`/api/invoices/${editId}`:'/api/invoices',{
       method:editId?'PATCH':'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify(body),
     })
     const d=await readResponseBody(r)
     if(!r.ok) throw new Error(d.error||`Gagal menyimpan invoice (${r.status}).`)
     setOpen(false)
     setMsg(editId?'Invoice diperbarui.':'Invoice berhasil dibuat.')
     setMsgTone('success')
     await load()
   }catch(e){
     setMsg(e instanceof Error?e.message:'Gagal menyimpan invoice.')
     setMsgTone('error')
   }finally{
     setBusy(false)
   }
 }

 async function remove(x:Invoice){
   if(!confirm(`Hapus invoice ${x.invoiceNumber}?`))return
   const r=await fetch(`/api/invoices/${x.id}`,{method:'DELETE'})
   const d=await readResponseBody(r)
   setMsg(r.ok?'Invoice dihapus.':(d.error||`Gagal menghapus invoice (${r.status}).`))
   setMsgTone(r.ok?'success':'error')
   if(r.ok)await load()
 }

 return <div className="f-content f-domain-page">
   <PageHeader
     eyebrow="PENJUALAN / TAGIHAN"
     title="Invoice"
     description="Kelola tagihan aktual, outstanding, pembayaran, dan hubungan invoice dengan project."
     action={canWrite(role)&&<button className="f-btn primary" onClick={startNew}>＋ Buat Invoice</button>}
   />
   <div className="f-grid-4 f-domain-kpis">
     <StatCard label="Total invoice" value={rows.length} icon="▧"/>
     <StatCard label="Belum dibayar" value={rows.filter(x=>x.status!=='PAID').length} icon="◷"/>
     <StatCard label="Nilai piutang" value={money(rows.reduce((s,x)=>s+Number(x.outstandingAmount??0),0))} icon="Rp"/>
     <StatCard label="Lunas" value={rows.filter(x=>x.status==='PAID').length} icon="✓"/>
   </div>
   <Card className="f-domain-card">
     <div className="f-card-head f-invoice-card-head">
       <div><h3>Daftar invoice aktual</h3><p>Gunakan invoice dari Billing Milestone untuk transaksi project agar relasi project → billing → payment tetap terjaga.</p></div>
     </div>
     <div className="f-inline-alert info">
       <strong>Invoice project:</strong> buat dari <strong>Project → Billing &amp; Payment → Buat invoice</strong>. Form ini digunakan untuk invoice manual/non-project.
     </div>
     {msg&&<div className={`f-inline-alert ${msgTone}`}>{msg}</div>}
     <div style={{overflowX:'auto'}}>
       <table className="f-table">
         <thead><tr><th>Invoice</th><th>Project</th><th>Klien</th><th>Jatuh tempo</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
         <tbody>{rows.map(x=>
           <tr key={x.id}>
             <td><strong>{x.invoiceNumber}</strong>{x.billingMilestone&&<div className="f-muted" style={{fontSize:11}}>Billing #{x.billingMilestone.sequence}: {x.billingMilestone.name}</div>}</td>
             <td>{x.project?<a href={`/projects/${x.project.id}`}>{x.project.projectCode}</a>:'—'}</td>
             <td>{x.client.name}</td>
             <td>{new Date(x.dueDate).toLocaleDateString('id-ID')}</td>
             <td className="f-number">{money(Number(x.totalAmount))}</td>
             <td><div className="f-invoice-status"><Badge tone={x.status==='PAID'?'green':x.status==='OVERDUE'?'red':x.status==='PARTIAL'?'blue':'amber'}>{x.status}</Badge>{x.outstandingAmount!==undefined&&Number(x.outstandingAmount)>0&&<span className="f-status-sub">Sisa {money(Number(x.outstandingAmount))}</span>}</div></td>
             <td>
               <div className="f-invoice-action-group">
                 <a className="f-btn f-btn-compact" href={`/documents/invoices/${x.id}`} target="_blank" rel="noreferrer">PDF</a>
                 {x.status!=='PAID'&&<button className="f-btn soft f-btn-compact" onClick={()=>setPayId(x.id)}>Bayar</button>}
                 {canFinance(role)&&x.status!=='PAID'&&<MidtransPaymentButton invoice={x} onUpdated={load} onMessage={(text,tone)=>{setMsg(text);setMsgTone(tone||'info')}}/>}
                 {canWrite(role)&&!x.payments?.length&&!x.proposalId&&!x.project&&<button className="f-btn" onClick={()=>startEdit(x)}>Edit</button>}
                 {canFinance(role)&&!x.payments?.length&&!x.proposalId&&!x.project&&<button className="f-btn" onClick={()=>remove(x)}>Hapus</button>}
                 {canWrite(role)&&x.status==='UNPAID'&&!x.payments?.length&&<button className="f-btn soft" disabled={busy} onClick={async()=>{
                   setBusy(true)
                   const r=await fetch(`/api/invoices/${x.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'MARK_SENT'})})
                   const d=await readResponseBody(r)
                   setMsg(r.ok?(d.message||'Invoice ditandai terkirim.'):(d.error||`Gagal mengubah status (${r.status}).`))
                   setMsgTone(r.ok?'success':'error')
                   if(r.ok)await load()
                   setBusy(false)
                 }}>Tandai terkirim</button>}
                 {canFinance(role)&&x.status==='OVERDUE'&&<button className="f-btn soft" disabled={busy} onClick={async()=>{
                   setBusy(true)
                   const r=await fetch(`/api/invoices/${x.id}/remind`,{method:'POST'})
                   const d=await readResponseBody(r)
                   setMsg(r.ok?(d.message||'Pengingat dicatat.'):(d.error||`Gagal mencatat pengingat (${r.status}).`))
                   setMsgTone(r.ok?'success':'error')
                   setBusy(false)
                 }}>Pengingat</button>}
               </div>
             </td>
           </tr>
         )}</tbody>
       </table>
     </div>
   </Card>

   {open&&<SideDrawer
     open={open}
     onClose={()=>!busy&&setOpen(false)}
     title={editId?'Edit Invoice':'Buat Invoice Manual'}
     description="Gunakan workspace ini untuk invoice non-project. Invoice project harus berasal dari Billing Milestone READY."
     className="invoice-entry-workspace"
     footer={<div className="f-drawer-actions"><button type="button" className="f-btn" disabled={busy} onClick={()=>setOpen(false)}>Batal</button><button className="f-btn primary" disabled={busy||!form.clientId||grandTotal<=0} form="invoice-entry-form">{busy?'Menyimpan…':editId?'Simpan perubahan':'Simpan invoice'}</button></div>}
   >
     <form id="invoice-entry-form" className="invoice-entry-form" onSubmit={save}>
       <div className="invoice-entry-grid">
         <section className="invoice-form-section invoice-context-section">
           <div className="invoice-section-heading">
             <span className="invoice-section-index">01</span>
             <div><h3>Identitas invoice</h3><p>Dokumen tagihan manual/non-project.</p></div>
           </div>
           <div className="invoice-field-grid">
             <label>Nomor invoice <span className="invoice-optional">opsional — otomatis bila kosong</span><input className="f-input" value={form.invoiceNumber} onChange={e=>setForm({...form,invoiceNumber:e.target.value})} placeholder="Contoh: INV-2026-001"/></label>
             <label>Klien<select className="f-select" required value={form.clientId} onChange={e=>setForm({...form,clientId:e.target.value})}><option value="">Pilih klien</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
             <label>Jatuh tempo<input className="f-input" type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>
           </div>
         </section>

         <section className="invoice-form-section invoice-items-section">
           <div className="invoice-section-heading invoice-section-heading-between">
             <div className="invoice-heading-left"><span className="invoice-section-index">02</span><div><h3>Item invoice</h3><p>Invoice dapat memiliki beberapa baris item. Total dihitung otomatis.</p></div></div>
             <span className="f-badge blue">{form.items.length} item</span>
           </div>
           <div className="invoice-items-table">
             <div className="invoice-item-head"><span>Item / uraian</span><span>Kategori</span><span>Qty</span><span>Satuan</span><span>Harga satuan</span><span>Total</span><span></span></div>
             {form.items.map((item,index)=>
               <div className="invoice-item-row" key={index}>
                 <input className="f-input" value={item.description} onChange={e=>updateItem(index,{description:e.target.value})} placeholder="Contoh: Jasa terminasi kabel"/>
                 <select className="f-select" value={item.category} onChange={e=>updateItem(index,{category:e.target.value})}><option value="SERVICE">Jasa</option><option value="MATERIAL">Material</option><option value="OTHER">Lainnya</option></select>
                 <input className="f-input" type="number" min="1" step="1" value={item.qty} onChange={e=>updateItem(index,{qty:Math.max(1,Number(e.target.value)||1)})}/>
                 <input className="f-input" value={item.unit} onChange={e=>updateItem(index,{unit:e.target.value})} placeholder="UNIT"/>
                 <input className="f-input" type="number" min="0" step="0.01" value={item.unitPrice} onChange={e=>updateItem(index,{unitPrice:Math.max(0,Number(e.target.value)||0)})}/>
                 <strong className="invoice-item-total">{money(item.qty*item.unitPrice)}</strong>
                 <button type="button" className="invoice-item-remove" disabled={form.items.length===1} onClick={()=>removeItem(index)} aria-label={`Hapus item ${index+1}`}>×</button>
               </div>
             )}
           </div>
           <button type="button" className="f-btn soft invoice-add-item" onClick={addItem}>＋ Tambah item</button>
         </section>

         <section className="invoice-form-section invoice-commercial-section">
           <div className="invoice-section-heading">
             <span className="invoice-section-index">03</span>
             <div><h3>Commercial</h3><p>Atur diskon, pajak, dan ketentuan pembayaran.</p></div>
           </div>
           <div className="invoice-field-grid invoice-commercial-grid">
             <label>Diskon (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={e=>setForm({...form,discountPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></label>
             <label>Pajak (%)<input className="f-input" type="number" min="0" max="100" step="0.01" value={form.taxPercent} onChange={e=>setForm({...form,taxPercent:Math.min(100,Math.max(0,Number(e.target.value)||0))})}/></label>
             <label className="invoice-terms-field">Terms &amp; Conditions<textarea className="f-textarea" rows={4} value={form.termsAndConditions} onChange={e=>setForm({...form,termsAndConditions:e.target.value})} placeholder="Contoh: pembayaran 14 hari setelah invoice diterima." /></label>
           </div>
         </section>

         <aside className="invoice-summary-panel">
           <div className="invoice-summary-kicker">INVOICE TOTAL</div>
           <div className="invoice-summary-total">{money(grandTotal)}</div>
           <div className="invoice-summary-lines">
             <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
             <div><span>Diskon</span><strong>- {money(discount)}</strong></div>
             <div><span>Pajak</span><strong>{money(tax)}</strong></div>
             <div className="invoice-summary-grand"><span>Grand total</span><strong>{money(grandTotal)}</strong></div>
           </div>
           <div className="invoice-summary-note">Invoice project harus dibuat dari Billing Milestone agar project, invoice, payment, dan cashflow tetap terhubung.</div>
         </aside>
       </div>
     </form>
   </SideDrawer>}

   {payId&&<PaymentModal invoice={rows.find(x=>x.id===payId)!} onClose={()=>setPayId(null)} onSaved={()=>{setPayId(null);load()}}/>}
 </div>
}

export function PaymentsManager({role}:{role:string}){const [rows,setRows]=useState<Payment[]>([]);useEffect(()=>{fetch('/api/payments').then(r=>r.json()).then(d=>setRows(d.payments||[]))},[]);return <div className="f-content"><PageHeader eyebrow="Kas / Payment" title="Pembayaran" description="Riwayat uang masuk yang berasal dari invoice."/><Card><div style={{overflowX:'auto'}}><table className="f-table f-payment-table"><thead><tr><th>Tanggal</th><th>Invoice</th><th>Project</th><th>Klien</th><th>Metode</th><th>Nominal</th><th>Status</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{new Date(x.paymentDate).toLocaleDateString('id-ID')}</td><td>{x.invoice.invoiceNumber}</td><td>{x.invoice.project?<a href={`/projects/${x.invoice.project.id}`}>{x.invoice.project.projectCode}</a>:'—'}</td><td>{x.invoice.client.name}</td><td>{x.method}{x.gatewayTransaction?.paymentType&&<div className="f-muted" style={{fontSize:11}}>{x.gatewayTransaction.paymentType}</div>}</td><td className="f-number">{money(Number(x.amount))}</td><td><Badge tone="green">Selesai</Badge></td></tr>)}</tbody></table></div>{!rows.length&&<div className="f-empty"><strong>Belum ada pembayaran</strong>Pembayaran dicatat dari halaman Invoice agar selalu terhubung ke tagihan.</div>}</Card></div>}

export function ExpensesManager({role}:{role:string}){const [rows,setRows]=useState<Expense[]>([]),[vendors,setVendors]=useState<Client[]>([]),[open,setOpen]=useState(false),[editId,setEditId]=useState<string|null>(null),[msg,setMsg]=useState('');const [form,setForm]=useState({vendorId:'',category:'Operasional',amount:0,expenseDate:new Date().toISOString().slice(0,10)});async function load(){const [a,b]=await Promise.all([fetch('/api/expenses'),fetch('/api/clients?type=VENDOR')]);setRows((await readResponseBody(a)).expenses||[]);setVendors((await readResponseBody(b)).clients||[])}useEffect(()=>{load()},[]);function startNew(){setEditId(null);setForm({vendorId:'',category:'Operasional',amount:0,expenseDate:new Date().toISOString().slice(0,10)});setOpen(true)}function startEdit(x:Expense){setEditId(x.id);setForm({vendorId:x.vendor?.id||'',category:x.category,amount:Number(x.amount),expenseDate:String(x.expenseDate).slice(0,10)});setOpen(true)}async function save(e:any){e.preventDefault();const url=editId?`/api/expenses/${editId}`:'/api/expenses';const r=await fetch(url,{method:editId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await readResponseBody(r);setMsg(r.ok?(editId?'Biaya diperbarui.':'Biaya berhasil dicatat.'):(d.error||`Gagal menyimpan biaya (${r.status}).`));if(r.ok){setOpen(false);load()}}async function approve(id:string){const r=await fetch(`/api/expenses/${id}/approve`,{method:'POST'});const d=await readResponseBody(r);setMsg(r.ok?'Biaya disetujui.':(d.error||`Gagal menyetujui biaya (${r.status}).`));if(r.ok)load()}async function remove(id:string){if(!confirm('Hapus biaya ini?'))return;const r=await fetch(`/api/expenses/${id}`,{method:'DELETE'});const d=await readResponseBody(r);setMsg(r.ok?'Biaya dihapus.':(d.error||`Gagal menghapus biaya (${r.status}).`));if(r.ok)load()}return <div className="f-content"><PageHeader eyebrow="Operasional" title="Biaya (Expense)" description="Catat pengeluaran dan proses approval berdasarkan threshold." action={canExpense(role)&&<button className="f-btn primary" onClick={startNew}>＋ Tambah Biaya</button>}/><div className="f-grid-3"><StatCard label="Total tercatat" value={money(rows.reduce((s,x)=>s+Number(x.amount),0))} icon="◈"/><StatCard label="Menunggu approval" value={rows.filter(x=>x.status==='PENDING').length} icon="!"/><StatCard label="Disetujui" value={rows.filter(x=>x.status==='APPROVED').length} icon="✓"/></div><div style={{height:16}}/><Card><div className="f-card-head">{msg&&<span className="f-badge green">{msg}</span>}</div><div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Vendor</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{new Date(x.expenseDate).toLocaleDateString('id-ID')}</td><td>{x.category}</td><td>{x.vendor?.name||'Pihak lain'}</td><td className="f-number">{money(Number(x.amount))}</td><td><Badge tone={x.status==='APPROVED'?'green':'amber'}>{x.status}</Badge></td><td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{x.status==='PENDING'&&canExpense(role)&&<button className="f-btn soft" onClick={()=>startEdit(x)}>Edit</button>}{x.status==='PENDING'&&canFinance(role)&&<button className="f-btn" onClick={()=>remove(x.id)}>Hapus</button>}{x.status==='PENDING'&&canFinance(role)&&<button className="f-btn soft" onClick={()=>approve(x.id)}>Approve</button>}{x.status==='APPROVED'&&<span className="f-badge green">Terkunci</span>}</div></td></tr>)}</tbody></table></div></Card>{open&&<Modal title={editId?'Edit Biaya':'Catat Biaya'} onClose={()=>setOpen(false)}><form className="f-form" onSubmit={save}><label>Vendor<select className="f-select" required value={form.vendorId} onChange={e=>setForm({...form,vendorId:e.target.value})}><option value="">Pilih vendor</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>Kategori<input className="f-input" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label>Nominal<input className="f-input" type="number" min="1" value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></label><label>Tanggal<input className="f-input" type="date" value={form.expenseDate} onChange={e=>setForm({...form,expenseDate:e.target.value})}/></label><button className="f-btn primary">{editId?'Simpan perubahan':'Simpan biaya'}</button></form></Modal>}</div>}

export function BudgetsManager({role}:{role:string}){const [rows,setRows]=useState<Budget[]>([]),[open,setOpen]=useState(false),[editId,setEditId]=useState<string|null>(null),[error,setError]=useState('');const [form,setForm]=useState({category:'Operasional',period:new Date().getFullYear().toString(),plannedAmount:0});async function load(){try{const r=await fetch('/api/budgets',{cache:'no-store'});const d=await readResponseBody(r);if(!r.ok)throw new Error(d.error||`Gagal memuat anggaran (${r.status}).`);setRows(d.budgets||[])}catch(e){setError(e instanceof Error?e.message:'Gagal memuat anggaran.')}}useEffect(()=>{load()},[]);function startNew(){setEditId(null);setForm({category:'Operasional',period:new Date().getFullYear().toString(),plannedAmount:0});setOpen(true);setError('')}function startEdit(x:Budget){setEditId(x.id);setForm({category:x.category,period:x.period,plannedAmount:Number(x.plannedAmount)});setOpen(true);setError('')}async function save(e:any){e.preventDefault();setError('');const url=editId?`/api/budgets/${editId}`:'/api/budgets';const r=await fetch(url,{method:editId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await readResponseBody(r);if(!r.ok){setError(d.error||`Gagal menyimpan anggaran (${r.status}).`);return}setOpen(false);load()}async function remove(id:string){if(!confirm('Hapus anggaran ini?'))return;const r=await fetch(`/api/budgets/${id}`,{method:'DELETE'});const d=await readResponseBody(r);if(!r.ok)setError(d.error||`Gagal menghapus anggaran (${r.status}).`);else load()}const plannedTotal=rows.reduce((s,x)=>s+Number(x.plannedAmount),0);const actualTotal=rows.reduce((s,x)=>s+Number(x.actualAmount||0),0);return <div className="f-content"><PageHeader eyebrow="Kontrol" title="Anggaran (Budget)" description="Tetapkan rencana anggaran dan pantau penyerapan per kategori." action={canFinance(role)&&<button className="f-btn primary" onClick={startNew}>＋ Buat Anggaran</button>}/>{error&&<div style={{marginBottom:12}}><span className="f-badge red">{error}</span></div>}<div className="f-grid-3"><StatCard label="Total rencana" value={money(plannedTotal)} icon="◎"/><StatCard label="Actual expense" value={money(actualTotal)} icon="◈"/><StatCard label="Sisa budget" value={money(plannedTotal-actualTotal)} icon="▦"/></div><div style={{height:16}}/><Card><div style={{overflowX:'auto'}}><table className="f-table f-budget-table"><thead><tr><th>Kategori</th><th>Periode</th><th>Rencana</th><th>Actual</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{rows.map(x=>{const planned=Number(x.plannedAmount);const actual=Number(x.actualAmount||0);const remaining=planned-actual;return <tr key={x.id}><td><strong>{x.category}</strong></td><td>{x.period}</td><td className="f-number">{money(planned)}</td><td className="f-number">{money(actual)}</td><td className="f-number">{money(remaining)}</td><td><Badge tone={remaining>=0?'green':'red'}>{remaining>=0?'Dalam budget':'Melebihi budget'}</Badge></td><td>{canFinance(role)&&<div style={{display:'flex',gap:6}}><button className="f-btn soft" onClick={()=>startEdit(x)}>Edit</button><button className="f-btn" onClick={()=>remove(x.id)}>Hapus</button></div>}</td></tr>})}</tbody></table></div>{!rows.length&&<div className="f-empty"><strong>Belum ada anggaran</strong>Buat anggaran pertama untuk mengontrol pengeluaran.</div>}</Card>{open&&<Modal title={editId?'Edit Anggaran':'Buat Anggaran'} onClose={()=>setOpen(false)}><form className="f-form" onSubmit={save}><label>Kategori<input className="f-input" required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label>Periode<input className="f-input" required value={form.period} onChange={e=>setForm({...form,period:e.target.value})}/></label><label>Nominal rencana<input className="f-input" required type="number" min="1" value={form.plannedAmount} onChange={e=>setForm({...form,plannedAmount:Number(e.target.value)})}/></label><button className="f-btn primary">Simpan</button></form></Modal>}</div>}
function Modal({title,subtitle,onClose,children,className}:{title:string;subtitle?:string;onClose:()=>void;children:React.ReactNode;className?:string}){
 const [mounted,setMounted]=useState(false)
 useEffect(()=>{setMounted(true);const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[])
 useEffect(()=>{if(!mounted)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[mounted,onClose])
 if(!mounted)return null
 return createPortal(<div className="f-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`f-card f-modal-card${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="f-modal-title"><div className="f-modal-header"><div className="f-modal-header-copy"><h3 id="f-modal-title">{title}</h3>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="f-icon f-modal-close" onClick={onClose} aria-label="Tutup dialog">×</button></div><div className="f-modal-body">{children}</div></div></div>,document.body)}
