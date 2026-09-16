import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import ReceivablesManager from '@/components/receivables-manager'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const c = await getCurrentFinoraContext()
  if (!c) redirect('/sign-in')
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) redirect('/dashboard')
  return <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="Piutang"><ReceivablesManager /></FinoraShell>
}
