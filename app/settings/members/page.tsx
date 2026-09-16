import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import WorkspaceMembersManager from '@/components/workspace-members-manager'
export const dynamic='force-dynamic'
export default async function WorkspaceMembersPage(){const c=await getCurrentFinoraContext();if(!c)redirect('/sign-in');if(c.user.role!=='OWNER')redirect('/settings');return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Anggota Workspace"><WorkspaceMembersManager/></FinoraShell>}
