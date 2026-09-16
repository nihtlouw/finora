import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import { money } from '@/components/finora-ui'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
 const context=await getCurrentFinoraContext(); if(!context) redirect('/sign-in')
 const clientIds=(await prisma.clientVendor.findMany({where:{workspaceId:context.workspace.id},select:{id:true}})).map(x=>x.id)
 const invoices=await prisma.invoice.findMany({where:{clientId:{in:clientIds}},include:{client:true,payments:{select:{amount:true}}},orderBy:{dueDate:'asc'},take:8})
 const payments=await prisma.payment.findMany({where:{invoice:{clientId:{in:clientIds}}},select:{amount:true}})
 const expenses=await prisma.expense.findMany({where:{vendorId:{in:clientIds},status:'APPROVED'},select:{amount:true}})
 const income=payments.reduce((s,x)=>s+Number(x.amount),0)
 const expense=expenses.reduce((s,x)=>s+Number(x.amount),0)
 const unpaid=invoices.filter(x=>x.status!=='PAID')
 const receivable=unpaid.reduce((s,x)=>s+Math.max(0,Number(x.totalAmount)-x.payments.reduce((p,y)=>p+Number(y.amount),0)),0)
 const activities=[
  ...payments.slice(0,3).map((x,i)=>({id:'p'+i,title:'Pembayaran diterima',detail:money(Number(x.amount)),when:'Terbaru'})),
  ...expenses.slice(0,3).map((x,i)=>({id:'e'+i,title:'Pengeluaran tercatat',detail:money(Number(x.amount)),when:'Terbaru'})),
 ]
 return <FinoraShell workspaceName={context.workspace.name} role={context.user.role} title="Dashboard"><div className="f-content">
  <div className="f-pagehead"><div><div className="f-eyebrow">Overview</div><h1>Selamat datang, {context.user.name?.split(' ')[0]||'Pengguna'}!</h1><p>Kelola arus kas, tagihan, dan kesehatan finansial bisnis Anda dari satu tempat.</p></div><div className="f-actions"><a className="f-btn" href="/reports">Lihat laporan</a><a className="f-btn primary" href="/proposals">+ Buat proposal</a></div></div>
  <div className="f-grid-4">
   <Stat label="Total pemasukan" value={money(income)} trend="Pembayaran masuk" icon="↗"/><Stat label="Total pengeluaran" value={money(expense)} trend="Biaya tercatat" icon="↘"/><Stat label="Piutang aktif" value={money(receivable)} trend={`${unpaid.length} invoice`} icon="◫"/><Stat label="Arus kas bersih" value={money(income-expense)} trend="Income - Expense" icon="◎"/>
  </div><div style={{height:16}}/>
  <div className="f-kpi-row"><section className="f-card"><div className="f-card-head"><div><h3>Arus Kas</h3><p>Ringkasan pergerakan uang masuk dan keluar.</p></div><span className="f-badge green">Live dari database</span></div><div className="f-chart"><svg viewBox="0 0 800 230" preserveAspectRatio="none"><path d="M20 188 C90 160 120 180 170 135 S270 150 325 105 S425 120 470 80 S560 100 610 55 S700 85 780 32" fill="none" stroke="#0f6d5f" strokeWidth="5"/><path d="M20 205 C100 198 130 180 180 192 S275 172 330 185 S430 155 480 172 S560 150 620 164 S710 135 780 145" fill="none" stroke="#d07a64" strokeWidth="4" strokeDasharray="10 8"/><line x1="20" y1="210" x2="780" y2="210" stroke="#dbe6e2"/></svg></div></section>
  <section className="f-card"><div className="f-card-head"><div><h3>Aktivitas Terbaru</h3><p>Perubahan penting di workspace.</p></div></div><div className="f-list">{activities.length?activities.map(x=><div className="f-list-item" key={x.id}><div><strong>{x.title}</strong><div className="f-muted" style={{fontSize:11}}>{x.detail}</div></div><span className="f-muted" style={{fontSize:10}}>{x.when}</span></div>):<div className="f-empty">Belum ada aktivitas.</div>}</div></section></div>
  <div style={{height:16}}/><section className="f-card"><div className="f-card-head"><div><h3>Invoice yang perlu perhatian</h3><p>Prioritas untuk follow-up penagihan.</p></div><a className="f-btn soft" href="/invoices">Semua invoice</a></div>{unpaid.length?<div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Invoice</th><th>Klien</th><th>Jatuh tempo</th><th>Total</th><th>Status</th></tr></thead><tbody>{unpaid.slice(0,6).map(i=><tr key={i.id}><td><strong>{i.invoiceNumber}</strong></td><td>{i.client.name}</td><td>{new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(i.dueDate)}</td><td className="f-number">{money(Number(i.totalAmount))}</td><td><Badge tone={i.status==='OVERDUE'?'red':'amber'}>{i.status}</Badge></td></tr>)}</tbody></table></div>:<div className="f-empty"><strong>Belum ada invoice</strong>Buat proposal atau invoice manual untuk memulai.</div>}</section>
  <div className="f-footer">© 2026 Finora · Keuangan yang terkelola dengan baik membawa bisnis Anda lebih jauh.</div>
 </div></FinoraShell>
}
function Stat({label,value,trend,icon}:{label:string;value:string;trend:string;icon:string}){return <div className="f-stat"><div className="f-stat-icon">{icon}</div><div className="f-stat-body"><span>{label}</span><strong>{value}</strong><small>{trend}</small></div></div>}
function Badge({children,tone}:{children:React.ReactNode;tone:'green'|'amber'|'red'}){return <span className={`f-badge ${tone}`}>{children}</span>}
