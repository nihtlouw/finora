import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import EmployeeManager from '@/components/employee-manager'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const c = await getCurrentFinoraContext()
  if (!c) redirect('/sign-in')

  return (
    <FinoraShell workspaceName={c.workspace.name} role={c.user.role} title="employees">
      <EmployeeManager role={c.user.role} />
    </FinoraShell>
  )
}
