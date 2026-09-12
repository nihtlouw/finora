import { NextResponse } from 'next/server'
import { getCurrentFinoraUser, roleLabel } from '@/lib/auth/current-user'

export async function GET() {
  try {
    const user = await getCurrentFinoraUser()

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        role: user.role,
        roleLabel: roleLabel(user.role),
      },
    })
  } catch (error) {
    console.error('GET /api/me failed:', error)

    return NextResponse.json(
      { authenticated: false, error: 'Unable to load Finora user.' },
      { status: 500 },
    )
  }
}
