import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, nonNegativeMoney, requireText } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Payroll/employee data hanya dapat diakses Owner/Finance.' }, { status: 403 })

  const [rows, latestPayrollLines] = await Promise.all([
    prisma.employee.findMany({
      where: { workspaceId: c.workspace.id },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.payrollLine.findMany({
      where: { payrollRun: { workspaceId: c.workspace.id } },
      include: {
        payrollRun: {
          select: {
            id: true,
            runNumber: true,
            period: true,
            status: true,
            payDate: true,
          },
        },
      },
      orderBy: { payrollRun: { payDate: 'desc' } },
    }),
  ])

  const mask = (value: string | null) => value ? '••••' + value.slice(-4) : null
  const latestByEmployee = new Map<string, typeof latestPayrollLines[number]['payrollRun']>()
  for (const line of latestPayrollLines) {
    if (!latestByEmployee.has(line.employeeId)) latestByEmployee.set(line.employeeId, line.payrollRun)
  }

  const employees = rows.map((row) => ({
    ...row,
    taxId: mask(row.taxId),
    bankAccount: mask(row.bankAccount),
    latestPayroll: latestByEmployee.get(row.id) ?? null,
  }))

  return NextResponse.json({ employees })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })

  try {
    const b = await req.json()
    const salary = nonNegativeMoney(b.baseSalary ?? 0, 'Gaji pokok').decimal
    const employeeNo = requireText(b.employeeNo, 'NIK/nomor karyawan', 80)
    const name = requireText(b.name, 'Nama karyawan', 150)
    const employmentType = normalizeEmploymentType(b.employmentType)
    const joinDate = b.joinDate ? dateOnly(b.joinDate, 'Tanggal masuk') : null
    const endDate = b.endDate ? dateOnly(b.endDate, 'Tanggal keluar') : null

    if (joinDate && endDate && endDate < joinDate) {
      return NextResponse.json({ error: 'Tanggal keluar tidak boleh sebelum tanggal masuk.' }, { status: 400 })
    }

    const row = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          workspaceId: c.workspace.id,
          employeeNo,
          name,
          email: optionalTrim(b.email, 200),
          taxId: optionalTrim(b.taxId, 80),
          maritalStatus: optionalTrim(b.maritalStatus, 40),
          position: optionalTrim(b.position, 120),
          department: optionalTrim(b.department, 120),
          employmentType,
          joinDate,
          endDate,
          baseSalary: salary,
          bankName: optionalTrim(b.bankName, 100),
          bankAccount: optionalTrim(b.bankAccount, 100),
          isActive: b.isActive !== false,
        },
      })

      await writeAuditLog({
        workspaceId: c.workspace.id,
        actorUserId: c.user.id,
        action: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: employee.id,
        metadata: {
          employeeNo,
          name,
          position: employee.position,
          department: employee.department,
          employmentType,
        },
      })

      return employee
    })

    return NextResponse.json({ employee: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat karyawan.' }, { status: 400 })
  }
}
