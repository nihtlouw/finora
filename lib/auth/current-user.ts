import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const FINORA_ROLES = ['OWNER', 'FINANCE', 'SALES', 'VIEWER'] as const
export type FinoraRole = (typeof FINORA_ROLES)[number]

function normalizeRole(role: string | null | undefined): FinoraRole {
  if (role && FINORA_ROLES.includes(role as FinoraRole)) {
    return role as FinoraRole
  }
  return 'VIEWER'
}

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function isConfiguredOwner({ clerkId, email }: { clerkId: string; email: string }) {
  const ownerEmails = parseCsv(process.env.FINORA_OWNER_EMAILS)
  const ownerClerkIds = parseCsv(process.env.FINORA_OWNER_CLERK_IDS)

  return ownerEmails.includes(email.toLowerCase()) || ownerClerkIds.includes(clerkId.toLowerCase())
}

export async function getCurrentFinoraUser() {
  const { userId } = await auth()

  if (!userId) {
    return null
  }

  const clerkUser = await currentUser()

  if (!clerkUser) {
    return null
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    throw new Error('Akun Clerk belum memiliki alamat email yang dapat digunakan Finora.')
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
    email.split('@')[0] ||
    'Pengguna Finora'

  const owner = isConfiguredOwner({ clerkId: userId, email })
  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
  })

  if (existing) {
    const shouldPromoteConfiguredOwner = owner
    const shouldDemoteUnauthorizedOwner = existing.role === 'OWNER' && !owner
    const nextRole = shouldPromoteConfiguredOwner
      ? 'OWNER'
      : shouldDemoteUnauthorizedOwner
        ? 'VIEWER'
        : normalizeRole(existing.role)

    if (
      existing.name !== name ||
      existing.email !== email ||
      existing.role !== nextRole
    ) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { name, email, role: nextRole },
      })
    }

    return existing
  }

  return prisma.user.create({
    data: {
      clerkId: userId,
      name,
      email,
      role: owner ? 'OWNER' : 'VIEWER',
    },
  })
}

export function roleLabel(role: string): string {
  switch (normalizeRole(role)) {
    case 'OWNER':
      return 'Owner / Admin'
    case 'FINANCE':
      return 'Finance'
    case 'SALES':
      return 'Sales / Marketing'
    case 'VIEWER':
      return 'Viewer'
  }
}

export function roleShortLabel(role: string): string {
  switch (normalizeRole(role)) {
    case 'OWNER':
      return 'Owner'
    case 'FINANCE':
      return 'Finance'
    case 'SALES':
      return 'Sales'
    case 'VIEWER':
      return 'Viewer'
  }
}
