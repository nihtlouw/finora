import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import { money, StatCard } from '@/components/finora-ui'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
 const context=await getCurrentFinoraContext(); if(!context) redirect('/sign-in')
 const clientIds=(await prisma.clientVendor.findMany({where:{workspaceId:context.workspace.id},select:{id:true}})).map(x=>x.id)
 const invoices=await prisma.invoice.findMany({where:{clientId:{in:clientIds}},include:{client:true,payments:{select:{amount:true}}},orderBy:{dueDate:'asc'},take:8})
 const payments=await prisma.payment.findMany({where:{invoice:{clientId:{in:clientIds}}},select:{amount:true,paymentDate:true},orderBy:{paymentDate:'asc'}})
 const expenses=await prisma.expense.findMany({where:{vendorId:{in:clientIds},status:'APPROVED'},select:{amount:true,expenseDate:true},orderBy:{expenseDate:'asc'}})
 const income=payments.reduce((s,x)=>s+Number(x.amount),0)
 const expense=expenses.reduce((s,x)=>s+Number(x.amount),0)
 const unpaid=invoices.filter(x=>x.status!=='PAID')
 const receivable=unpaid.reduce((s,x)=>s+Math.max(0,Number(x.totalAmount)-x.payments.reduce((p,y)=>p+Number(y.amount),0)),0)
 const monthBuckets=Array.from({length:6},(_,index)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-index));return {date:d,label:new Intl.DateTimeFormat('id-ID',{month:'short'}).format(d),income:0,expense:0}})
 payments.forEach(x=>{const key=new Date(x.paymentDate);const bucket=monthBuckets.find(b=>b.date.getFullYear()===key.getFullYear()&&b.date.getMonth()===key.getMonth());if(bucket)bucket.income+=Number(x.amount)})
 expenses.forEach(x=>{const key=new Date(x.expenseDate);const bucket=monthBuckets.find(b=>b.date.getFullYear()===key.getFullYear()&&b.date.getMonth()===key.getMonth());if(bucket)bucket.expense+=Number(x.amount)})
 const maxFlow=Math.max(1,...monthBuckets.flatMap(b=>[b.income,b.expense]))
 const plot=(key:'income'|'expense')=>monthBuckets.map((b,index)=>{const x=28+(index*144);const y=178-(b[key]/maxFlow*138);return [x,y] as const})
 const incomePoints=plot('income'),expensePoints=plot('expense')
 const poly=(points:Array<readonly[number,number]>)=>points.map(([x,y])=>`${x},${y.toFixed(1)}`).join(' ')
 const activities=[
  ...payments.slice(0,3).map((x,i)=>({id:'p'+i,title:'Pembayaran diterima',detail:money(Number(x.amount)),when:'Terbaru'})),
  ...expenses.slice(0,3).map((x,i)=>({id:'e'+i,title:'Pengeluaran tercatat',detail:money(Number(x.amount)),when:'Terbaru'})),
 ]
 return <FinoraShell workspaceName={context.workspace.name} role={context.user.role} title="Dashboard"><div className="f-content">
  <div className="f-pagehead"><div><div className="f-eyebrow">Overview</div><h1>Selamat datang, {context.user.name?.split(' ')[0]||'Pengguna'}!</h1><p>Kelola arus kas, tagihan, dan kesehatan finansial bisnis Anda dari satu tempat.</p></div><div className="f-actions"><a className="f-btn" href="/reports">Lihat laporan</a><a className="f-btn primary" href="/proposals">+ Buat proposal</a></div></div>
  <div className="f-grid-4">
   <StatCard label="Total pemasukan" value={money(income)} trend="Pembayaran masuk" icon="↗"/><StatCard label="Total pengeluaran" value={money(expense)} trend="Biaya tercatat" icon="↘"/><StatCard label="Piutang aktif" value={money(receivable)} trend={`${unpaid.length} invoice`} icon="◫"/><StatCard label="Arus kas bersih" value={money(income-expense)} trend="Income - Expense" icon="◎"/>
  </div><div style={{height:16}}/>
  <div className="f-kpi-row"><section className="f-card"><div className="f-card-head"><div><h3>Arus Kas</h3><p>6 bulan terakhir, berdasarkan transaksi pembayaran dan biaya yang disetujui.</p></div><span className="f-badge green">Live dari database</span></div><div className="f-chart-legend"><span><i className="f-chart-dot income"/>Masuk</span><span><i className="f-chart-dot expense"/>Keluar</span></div><div className="f-chart"><svg className="f-chart-svg" viewBox="0 0 760 210" preserveAspectRatio="none" aria-label="Grafik arus kas 6 bulan"><g><line x1="28" y1="42" x2="748" y2="42" className="f-chart-grid"/><line x1="28" y1="88" x2="748" y2="88" className="f-chart-grid"/><line x1="28" y1="134" x2="748" y2="134" className="f-chart-grid"/><line x1="28" y1="178" x2="748" y2="178" className="f-chart-grid"/></g><polyline points={poly(incomePoints)} className="f-chart-line-income"/><polyline points={poly(expensePoints)} className="f-chart-line-expense"/>{incomePoints.map(([x,y],i)=><circle key={`i${i}`} cx={x} cy={y} r="4" className="f-chart-point-income"/>)}{expensePoints.map(([x,y],i)=><circle key={`e${i}`} cx={x} cy={y} r="3.5" className="f-chart-point-expense"/>)}{monthBuckets.map((b,i)=><text key={b.label} x={28+(i*144)} y="199" textAnchor="middle" className="f-chart-axis">{b.label}</text>)}</svg></div></section>
  <section className="f-card"><div className="f-card-head"><div><h3>Aktivitas Terbaru</h3><p>Perubahan penting di workspace.</p></div></div><div className="f-list">{activities.length?activities.map(x=><div className="f-list-item" key={x.id}><div><strong>{x.title}</strong><div className="f-muted" style={{fontSize:11}}>{x.detail}</div></div><span className="f-muted" style={{fontSize:10}}>{x.when}</span></div>):<div className="f-empty">Belum ada aktivitas.</div>}</div></section></div>
  <div style={{height:16}}/><section className="f-card"><div className="f-card-head"><div><h3>Invoice yang perlu perhatian</h3><p>Prioritas untuk follow-up penagihan.</p></div><a className="f-btn soft" href="/invoices">Semua invoice</a></div>{unpaid.length?<div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Invoice</th><th>Klien</th><th>Jatuh tempo</th><th>Total</th><th>Status</th></tr></thead><tbody>{unpaid.slice(0,6).map(i=><tr key={i.id}><td><strong>{i.invoiceNumber}</strong></td><td>{i.client.name}</td><td>{new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(i.dueDate)}</td><td className="f-number">{money(Number(i.totalAmount))}</td><td><Badge tone={i.status==='OVERDUE'?'red':'amber'}>{i.status}</Badge></td></tr>)}</tbody></table></div>:<div className="f-empty"><strong>Belum ada invoice</strong>Buat proposal atau invoice manual untuk memulai.</div>}</section>
  <div className="f-footer">© 2026 Finora · Keuangan yang terkelola dengan baik membawa bisnis Anda lebih jauh.</div>
 </div></FinoraShell>
}
function Badge({children,tone}:{children:React.ReactNode;tone:'green'|'amber'|'red'}){return <span className={`f-badge ${tone}`}>{children}</span>}
