import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { canManageClients, getCurrentFinoraContext } from '@/lib/auth/current-user'
import { validateClientVendorPayload } from '@/lib/validation/client-vendor'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })

  const url = new URL(request.url)
  const search = url.searchParams.get('q')?.trim() ?? ''
  const type = url.searchParams.get('type')?.trim().toUpperCase()

  const clients = await prisma.clientVendor.findMany({
    where: {
      workspaceId: context.workspace.id,
      ...(type === 'CLIENT' || type === 'VENDOR' ? { type } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { picName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      picName: true,
      address: true,
      npwp: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ workspace: context.workspace, clients })
}

export async function POST(request: Request) {
  const context = await getCurrentFinoraContext()
  if (!context) return NextResponse.json({ authenticated: false }, { status: 401 })
  if (!canManageClients(context.user.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses untuk menambah kontak.' }, { status: 403 })
  }

  try {
    const payload = validateClientVendorPayload(await request.json())
    const duplicate = await prisma.clientVendor.findFirst({
      where: {
        workspaceId: context.workspace.id,
        name: { equals: payload.name, mode: 'insensitive' },
        type: payload.type,
      },
    })

    if (duplicate) {
      return NextResponse.json({ error: 'Kontak dengan nama dan tipe tersebut sudah ada.' }, { status: 409 })
    }

    const client = await prisma.clientVendor.create({
      data: {
        workspaceId: context.workspace.id,
        ...payload,
      },
    })

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat kontak.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
