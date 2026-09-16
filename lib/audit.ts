import { prisma } from '@/lib/db/prisma'
export async function writeAuditLog(input: {
  workspaceId: string
  actorUserId: string
  action: string
  entityType: string
  entityId?: string | null
  metadata?: unknown
}) {
  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as any,
    },
  })
}
