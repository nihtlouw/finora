import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { ExpensesManager } from '@/components/finance-managers'
export const dynamic='force-dynamic'
export default async function Page(){const c=await getCurrentFinoraContext();if(!c)redirect('/sign-in');return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Biaya"><ExpensesManager role={c.user.role}/></FinoraShell>}
