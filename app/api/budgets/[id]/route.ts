import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { normalizeBudgetPeriod, positiveMoney, requireText } from '@/lib/validation/finance'

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(!['OWNER','FINANCE'].includes(c.user.role))return NextResponse.json({error:'Hanya Owner/Finance.'},{status:403})
 const {id}=await params;const existing=await prisma.budget.findFirst({where:{id,workspaceId:c.workspace.id}});if(!existing)return NextResponse.json({error:'Anggaran tidak ditemukan.'},{status:404})
 try{const b=await req.json();const category=requireText(b.category,'Kategori',120);const period=normalizeBudgetPeriod(b.period);const planned=positiveMoney(b.plannedAmount,'Nominal anggaran');const duplicate=await prisma.budget.findFirst({where:{workspaceId:c.workspace.id,category,period,id:{not:id}}});if(duplicate)return NextResponse.json({error:'Kategori dan periode tersebut sudah memiliki anggaran.'},{status:409});const row=await prisma.budget.update({where:{id},data:{category,period,plannedAmount:planned.decimal}});await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'UPDATE',entityType:'BUDGET',entityId:id,metadata:{category,period,planned:planned.decimal}});return NextResponse.json({budget:row})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal memperbarui anggaran.'},{status:400})}
}
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401});if(!['OWNER','FINANCE'].includes(c.user.role))return NextResponse.json({error:'Hanya Owner/Finance.'},{status:403});const {id}=await params;const existing=await prisma.budget.findFirst({where:{id,workspaceId:c.workspace.id}});if(!existing)return NextResponse.json({error:'Anggaran tidak ditemukan.'},{status:404});await prisma.budget.delete({where:{id}});await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'DELETE',entityType:'BUDGET',entityId:id,metadata:{category:existing.category,period:existing.period}});return NextResponse.json({ok:true})
}
