import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'

const roles=['FINANCE','SALES','VIEWER'] as const

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(c.user.role!=='OWNER')return NextResponse.json({error:'Hanya Owner yang dapat mengubah role anggota.'},{status:403})
 const {id}=await params;const member=await prisma.workspaceMember.findFirst({where:{id,workspaceId:c.workspace.id},include:{user:true}});if(!member)return NextResponse.json({error:'Anggota tidak ditemukan.'},{status:404})
 try{
  const b=await req.json();const role=String(b.role||'').trim().toUpperCase()
  if(role==='OWNER')return transferOwnership(c.user.id,c.workspace.id,member.id,member.userId)
  if(!(roles as readonly string[]).includes(role))return NextResponse.json({error:'Role harus FINANCE, SALES, atau VIEWER.'},{status:400})
  if(member.role==='OWNER' && member.userId===c.user.id)return NextResponse.json({error:'Owner saat ini harus memakai aksi Transfer Owner untuk menyerahkan kepemilikan.'},{status:409})
  const updated=await prisma.$transaction(async tx=>{
   const next=await tx.workspaceMember.update({where:{id:member.id},data:{role}})
   await tx.user.update({where:{id:member.userId},data:{role}})
   return next
  })
  await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'CHANGE_MEMBER_ROLE',entityType:'WORKSPACE_MEMBER',entityId:id,metadata:{from:member.role,to:role,userId:member.userId}})
  return NextResponse.json({member:updated})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal mengubah role.'},{status:400})}
}

async function transferOwnership(actorUserId:string,workspaceId:string,targetMemberId:string,targetUserId:string){
 if(actorUserId===targetUserId)return NextResponse.json({error:'Anda sudah menjadi Owner.'},{status:409})
 const target=await prisma.workspaceMember.findFirst({where:{id:targetMemberId,workspaceId},include:{user:true}})
 if(!target)return NextResponse.json({error:'Target Owner tidak ditemukan.'},{status:404})
 const result=await prisma.$transaction(async tx=>{
  await tx.workspaceMember.updateMany({where:{workspaceId,role:'OWNER'},data:{role:'VIEWER'}})
  await tx.workspaceMember.update({where:{id:targetMemberId},data:{role:'OWNER'}})
  await tx.user.updateMany({where:{id:{in:[actorUserId,targetUserId]}},data:{role:'OWNER'}})
  await tx.user.update({where:{id:actorUserId},data:{role:'VIEWER'}})
  return tx.workspaceMember.findMany({where:{workspaceId},include:{user:{select:{id:true,name:true,email:true,role:true}}},orderBy:{createdAt:'asc'}})
 })
 await writeAuditLog({workspaceId,actorUserId,action:'TRANSFER_OWNERSHIP',entityType:'WORKSPACE_MEMBER',entityId:targetMemberId,metadata:{newOwnerUserId:targetUserId}})
 return NextResponse.json({members:result})
}

export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(c.user.role!=='OWNER')return NextResponse.json({error:'Hanya Owner yang dapat menghapus anggota.'},{status:403})
 const {id}=await params;const member=await prisma.workspaceMember.findFirst({where:{id,workspaceId:c.workspace.id},include:{user:true}});if(!member)return NextResponse.json({error:'Anggota tidak ditemukan.'},{status:404})
 if(member.userId===c.user.id)return NextResponse.json({error:'Owner tidak dapat menghapus dirinya sendiri. Transfer ownership terlebih dahulu.'},{status:409})
 if(member.role==='OWNER')return NextResponse.json({error:'Pindahkan ownership terlebih dahulu sebelum menghapus Owner lain.'},{status:409})
 await prisma.workspaceMember.delete({where:{id}})
 await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'REMOVE_MEMBER',entityType:'WORKSPACE_MEMBER',entityId:id,metadata:{userId:member.userId,email:member.user.email}})
 return NextResponse.json({ok:true})
}
