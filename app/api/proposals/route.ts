import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'

export const dynamic='force-dynamic'

export async function GET(){
 const c=await getCurrentFinoraContext(); if(!c) return NextResponse.json({error:'Unauthenticated'},{status:401})
 const rows=await prisma.proposal.findMany({where:{client:{workspaceId:c.workspace.id}},include:{client:true,items:true,invoice:true},orderBy:{createdAt:'desc'}})
 return NextResponse.json({proposals:rows})
}
export async function POST(req:Request){
 const c=await getCurrentFinoraContext(); if(!c) return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(!['OWNER','FINANCE','SALES'].includes(c.user.role)) return NextResponse.json({error:'Tidak memiliki akses.'},{status:403})
 try{
  const b=await req.json()
  const client=await prisma.clientVendor.findFirst({where:{id:b.clientId,workspaceId:c.workspace.id,type:'CLIENT'}})
  if(!client) return NextResponse.json({error:'Klien tidak ditemukan.'},{status:404})
  const items=Array.isArray(b.items)?b.items:[]; if(!items.length) return NextResponse.json({error:'Minimal satu item diperlukan.'},{status:400})
  const total=items.reduce((s:any,x:any)=>s+Number(x.qty||0)*Number(x.unitPrice||0),0)
  const proposalNumber=b.proposalNumber || `PR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
  const row=await prisma.proposal.create({data:{clientId:client.id,proposalNumber,status:b.status||'DRAFT',totalAmount:total,validUntil:new Date(`${b.validUntil}T00:00:00Z`),items:{create:items.map((x:any)=>({description:String(x.description),qty:Number(x.qty),unitPrice:Number(x.unitPrice)}))}} ,include:{client:true,items:true}})
  return NextResponse.json({proposal:row},{status:201})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat proposal.'},{status:400})}
}
