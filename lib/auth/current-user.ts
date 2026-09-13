import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const FINORA_ROLES = ['OWNER', 'FINANCE', 'SALES', 'VIEWER'] as const
export type FinoraRole = (typeof FINORA_ROLES)[number]

function normalizeRole(role: string | null | undefined): FinoraRole {
  if (role && FINORA_ROLES.includes(role as FinoraRole)) return role as FinoraRole
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'workspace'
}

async function getOrCreateWorkspace(userId: string, userName: string, userRole: FinoraRole) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  })

  if (membership) {
    const desiredRole = userRole
    if (membership.role !== desiredRole) {
      return prisma.workspaceMember.update({
        where: { id: membership.id },
        data: { role: desiredRole },
        include: { workspace: true },
      })
    }
    return membership
  }

  const base = slugify(`${userName}-workspace`)
  const suffix = userId.slice(-8).toLowerCase()
  const slug = `${base}-${suffix}`.slice(0, 63)

  return prisma.workspaceMember.create({
    data: {
      role: userRole,
      user: { connect: { id: userId } },
      workspace: {
        create: {
          name: `${userName} Workspace`,
          slug,
        },
      },
    },
    include: { workspace: true },
  })
}

export async function getCurrentFinoraContext() {
  const { userId } = await auth()
  if (!userId) return null

  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) throw new Error('Akun Clerk belum memiliki alamat email yang dapat digunakan Finora.')

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
    email.split('@')[0] ||
    'Pengguna Finora'

  const configuredOwner = isConfiguredOwner({ clerkId: userId, email })
  const existing = await prisma.user.findUnique({ where: { clerkId: userId } })

  let user
  if (existing) {
    const nextRole: FinoraRole = configuredOwner
      ? 'OWNER'
      : existing.role === 'OWNER'
        ? 'VIEWER'
        : normalizeRole(existing.role)

    user = existing.name !== name || existing.email !== email || existing.role !== nextRole
      ? await prisma.user.update({ where: { id: existing.id }, data: { name, email, role: nextRole } })
      : existing
  } else {
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        name,
        email,
        role: configuredOwner ? 'OWNER' : 'VIEWER',
      },
    })
  }

  const role = normalizeRole(user.role)
  const membership = await getOrCreateWorkspace(user.id, name, role)

  return { user, workspace: membership.workspace, membership }
}

export async function getCurrentFinoraUser() {
  const context = await getCurrentFinoraContext()
  return context?.user ?? null
}

export function roleLabel(role: string): string {
  switch (normalizeRole(role)) {
    case 'OWNER': return 'Owner / Admin'
    case 'FINANCE': return 'Finance'
    case 'SALES': return 'Sales / Marketing'
    case 'VIEWER': return 'Viewer'
  }
}

export function roleShortLabel(role: string): string {
  switch (normalizeRole(role)) {
    case 'OWNER': return 'Owner'
    case 'FINANCE': return 'Finance'
    case 'SALES': return 'Sales'
    case 'VIEWER': return 'Viewer'
  }
}

export function canManageClients(role: string) {
  return ['OWNER', 'FINANCE', 'SALES'].includes(normalizeRole(role))
}

export function canDeleteClients(role: string) {
  return ['OWNER', 'FINANCE'].includes(normalizeRole(role))
}
