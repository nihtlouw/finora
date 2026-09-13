import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canDeleteClients, canManageClients, getCurrentFinoraContext } from '@/lib/auth/current-user'
import { validateClientVendorPayload } from '@/lib/validation/client-vendor'

export const dynamic = 'force-dynamic'

async function getOwnedClient(id: string, workspaceId: string) {
  return prisma.clientVendor.findFirst({ where: { id, workspaceId } })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })
  if (!canManageClients(context.user.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses untuk mengubah kontak.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getOwnedClient(id, context.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Kontak tidak ditemukan.' }, { status: 404 })

  try {
    const payload = validateClientVendorPayload(await request.json())
    const duplicate = await prisma.clientVendor.findFirst({
      where: {
        workspaceId: context.workspace.id,
        id: { not: id },
        name: { equals: payload.name, mode: 'insensitive' },
        type: payload.type,
      },
    })

    if (duplicate) return NextResponse.json({ error: 'Kontak dengan nama dan tipe tersebut sudah ada.' }, { status: 409 })

    const client = await prisma.clientVendor.update({ where: { id }, data: payload })
    return NextResponse.json({ client })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui kontak.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })
  if (!canDeleteClients(context.user.role)) {
    return NextResponse.json({ error: 'Hanya Owner atau Finance yang dapat menonaktifkan kontak.' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getOwnedClient(id, context.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Kontak tidak ditemukan.' }, { status: 404 })

  const linkedCounts = await prisma.$transaction([
    prisma.proposal.count({ where: { clientId: id } }),
    prisma.invoice.count({ where: { clientId: id } }),
    prisma.expense.count({ where: { vendorId: id } }),
  ])

  const hasHistory = linkedCounts.some((count) => count > 0)
  const client = hasHistory
    ? await prisma.clientVendor.update({ where: { id }, data: { isActive: false } })
    : await prisma.clientVendor.delete({ where: { id } })

  return NextResponse.json({ client, action: hasHistory ? 'archived' : 'deleted' })
}
