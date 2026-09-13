import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
export const dynamic='force-dynamic'
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const c=await getCurrentFinoraContext(); if(!c) return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(!['OWNER','FINANCE','SALES'].includes(c.user.role)) return NextResponse.json({error:'Tidak memiliki akses.'},{status:403})
 const {id}=await params; const b=await req.json()
 const existing=await prisma.proposal.findFirst({where:{id,client:{workspaceId:c.workspace.id}},include:{items:true,invoice:true}})
 if(!existing) return NextResponse.json({error:'Proposal tidak ditemukan.'},{status:404})
 if(b.action==='CONVERT'){
  if(existing.invoice) return NextResponse.json({error:'Proposal sudah dikonversi.'},{status:409})
  const inv=await prisma.invoice.create({data:{clientId:existing.clientId,proposalId:existing.id,invoiceNumber:`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,status:'UNPAID',dueDate:new Date(b.dueDate || existing.validUntil),totalAmount:existing.totalAmount,items:{create:existing.items.map(x=>({description:x.description,qty:x.qty,unitPrice:x.unitPrice}))}},include:{client:true,items:true}})
  const proposal=await prisma.proposal.update({where:{id},data:{status:'ACCEPTED'},include:{client:true,items:true,invoice:true}})
  return NextResponse.json({proposal,invoice:inv})
 }
 const status=b.status
 const proposal=await prisma.proposal.update({where:{id},data:{status},include:{client:true,items:true,invoice:true}})
 return NextResponse.json({proposal})
}
