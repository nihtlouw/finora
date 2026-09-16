import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import ExpenseCostControlManager from '@/components/expense-cost-control-manager'
export const dynamic='force-dynamic'
export default async function Page(){const c=await getCurrentFinoraContext();if(!c)redirect('/sign-in');return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Biaya"><ExpenseCostControlManager role={c.user.role}/></FinoraShell>}
