import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import EnterpriseList from '@/components/enterprise-list'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
export const dynamic='force-dynamic'
export default async function Page(){const c=await getCurrentFinoraContext();if(!c)redirect('/sign-in');return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="payroll"><EnterpriseList module="payroll" role={c.user.role}/></FinoraShell>}
