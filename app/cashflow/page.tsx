import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import CashflowManager from '@/components/cashflow-manager'

export const dynamic='force-dynamic'

export default async function CashflowPage(){
 const c=await getCurrentFinoraContext();
 if(!c) redirect('/sign-in')
 const rows=await prisma.cashflowTransaction.findMany({
  where:{OR:[
   {workspaceId:c.workspace.id},
   {payment:{invoice:{client:{workspaceId:c.workspace.id}}}},
   {expense:{vendor:{workspaceId:c.workspace.id}}},
  ]},
  orderBy:{transactionDate:'desc'},
  take:200,
 })
 const serialised=rows.map(x=>({id:x.id,type:x.type as 'INCOME'|'EXPENSE',category:x.category,amount:Number(x.amount),transactionDate:x.transactionDate.toISOString(),sourceRef:x.sourceRef,paymentId:x.paymentId,expenseId:x.expenseId}))
 return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Cash Flow"><CashflowManager role={c.user.role} initialRows={serialised}/></FinoraShell>
}
