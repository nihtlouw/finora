import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, positiveMoney, requireText } from '@/lib/validation/finance'
import { parseAllocationPercentage } from '@/lib/expenses'
import { writeAuditLog } from '@/lib/audit'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

type PayrollAllocationInput = { projectId: string; percentage: string | number }
type PayrollLineInput = {
  employeeId: string
  grossAmount: string | number
  pph21Amount?: string | number
  bpjsAmount?: string | number
  otherDeduction?: string | number
  taxableAmount?: string | number
  allocations?: PayrollAllocationInput[]
}

function allocationAmountFromCents(grossCents: bigint, percentage: number) {
  const basisPoints = parseAllocationPercentage(percentage)
  return (grossCents * BigInt(basisPoints) / 10000n).toString()
}

export async function GET() {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Payroll data hanya dapat diakses Owner/Finance.' }, { status: 403 })

  const rows = await prisma.payrollRun.findMany({
    where: { workspaceId: c.workspace.id },
    include: {
      lines: { include: { employee: true, allocations: { include: { project: { select: { id: true, projectCode: true, projectName: true, status: true } } } } } },
      cashflow: { select: { id: true, amount: true, transactionDate: true, category: true } },
    },
    orderBy: [{ period: 'desc' }, { payDate: 'desc' }],
  })

  const payrollRuns = rows.map((row) => ({
    ...row,
    headcount: row.lines.length,
  }))

  return NextResponse.json({ payrollRuns })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext()
  if (!c) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!canManageFinance(c.user.role)) return NextResponse.json({ error: 'Tidak memiliki akses.' }, { status: 403 })

  try {
    const b = await req.json()
    const period = requireText(b.period, 'Periode', 7)
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Periode payroll harus YYYY-MM.')

    const payDate = dateOnly(b.payDate, 'Tanggal payroll')
    await assertAccountingPeriodOpen(c.workspace.id, payDate)

    const lines = Array.isArray(b.lines) ? b.lines as PayrollLineInput[] : []
    if (!lines.length) throw new Error('Minimal satu karyawan.')

    const employeeIds = lines.map((line) => String(line.employeeId))
    if (new Set(employeeIds).size !== employeeIds.length) {
      throw new Error('Satu employee tidak boleh muncul dua kali pada satu payroll run.')
    }

    const employees = await prisma.employee.findMany({
      where: { workspaceId: c.workspace.id, id: { in: employeeIds } },
      select: { id: true, isActive: true },
    })
    if (employees.length !== employeeIds.length) throw new Error('Ada employee yang tidak ditemukan di workspace aktif.')

    const projectIds = Array.from(new Set(lines.flatMap((line) => Array.isArray(line.allocations) ? line.allocations.map((allocation) => String(allocation.projectId)) : [])))
    if (projectIds.length) {
      const projects = await prisma.project.findMany({
        where: { workspaceId: c.workspace.id, id: { in: projectIds } },
        select: { id: true },
      })
      if (projects.length !== projectIds.length) throw new Error('Ada project payroll allocation yang tidak ditemukan di workspace aktif.')
    }

    const lineData = lines.map((x) => {
      const gross = positiveMoney(x.grossAmount, 'Gross').cents
      const pph = Number(x.pph21Amount ?? 0) > 0 ? positiveMoney(x.pph21Amount, 'PPh21').cents : 0n
      const bpjs = Number(x.bpjsAmount ?? 0) > 0 ? positiveMoney(x.bpjsAmount, 'BPJS').cents : 0n
      const other = Number(x.otherDeduction ?? 0) > 0 ? positiveMoney(x.otherDeduction, 'Potongan lain').cents : 0n
      const net = gross - pph - bpjs - other
      if (net < 0n) throw new Error('Net payroll tidak boleh negatif.')

      const allocationsInput = Array.isArray(x.allocations) ? x.allocations : []
      const allocationRows = allocationsInput.map((allocation) => ({
        projectId: String(allocation.projectId),
        percentage: Number(allocation.percentage),
      }))
      if (allocationRows.length) {
        const totalBasisPoints = allocationRows.reduce((sum, allocation) => sum + parseAllocationPercentage(allocation.percentage), 0)
        if (totalBasisPoints !== 10000) throw new Error('Total payroll allocation per employee harus 100%.')
        if (new Set(allocationRows.map((allocation) => allocation.projectId)).size !== allocationRows.length) {
          throw new Error('Project payroll allocation tidak boleh duplikat.')
        }
      }

      return {
        employeeId: String(x.employeeId),
        grossAmount: gross,
        taxableAmount: x.taxableAmount !== undefined ? positiveMoney(x.taxableAmount, 'Taxable').cents : gross,
        pph21Amount: pph,
        bpjsAmount: bpjs,
        otherDeduction: other,
        netAmount: net,
        allocations: allocationRows,
      }
    })

    const gross = lineData.reduce((sum, x) => sum + x.grossAmount, 0n)
    const deductions = lineData.reduce((sum, x) => sum + x.pph21Amount + x.bpjsAmount + x.otherDeduction, 0n)
    const net = lineData.reduce((sum, x) => sum + x.netAmount, 0n)

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({
        data: {
          workspaceId: c.workspace.id,
          runNumber: requireText(b.runNumber, 'Nomor payroll', 80),
          period,
          status: 'DRAFT',
          payDate,
          grossAmount: gross.toString(),
          deductionAmount: deductions.toString(),
          netAmount: net.toString(),
          lines: {
            create: lineData.map((x) => ({
              employeeId: x.employeeId,
              grossAmount: x.grossAmount.toString(),
              taxableAmount: x.taxableAmount.toString(),
              pph21Amount: x.pph21Amount.toString(),
              bpjsAmount: x.bpjsAmount.toString(),
              otherDeduction: x.otherDeduction.toString(),
              netAmount: x.netAmount.toString(),
              allocations: {
                create: x.allocations.map((allocation) => ({
                  projectId: allocation.projectId,
                  percentage: allocation.percentage.toFixed(2),
                  amount: allocationAmountFromCents(x.grossAmount, allocation.percentage),
                })),
              },
            })),
          },
        },
        include: { lines: true },
      })

      await writeAuditLog({
        workspaceId: c.workspace.id,
        actorUserId: c.user.id,
        action: 'CREATE',
        entityType: 'PAYROLL_RUN',
        entityId: created.id,
        metadata: { period, gross: gross.toString(), net: net.toString(), headcount: lineData.length },
      })

      return created
    })

    return NextResponse.json({ payrollRun: row }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat payroll.' }, { status: 400 })
  }
}
