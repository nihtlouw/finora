import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, nonNegativeMoney } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

const EMPLOYMENT_TYPES = new Set(['FULL_TIME', 'CONTRACT', 'DAILY_WORKER', 'INTERN'])

function optionalTrim(value: unknown, max = 200) {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text ? text.slice(0, max) : null
}

function normalizeEmploymentType(value: unknown) {
  const type = String(value ?? 'FULL_TIME').trim().toUpperCase()
  if (!EMPLOYMENT_TYPES.has(type)) throw new Error('Jenis kepegawaian tidak valid.')
  return type
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Payroll/employee data hanya dapat diakses Owner/Finance.' }, { status: 403 })

  const { id } = await params
  const employee = await prisma.employee.findFirst({
    where: { id, workspaceId: c.workspace.id },
    include: {
      payrollLines: {
        orderBy: { payrollRun: { payDate: 'desc' } },
        take: 24,
        include: {
          payrollRun: {
            select: {
              id: true,
              runNumber: true,
              period: true,
              status: true,
              payDate: true,
              grossAmount: true,
              deductionAmount: true,
              netAmount: true,
            },
          },
          allocations: {
            include: {
              project: {
                select: { id: true, projectCode: true, projectName: true, status: true },
              },
            },
          },
        },
      },
    },
  })

  if (!employee) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 })

  return NextResponse.json({ employee })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })

  try {
    const { id } = await params
    const row = await prisma.employee.findFirst({ where: { id, workspaceId: c.workspace.id } })
    if (!row) return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 })

    const b = await req.json()
    const joinDate = b.joinDate !== undefined ? (b.joinDate ? dateOnly(b.joinDate, 'Tanggal masuk') : null) : undefined
    const endDate = b.endDate !== undefined ? (b.endDate ? dateOnly(b.endDate, 'Tanggal keluar') : null) : undefined
    const effectiveJoinDate = joinDate === undefined ? row.joinDate : joinDate
    const effectiveEndDate = endDate === undefined ? row.endDate : endDate
    if (effectiveJoinDate && effectiveEndDate && effectiveEndDate < effectiveJoinDate) {
      return NextResponse.json({ error: 'Tanggal keluar tidak boleh sebelum tanggal masuk.' }, { status: 400 })
    }

    const data = {
      name: b.name !== undefined ? String(b.name).trim() : undefined,
      email: b.email !== undefined ? optionalTrim(b.email, 200) : undefined,
      taxId: b.taxId !== undefined ? optionalTrim(b.taxId, 80) : undefined,
      maritalStatus: b.maritalStatus !== undefined ? optionalTrim(b.maritalStatus, 40) : undefined,
      position: b.position !== undefined ? optionalTrim(b.position, 120) : undefined,
      department: b.department !== undefined ? optionalTrim(b.department, 120) : undefined,
      employmentType: b.employmentType !== undefined ? normalizeEmploymentType(b.employmentType) : undefined,
      joinDate,
      endDate,
      baseSalary: b.baseSalary !== undefined ? nonNegativeMoney(b.baseSalary, 'Gaji pokok').decimal : undefined,
      bankName: b.bankName !== undefined ? optionalTrim(b.bankName, 100) : undefined,
      bankAccount: b.bankAccount !== undefined ? optionalTrim(b.bankAccount, 100) : undefined,
      isActive: b.isActive !== undefined ? Boolean(b.isActive) : undefined,
    }

    const updated = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({ where: { id }, data })
      await writeAuditLog({
        workspaceId: c.workspace.id,
        actorUserId: c.user.id,
        action: 'UPDATE',
        entityType: 'EMPLOYEE',
        entityId: id,
        metadata: { changes: Object.keys(b) },
      })
      return employee
    })

    return NextResponse.json({ employee: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memperbarui karyawan.' }, { status: 400 })
  }
}
