import { auth } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'

export default async function DashboardPage() {
  const { userId } = await auth()

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Authenticated as</p>
          <h1 className="text-2xl font-semibold">Finora Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">{userId}</p>
        </div>

        <UserButton />
      </div>
    </main>
  )
}
