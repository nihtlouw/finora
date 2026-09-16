import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import ProjectMilestoneManager from '@/components/project-milestone-manager'
import ProjectStatusControl from '@/components/project-status-control'
import ProjectExpenseSection from '@/components/project-expense-section'
import ProjectProfitabilityCard from '@/components/project-profitability-card'
import ProjectDocumentsManager from '@/components/project-documents-manager'
import { getProjectProfitability } from '@/lib/project-profitability'

export const dynamic='force-dynamic'

export default async function Page({params}:{params:Promise<{id:string}>}){
 const c=await getCurrentFinoraContext();
 if(!c)redirect('/sign-in');
 if(!['OWNER','FINANCE'].includes(c.user.role))redirect('/dashboard');
 const {id}=await params;
 const p=await prisma.project.findFirst({where:{id,workspaceId:c.workspace.id},include:{client:true,proposal:true,customerPO:true,expenses:{select:{id:true,category:true,amount:true,expenseDate:true,status:true,payeeName:true,vendor:{select:{id:true,name:true}}},orderBy:{expenseDate:'desc'}}}});
 if(!p)notFound();
 const profitability=await getProjectProfitability(c.workspace.id,p.id);
 const contractValue=profitability?.contractValue ?? Number(p.customerPO?.grandTotal ?? p.contractValue);
 const projectExpenses=p.expenses.map((expense)=>({id:expense.id,category:expense.category,amount:Number(expense.amount),expenseDate:expense.expenseDate.toISOString(),status:expense.status,payeeName:expense.payeeName,vendor:expense.vendor}));
 return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Detail Project"><div className="f-content f-detail-page">
  <PageHeader eyebrow="PROJECT COMMERCIAL" title={p.projectName} description="Project dibuat dari PO customer dan quotation yang disetujui." action={<div className="f-actions"><Link className="f-btn" href="/projects">← Kembali</Link></div>} />
  <div className="f-detail-hero"><div className="f-detail-identity"><div className="f-contact-avatar client">P</div><div><div className="f-eyebrow">Project</div><h2>{p.projectCode}</h2><p>{p.client.name} · {p.location||'Lokasi belum diisi'}</p></div></div><div className="f-detail-actions"><Badge tone={p.status==='ACTIVE'||p.status==='COMPLETED'?'green':p.status==='CANCELLED'?'red':'amber'}>{p.status}</Badge><ProjectStatusControl projectId={p.id} status={p.status}/></div></div>
  {p.customerPO && Math.abs(Number(p.customerPO.grandTotal)-Number(p.contractValue)) > 0.009 && <div className="f-inline-alert warning f-project-value-warning"><strong>Nilai project perlu sinkronisasi.</strong> Nilai kontrak project berbeda dari Grand Total PO. Project: {money(Number(p.contractValue))} · PO: {money(Number(p.customerPO.grandTotal))}.</div>}
  <div className="f-grid-4 f-detail-kpis f-project-financial-kpis">
    <StatCard label="Contract value (PO)" value={money(contractValue)} icon="Rp"/>
    <StatCard label="Invoiced (actual)" value={money(profitability?.billedAmount ?? 0)} icon="↗"/>
    <StatCard label="Collected (actual)" value={money(profitability?.collectedAmount ?? 0)} icon="◷"/>
    <StatCard label="Actual cost to date" value={money(profitability?.actualCost ?? 0)} icon="−"/>
  </div>

  <nav className="f-project-section-nav" aria-label="Navigasi section project">
    <a href="#profitability-project">Profitability</a>
    <a href="#expenses-project">Expenses</a>
    <a href="#billing-payment">Billing &amp; payment</a>
    <a href="#project-information">Project info</a>
  </nav>

  <div className="f-detail-main-grid" id="project-information"><Card><div className="f-card-head"><div><h3>Informasi project</h3><p>Identitas project dan sumber dokumennya.</p></div></div><div className="f-detail-profile-grid"><div><span>Kode project</span><strong>{p.projectCode}</strong></div><div><span>Klien</span><strong>{p.client.name}</strong></div><div><span>Lokasi</span><strong>{p.location||'—'}</strong></div><div><span>Nilai kontrak (PO)</span><strong>{money(contractValue)}</strong></div><div><span>Mulai</span><strong>{p.startDate?new Date(p.startDate).toLocaleDateString('id-ID'):'—'}</strong></div><div><span>Target selesai</span><strong>{p.targetEndDate?new Date(p.targetEndDate).toLocaleDateString('id-ID'):'—'}</strong></div><div><span>Quotation</span><strong>{p.proposal?.proposalNumber||'—'}</strong></div><div><span>PO Customer</span><strong>{p.customerPO?.poNumber||'—'}</strong></div><div className="full"><span>Catatan</span><strong>{p.notes||'—'}</strong></div></div></Card><Card><div className="f-card-head"><div><h3>Status dokumen</h3><p>Referensi commercial yang membentuk project.</p></div></div><div className="f-list"><div className="f-list-item"><span>Proposal</span><strong>{p.proposal?.status||'—'}</strong></div><div className="f-list-item"><span>PO</span><strong>{p.customerPO?.status||'—'}</strong></div><div className="f-list-item"><span>Grand total PO</span><strong>{p.customerPO?money(Number(p.customerPO.grandTotal)):'—'}</strong></div></div></Card></div>

  {profitability && <ProjectProfitabilityCard data={profitability} />}
  <div id="expenses-project"><ProjectExpenseSection rows={projectExpenses} /></div>

  <ProjectMilestoneManager projectId={p.id} contractValue={contractValue} role={c.user.role} />
  <ProjectDocumentsManager projectId={p.id} role={c.user.role} />
 </div></FinoraShell>
}
