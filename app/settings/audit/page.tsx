import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import AuditLogPanel from '@/components/audit-log-panel'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'

export const dynamic='force-dynamic'

export default async function AuditPage(){
 const c=await getCurrentFinoraContext()
 if(!c) redirect('/sign-in')
 if(!['OWNER','FINANCE'].includes(c.user.role)) redirect('/settings')
 return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Audit Log"><AuditLogPanel/></FinoraShell>
}
