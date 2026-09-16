import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not configured.')
const adapter = new PrismaPg({ connectionString: url, max: 4 })
const prisma = new PrismaClient({ adapter })
const failures=[]
const money=(x)=>Number(x)

try {
  const workspaces = await prisma.workspace.findMany({ select:{id:true} })
  for (const ws of workspaces) {
    const proposals = await prisma.proposal.findMany({ where:{client:{workspaceId:ws.id}}, select:{id:true,status:true}, })
    const pos = await prisma.customerPO.findMany({ where:{workspaceId:ws.id}, select:{id:true,quotationId:true,status:true,grandTotal:true,quotationGrandTotalSnapshot:true,commercialVarianceAmount:true,commercialVarianceReason:true,project:{select:{id:true,contractValue:true}}, quotation:{select:{status:true}}} })
    const activeByProposal=new Map()
    for(const po of pos){ if(['RECEIVED','VERIFIED'].includes(po.status) && po.quotationId) activeByProposal.set(po.quotationId,(activeByProposal.get(po.quotationId)||0)+1)
      if(po.project && money(po.project.contractValue)!==money(po.grandTotal)) failures.push(`Workspace ${ws.id}: Project contractValue != PO grandTotal for ${po.id}`)
      if(po.status!=='CANCELLED' && money(po.grandTotal)!==money(po.quotationGrandTotalSnapshot) && !po.commercialVarianceReason) failures.push(`Workspace ${ws.id}: PO ${po.id} variance without reason`)
    }
    for(const [proposalId,count] of activeByProposal){ if(count>1) failures.push(`Workspace ${ws.id}: Proposal ${proposalId} has ${count} active POs`) }
    for(const po of pos){ if(['RECEIVED','VERIFIED'].includes(po.status) && po.quotationId && po.quotation?.status !== 'WON') failures.push(`PO ${po.id}: active PO does not point to WON proposal`) }

    const projects = await prisma.project.findMany({ where:{workspaceId:ws.id}, select:{id:true,contractValue:true,customerPO:{select:{id:true,status:true,grandTotal:true,quotation:{select:{status:true}}}},proposal:{select:{id:true,status:true}}} })
    for(const project of projects){ if(!project.customerPO || project.customerPO.status!=='VERIFIED') failures.push(`Project ${project.id}: missing VERIFIED customer PO`); if(project.proposal && project.proposal.status!=='WON') failures.push(`Project ${project.id}: linked proposal is not WON`); if(project.customerPO && Math.abs(money(project.contractValue)-money(project.customerPO.grandTotal))>0.005) failures.push(`Project ${project.id}: contract value != PO grand total`) }

    const invoices = await prisma.invoice.findMany({ where:{client:{workspaceId:ws.id}}, select:{id:true,status:true,totalAmount: true,projectId:true,billingMilestoneId:true,payments:{select:{amount:true}}, creditNotes:{where:{status:'ISSUED'},select:{totalAmount:true}}} })
    for(const inv of invoices){
      const paid=inv.payments.reduce((s,p)=>s+money(p.amount),0)
      if(paid-money(inv.totalAmount)>0.005) failures.push(`Invoice ${inv.id}: payments exceed invoice total`)
      if(inv.projectId && !inv.billingMilestoneId) failures.push(`Invoice ${inv.id}: project invoice has no billing milestone`)
      const credits=inv.creditNotes.reduce((s,c)=>s+money(c.totalAmount),0)
      if(credits+paid-money(inv.totalAmount)>0.005) failures.push(`Invoice ${inv.id}: payment + credit notes exceed total`)
    }

    const expenses = await prisma.expense.findMany({ where:{workspaceId:ws.id}, select:{id:true,status:true,settlementStatus:true,allocationType:true,allocations:{select:{percentage:true,amount:true}}} })
    for(const e of expenses){ if(e.settlementStatus==='PAID' && e.status!=='APPROVED') failures.push(`Expense ${e.id}: PAID without APPROVED`); const pct=e.allocations.reduce((s,a)=>s+money(a.percentage),0); if(['DIRECT','SHARED'].includes(e.allocationType) && Math.abs(pct-100)>0.01) failures.push(`Expense ${e.id}: allocation ${pct}% != 100%`) }

    const bills=await prisma.vendorBill.findMany({where:{workspaceId:ws.id},select:{id:true,subtotalAmount:true,taxAmount:true,totalAmount:true,status:true,payments:{select:{amount:true}}}})
    for(const bill of bills){const paid=bill.payments.reduce((s,p)=>s+money(p.amount),0);if(paid-money(bill.totalAmount)>0.005) failures.push(`VendorBill ${bill.id}: payments exceed bill`);if(Math.abs((money(bill.subtotalAmount)+money(bill.taxAmount))-money(bill.totalAmount))>0.005) failures.push(`VendorBill ${bill.id}: subtotal + tax != total`) }

    const changeOrders=await prisma.contractChangeOrder.findMany({where:{workspaceId:ws.id},select:{id:true,status:true,changeType:true,requestedAmount:true,approvedAmount:true}})
    for(const co of changeOrders){if(!['INCREASE','DECREASE'].includes(co.changeType)) failures.push(`ChangeOrder ${co.id}: invalid changeType`);if(co.status==='APPROVED' && money(co.approvedAmount)<=0) failures.push(`ChangeOrder ${co.id}: approved order has zero amount`)}

    const bankRecons=await prisma.bankReconciliation.findMany({where:{workspaceId:ws.id},select:{id:true,status:true,bookBalance:true,statementEndingBalance:true,difference:true}})
    for(const rec of bankRecons){if(rec.status==='RECONCILED' && Math.abs(money(rec.difference))>0.005) failures.push(`BankReconciliation ${rec.id}: RECONCILED with non-zero difference`);if(Math.abs(money(rec.bookBalance)-money(rec.statementEndingBalance)-money(rec.difference))>0.005) failures.push(`BankReconciliation ${rec.id}: difference arithmetic mismatch`)}

    const creditNotes=await prisma.creditNote.findMany({where:{workspaceId:ws.id},select:{id:true,status:true,subtotalAmount:true,taxAmount:true,totalAmount:true}})
    for(const note of creditNotes){if(Math.abs((money(note.subtotalAmount)+money(note.taxAmount))-money(note.totalAmount))>0.005) failures.push(`CreditNote ${note.id}: subtotal + tax != total`)}

    const payrolls=await prisma.payrollRun.findMany({where:{workspaceId:ws.id},select:{id:true,grossAmount:true,deductionAmount:true,netAmount:true,lines:{select:{grossAmount:true,pph21Amount:true,bpjsAmount:true,otherDeduction:true,netAmount:true,allocations:{select:{percentage:true}}}}}})
    for(const run of payrolls){const lineNet=run.lines.reduce((s,l)=>s+money(l.netAmount),0);if(Math.abs(lineNet-money(run.netAmount))>0.01) failures.push(`Payroll ${run.id}: line net != run net`);for(const l of run.lines){const pct=l.allocations.reduce((s,a)=>s+money(a.percentage),0);if(pct>100.01) failures.push(`Payroll ${run.id}: allocation > 100%`)}}
  }
} finally { await prisma.$disconnect() }
if(failures.length){ console.error('FINORA ENTERPRISE QA FAILED'); for(const f of failures) console.error(' -',f); process.exit(1) }
console.log('FINORA ENTERPRISE QA PASSED')
