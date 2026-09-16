import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, FINORA_ROLES } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'

const assignable = ['FINANCE','SALES','VIEWER'] as const

export async function GET(){
 const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(c.user.role!=='OWNER')return NextResponse.json({error:'Hanya Owner yang dapat mengelola anggota workspace.'},{status:403})
 const members=await prisma.workspaceMember.findMany({where:{workspaceId:c.workspace.id},include:{user:{select:{id:true,name:true,email:true,clerkId:true,role:true}}},orderBy:{createdAt:'asc'}})
 return NextResponse.json({members})
}

export async function POST(req:Request){
 const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(c.user.role!=='OWNER')return NextResponse.json({error:'Hanya Owner yang dapat menambah anggota workspace.'},{status:403})
 try{
  const b=await req.json();const email=String(b.email||'').trim().toLowerCase();const role=String(b.role||'VIEWER').trim().toUpperCase()
  if(!email||!email.includes('@'))throw new Error('Email anggota tidak valid.')
  if(!(assignable as readonly string[]).includes(role))throw new Error('Role anggota harus FINANCE, SALES, atau VIEWER. Transfer Owner dilakukan lewat aksi khusus.')
  const user=await prisma.user.findUnique({where:{email}})
  if(!user)return NextResponse.json({error:'User belum terdaftar di Finora. Minta orang tersebut login sekali ke Finora, lalu tambahkan kembali.'},{status:404})
  const existing=await prisma.workspaceMember.findFirst({where:{workspaceId:c.workspace.id,userId:user.id}})
  if(existing)return NextResponse.json({error:'User tersebut sudah menjadi anggota workspace.'},{status:409})
  const otherMembership=await prisma.workspaceMember.findFirst({
   where:{userId:user.id,workspaceId:{not:c.workspace.id}},
   include:{workspace:{include:{_count:{select:{members:true,clientVendors:true,budgets:true,cashflows:true,auditLogs:true}}}}},
  })
  if(otherMembership){
   const counts=otherMembership.workspace._count
   const emptyWorkspace=counts.members===1 && counts.clientVendors===0 && counts.budgets===0 && counts.cashflows===0 && counts.auditLogs===0
   if(!emptyWorkspace)return NextResponse.json({error:'User tersebut sudah mempunyai workspace lain yang berisi data. Demi keamanan multi-workspace, kosongkan atau migrasikan workspace tersebut secara eksplisit terlebih dahulu.'},{status:409})
  }
  const member=await prisma.$transaction(async tx=>{
   if(otherMembership){ await tx.workspace.delete({where:{id:otherMembership.workspaceId}}) }
   const created=await tx.workspaceMember.create({data:{workspaceId:c.workspace.id,userId:user.id,role}})
   await tx.user.update({where:{id:user.id},data:{role}})
   return created
  })
  await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'ADD_MEMBER',entityType:'WORKSPACE_MEMBER',entityId:member.id,metadata:{email,role}})
  return NextResponse.json({member},{status:201})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menambahkan anggota.'},{status:400})}
}
