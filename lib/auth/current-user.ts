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

async function getOrCreateWorkspace(userId: string, userName: string, configuredOwner: boolean) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  // IMPORTANT: once a membership exists, WorkspaceMember.role is the source
  // of truth. The bootstrap environment variable is only for first-time setup.
  if (membership) {
    if (configuredOwner && membership.role !== 'OWNER') {
      const existingOwner = await prisma.workspaceMember.findFirst({
        where: { workspaceId: membership.workspaceId, role: 'OWNER' },
        select: { id: true },
      })
      // Bootstrap may claim an ownerless workspace exactly once. Once any
      // owner exists, email/env can no longer override WorkspaceMember.role.
      if (!existingOwner) {
        return prisma.$transaction(async (tx) => {
          const updated = await tx.workspaceMember.update({
            where: { id: membership.id },
            data: { role: 'OWNER' },
            include: { workspace: true },
          })
          await tx.user.update({ where: { id: userId }, data: { role: 'OWNER' } })
          return updated
        })
      }
    }
    return membership
  }

  const role: FinoraRole = configuredOwner ? 'OWNER' : 'VIEWER'
  const base = slugify(`${userName}-workspace`)
  const suffix = userId.slice(-8).toLowerCase()
  const slugBase = `${base}-${suffix}`.slice(0, 63)

  try {
    return await prisma.workspaceMember.create({
      data: {
        role,
        user: { connect: { id: userId } },
        workspace: {
          create: {
            name: `${userName} Workspace`,
            slug: slugBase,
          },
        },
      },
      include: { workspace: true },
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existingAfterRace = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      })
      if (existingAfterRace) return existingAfterRace
    }
    throw error
  }
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
    // Do not derive an existing user's role from email/environment.
    // WorkspaceMember.role remains authoritative.
    user = existing.name !== name || existing.email !== email
      ? await prisma.user.update({ where: { id: existing.id }, data: { name, email } })
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

  const membership = await getOrCreateWorkspace(user.id, name, configuredOwner)
  const effectiveRole = normalizeRole(membership.role)
  if (user.role !== effectiveRole) {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: effectiveRole } })
  }
  const effectiveUser = { ...user, role: effectiveRole }

  return { user: effectiveUser, workspace: membership.workspace, membership }
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

export function canManageFinance(role: string) {
  return ['OWNER', 'FINANCE'].includes(normalizeRole(role))
}

export function canManageSales(role: string) {
  return ['OWNER', 'FINANCE', 'SALES'].includes(normalizeRole(role))
}
