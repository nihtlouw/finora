import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { positiveMoney, requireText } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { dateOnly } from '@/lib/validation/finance'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCurrentFinoraContext(); if (!c) return NextResponse.json({error:'Unauthenticated'},{status:401})
  const rows = await prisma.contractChangeOrder.findMany({ where:{workspaceId:c.workspace.id}, include:{project:{select:{id:true,projectCode:true,projectName:true}}, requestedBy:{select:{id:true,name:true,email:true}}, decidedBy:{select:{id:true,name:true,email:true}}}, orderBy:{createdAt:'desc'} })
  return NextResponse.json({ changeOrders: rows })
}

export async function POST(req: Request) {
  const c = await getCurrentFinoraContext(); if (!c) return NextResponse.json({error:'Unauthenticated'},{status:401})
  if (!canManageFinance(c.user.role)) return NextResponse.json({error:'Tidak memiliki akses.'},{status:403})
  try {
    const b = await req.json(); const projectId = requireText(b.projectId,'Project'); const changeNumber = requireText(b.changeNumber,'Nomor change order',80)
    const project = await prisma.project.findFirst({where:{id:projectId,workspaceId:c.workspace.id},include:{invoices:{select:{status:true,totalAmount:true}}}})
    if(!project) return NextResponse.json({error:'Project tidak ditemukan.'},{status:404})
    const requestedAmount = positiveMoney(b.requestedAmount,'Nilai perubahan').decimal
    const changeType = String(b.changeType ?? 'INCREASE').trim().toUpperCase()
    if (!['INCREASE', 'DECREASE'].includes(changeType)) throw new Error('Jenis perubahan harus INCREASE atau DECREASE.')
    const effectiveDate = dateOnly(b.effectiveDate ?? new Date().toISOString().slice(0,10), 'Tanggal berlaku')
    await assertAccountingPeriodOpen(c.workspace.id, effectiveDate)
    const row = await prisma.contractChangeOrder.create({data:{workspaceId:c.workspace.id,projectId,changeNumber,status:'DRAFT',requestedAmount,effectiveDate,approvedAmount:'0',reason:requireText(b.reason,'Alasan perubahan',2000),notes:b.notes?String(b.notes).trim():null,requestedByUserId:c.user.id},include:{project:true}})
    await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'CREATE',entityType:'CHANGE_ORDER',entityId:row.id,metadata:{changeNumber,changeType,requestedAmount:row.requestedAmount.toString()}})
    return NextResponse.json({changeOrder:row},{status:201})
  } catch(e){ return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat change order.'},{status:400}) }
}
