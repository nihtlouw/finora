import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { PageHeader,Card,StatCard,money,Badge } from '@/components/finora-ui'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
export const dynamic='force-dynamic'
export default async function ReportsPage(){
 const c=await getCurrentFinoraContext();if(!c)redirect('/sign-in')
 const clients=await prisma.clientVendor.findMany({where:{workspaceId:c.workspace.id},select:{id:true}})
 const ids=clients.map(x=>x.id)
 const payments=await prisma.payment.findMany({where:{invoice:{clientId:{in:ids}}},select:{amount:true}})
 const expenses=await prisma.expense.findMany({where:{vendorId:{in:ids}},select:{amount:true,category:true}})
 const income=payments.reduce((s,x)=>s+Number(x.amount),0),expense=expenses.reduce((s,x)=>s+Number(x.amount),0)
 const cats=Object.entries(expenses.reduce((a:any,x)=>{a[x.category]=(a[x.category]||0)+Number(x.amount);return a},{})).sort((a:any,b:any)=>b[1]-a[1])
 return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Laporan"><div className="f-content"><PageHeader eyebrow="Analisis" title="Laporan Keuangan" description="Ringkasan performa finansial berdasarkan transaksi yang tersimpan." action={<a className="f-btn primary" href="/api/reports/export">Export CSV</a>}/><div className="f-grid-3"><StatCard label="Pendapatan" value={money(income)} trend="Payment tercatat" icon="↗"/><StatCard label="Beban" value={money(expense)} trend="Expense tercatat" icon="↘"/><StatCard label="Laba bersih" value={money(income-expense)} trend={income>=expense?'Positif':'Perlu perhatian'} icon="◎"/></div><div style={{height:16}}/><div className="f-grid-3"><Card className="pad"><div className="f-card-head"><div><h3>Pendapatan vs Beban</h3><p>Periode data saat ini.</p></div></div><div style={{padding:18}}><div className="f-progress"><span style={{width:`${income+expense?Math.min(100, income/(income+expense)*100):0}%`}}/></div><div className="f-list-item"><span>Pendapatan</span><strong>{money(income)}</strong></div><div className="f-list-item"><span>Beban</span><strong>{money(expense)}</strong></div></div></Card><Card><div className="f-card-head"><div><h3>Beban per kategori</h3><p>Top cost drivers.</p></div></div><div className="f-list">{cats.slice(0,6).map(([k,v]:any)=><div className="f-list-item" key={k}><span>{k}</span><strong>{money(v)}</strong></div>)}</div></Card><Card><div className="f-card-head"><div><h3>Financial health</h3><p>Sinyal sederhana untuk keputusan cepat.</p></div></div><div style={{padding:18}}><div style={{fontSize:44,fontWeight:900,color:income>=expense?'#0f6d5f':'#c75b4b'}}>{income+expense?Math.round(Math.max(0,Math.min(100,income/(income+expense)*100))):0}</div><p className="f-muted">Skor berdasarkan rasio arus masuk terhadap beban yang sudah tercatat.</p><Badge tone={income>=expense?'green':'red'}>{income>=expense?'Sehat':'Perlu perhatian'}</Badge></div></Card></div></div></FinoraShell>
}
