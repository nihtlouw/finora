import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { dateOnly, positiveMoney, requireText, centsToDecimal } from '@/lib/validation/finance'
import { writeAuditLog } from '@/lib/audit'
import { assertAccountingPeriodOpen } from '@/lib/finance-period'
export const dynamic='force-dynamic'

export async function GET(){
  const c=await getCurrentFinoraContext(); if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
  const rows=await prisma.vendorBill.findMany({where:{workspaceId:c.workspace.id},include:{vendor:{select:{id:true,name:true}},project:{select:{id:true,projectCode:true,projectName:true}},payments:true},orderBy:{dueDate:'asc'}})
  return NextResponse.json({vendorBills:rows})
}

export async function POST(req:Request){
  const c=await getCurrentFinoraContext(); if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
  if(!canManageFinance(c.user.role))return NextResponse.json({error:'Tidak memiliki akses.'},{status:403})
  try{
    const b=await req.json();
    const vendorId=requireText(b.vendorId,'Vendor')
    const vendor=await prisma.clientVendor.findFirst({where:{id:vendorId,workspaceId:c.workspace.id,type:'VENDOR',isActive:true}})
    if(!vendor)return NextResponse.json({error:'Vendor tidak ditemukan atau tidak aktif.'},{status:404})
    const billNumber=requireText(b.billNumber,'Nomor vendor bill',100)
    const supplierInvoiceNo=b.supplierInvoiceNo?String(b.supplierInvoiceNo).trim():null
    if(supplierInvoiceNo){const dup=await prisma.vendorBill.findFirst({where:{workspaceId:c.workspace.id,vendorId,supplierInvoiceNo}});if(dup)return NextResponse.json({error:'Nomor invoice vendor sudah pernah dicatat untuk vendor ini.'},{status:409})}
    const billDate=dateOnly(b.billDate,'Tanggal tagihan'); const dueDate=dateOnly(b.dueDate,'Jatuh tempo'); await assertAccountingPeriodOpen(c.workspace.id,billDate)
    const subtotal=positiveMoney(b.subtotalAmount,'Subtotal').cents
    const tax=Number(b.taxAmount??0)>0?positiveMoney(b.taxAmount,'Pajak').cents:0n
    const total=positiveMoney(b.totalAmount??centsToDecimal(subtotal+tax),'Total').cents
    if(total!==subtotal+tax)return NextResponse.json({error:'Total tagihan harus sama dengan subtotal + pajak.'},{status:409})
    if(b.projectId){const project=await prisma.project.findFirst({where:{id:String(b.projectId),workspaceId:c.workspace.id}});if(!project)return NextResponse.json({error:'Project tidak ditemukan.'},{status:404})}
    const row=await prisma.vendorBill.create({data:{workspaceId:c.workspace.id,vendorId,projectId:b.projectId?String(b.projectId):null,expenseId:b.expenseId?String(b.expenseId):null,billNumber,supplierInvoiceNo,billDate,dueDate,status:'DRAFT',subtotalAmount:centsToDecimal(subtotal),taxAmount:centsToDecimal(tax),totalAmount:centsToDecimal(total),notes:b.notes?String(b.notes):null},include:{vendor:true,project:true}})
    await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'CREATE',entityType:'VENDOR_BILL',entityId:row.id,metadata:{total:row.totalAmount.toString()}})
    return NextResponse.json({vendorBill:row},{status:201})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat vendor bill.'},{status:400})}
}
