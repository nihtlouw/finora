import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import PayrollManager from '@/components/payroll-manager'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  const c = await getCurrentFinoraContext()
  if (!c) redirect('/sign-in')
  if (!['OWNER', 'FINANCE'].includes(c.user.role)) redirect('/dashboard')

  return (
    <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="payroll">
      <PayrollManager role={c.user.role} />
    </FinoraShell>
  )
}
