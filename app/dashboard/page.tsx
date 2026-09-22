import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import { money, StatCard } from '@/components/finora-ui'
import CashFlowChart from '@/components/cash-flow-chart'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
 const context=await getCurrentFinoraContext(); if(!context) redirect('/sign-in')
 const clientIds=(await prisma.clientVendor.findMany({where:{workspaceId:context.workspace.id},select:{id:true}})).map(x=>x.id)
 const invoices=await prisma.invoice.findMany({
   where:{clientId:{in:clientIds}},
   include:{client:true,payments:{select:{amount:true}}},
   orderBy:{dueDate:'asc'},
   take:8
 })
 const sixMonthsStart=new Date()
 sixMonthsStart.setDate(1)
 sixMonthsStart.setHours(0,0,0,0)
 sixMonthsStart.setMonth(sixMonthsStart.getMonth()-5)

 const payments=await prisma.payment.findMany({
   where:{invoice:{clientId:{in:clientIds}},paymentDate:{gte:sixMonthsStart}},
   select:{amount:true,paymentDate:true,method:true,createdAt:true,invoice:{select:{invoiceNumber:true,client:{select:{name:true}},project:{select:{projectCode:true,projectName:true}}}}},
   orderBy:{paymentDate:'asc'}
 })
 const expenses=await prisma.expense.findMany({
   where:{workspaceId:context.workspace.id,status:'APPROVED',expenseDate:{gte:sixMonthsStart}},
   select:{amount:true,expenseDate:true,paymentMethod:true,category:true,description:true,createdAt:true,vendor:{select:{name:true}},project:{select:{projectCode:true,projectName:true}}},
   orderBy:{expenseDate:'asc'}
 )
 const recentPayments=await prisma.payment.findMany({
   where:{invoice:{clientId:{in:clientIds}}},
   include:{invoice:{select:{invoiceNumber:true,client:{select:{name:true}},project:{select:{projectCode:true}}}}},
   orderBy:{createdAt:'desc'},
   take:6
 })
 const recentExpenses=await prisma.expense.findMany({
   where:{workspaceId:context.workspace.id,status:'APPROVED'},
   include:{vendor:{select:{name:true}},project:{select:{projectCode:true}}},
   orderBy:{createdAt:'desc'},
   take:6
 })
 const recentInvoices=await prisma.invoice.findMany({
   where:{clientId:{in:clientIds}},
   include:{client:{select:{name:true}},project:{select:{projectCode:true}}},
   orderBy:{createdAt:'desc'},
   take:4
 })
 const income=payments.reduce((s,x)=>s+Number(x.amount),0)
 const expense=expenses.reduce((s,x)=>s+Number(x.amount),0)
 const unpaid=invoices.filter(x=>x.status!=='PAID')
 const receivable=unpaid.reduce((s,x)=>s+Math.max(0,Number(x.totalAmount)-x.payments.reduce((p,y)=>p+Number(y.amount),0)),0)
 const cashFlowTransactions=[
   ...payments.map(x=>({type:'income' as const,date:x.paymentDate.toISOString(),amount:Number(x.amount)})),
   ...expenses.map(x=>({type:'expense' as const,date:x.expenseDate.toISOString(),amount:Number(x.amount)})),
 ]
 const formatRelative=(date:Date)=>{
   const diff=Math.max(0,Date.now()-date.getTime())
   const minutes=Math.floor(diff/60000)
   if(minutes<1)return 'baru saja'
   if(minutes<60)return `${minutes} menit lalu`
   const hours=Math.floor(minutes/60)
   if(hours<24)return `${hours} jam lalu`
   const days=Math.floor(hours/24)
   if(days<7)return `${days} hari lalu`
   return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short'}).format(date)
 }
 const activities=[
   ...recentPayments.map(x=>({
     id:`payment-${x.id}`,
     kind:'payment' as const,
     title:'Pembayaran diterima',
     detail:`${x.invoice.invoiceNumber} · ${x.invoice.client.name}${x.invoice.project?.projectCode?` · ${x.invoice.project.projectCode}`:''}`,
     amount:money(Number(x.amount)),
     when:formatRelative(new Date(x.createdAt)),
     sortAt:new Date(x.createdAt).getTime(),
     href:`/invoices`,
   })),
   ...recentExpenses.map(x=>({
     id:`expense-${x.id}`,
     kind:'expense' as const,
     title:'Pengeluaran disetujui',
     detail:`${x.category}${x.vendor?.name?` · ${x.vendor.name}`:''}${x.project?.projectCode?` · ${x.project.projectCode}`:''}`,
     amount:money(Number(x.amount)),
     when:formatRelative(new Date(x.createdAt)),
     sortAt:new Date(x.createdAt).getTime(),
     href:'/expenses',
   })),
   ...recentInvoices.map(x=>({
     id:`invoice-${x.id}`,
     kind:x.status==='OVERDUE'?'warning' as const:'invoice' as const,
     title:x.status==='OVERDUE'?'Invoice overdue':'Invoice dibuat',
     detail:`${x.invoiceNumber} · ${x.client.name}${x.project?.projectCode?` · ${x.project.projectCode}`:''}`,
     amount:money(Number(x.totalAmount)),
     when:formatRelative(new Date(x.createdAt)),
     sortAt:new Date(x.createdAt).getTime(),
     href:'/invoices',
   }))
 ].sort((a,b)=>b.sortAt-a.sortAt).slice(0,5)
  return <FinoraShell workspaceName={context.workspace.name} role={context.user.role} title="Dashboard"><div className="f-content">
  <div className="f-pagehead"><div><div className="f-eyebrow">Overview</div><h1>Selamat datang, {context.user.name?.split(' ')[0]||'Pengguna'}!</h1><p>Kelola arus kas, tagihan, dan kesehatan finansial bisnis Anda dari satu tempat.</p></div><div className="f-actions"><a className="f-btn" href="/reports">Lihat laporan</a><a className="f-btn primary" href="/proposals">+ Buat proposal</a></div></div>
  <div className="f-grid-4">
   <StatCard label="Total pemasukan" value={money(income)} trend="Pembayaran masuk" icon="↗"/><StatCard label="Total pengeluaran" value={money(expense)} trend="Biaya tercatat" icon="↘"/><StatCard label="Piutang aktif" value={money(receivable)} trend={`${unpaid.length} invoice`} icon="◫"/><StatCard label="Arus kas bersih" value={money(income-expense)} trend="Income - Expense" icon="◎"/>
  </div><div style={{height:16}}/>
  <div className="f-kpi-row"><section className="f-card dashboard-cashflow-card"><div className="f-card-head"><div><h3>Arus Kas</h3><p>Pilih periode untuk melihat pergerakan kas secara detail.</p></div><span className="f-badge green"><i className="f-live-dot"/>Live dari database</span></div><CashFlowChart transactions={cashFlowTransactions}/></section>
  <section className="f-card dashboard-activity-card"><div className="f-card-head"><div><h3>Aktivitas Terbaru</h3><p>Pembayaran, pengeluaran, dan perubahan invoice terbaru.</p></div><span className="f-badge neutral">5 terbaru</span></div><div className="f-activity-feed">{activities.length?activities.map(x=><a className="f-activity-item" key={x.id} href={x.href}><span className={`f-activity-icon ${x.kind}`} aria-hidden="true">{x.kind==='payment'?'↗':x.kind==='expense'?'−':x.kind==='warning'?'!':'▤'}</span><span className="f-activity-body"><strong>{x.title}</strong><small>{x.detail}</small><em>{x.when}</em></span><span className="f-activity-amount">{x.amount}</span></a>):<div className="f-empty">Belum ada aktivitas.</div>}</div></section></div>
  <div style={{height:16}}/><section className="f-card"><div className="f-card-head"><div><h3>Invoice yang perlu perhatian</h3><p>Prioritas untuk follow-up penagihan.</p></div><a className="f-btn soft" href="/invoices">Semua invoice</a></div>{unpaid.length?<div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Invoice</th><th>Klien</th><th>Jatuh tempo</th><th>Total</th><th>Status</th></tr></thead><tbody>{unpaid.slice(0,6).map(i=><tr key={i.id}><td><strong>{i.invoiceNumber}</strong></td><td>{i.client.name}</td><td>{new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(i.dueDate)}</td><td className="f-number">{money(Number(i.totalAmount))}</td><td><Badge tone={i.status==='OVERDUE'?'red':'amber'}>{i.status}</Badge></td></tr>)}</tbody></table></div>:<div className="f-empty"><strong>Belum ada invoice</strong>Buat proposal atau invoice manual untuk memulai.</div>}</section>
  <div className="f-footer">© 2026 Finora · Keuangan yang terkelola dengan baik membawa bisnis Anda lebih jauh.</div>
 </div></FinoraShell>
}
function Badge({children,tone}:{children:React.ReactNode;tone:'green'|'amber'|'red'}){return <span className={`f-badge ${tone}`}>{children}</span>}
