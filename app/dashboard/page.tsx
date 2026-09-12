import { redirect } from 'next/navigation'
import FinoraApp from '@/components/finora-app'
import { getCurrentFinoraUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentFinoraUser()

  if (!user) {
    redirect('/sign-in')
  }

  return <FinoraApp viewer={user} />
}
