import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext, canManageFinance } from '@/lib/auth/current-user'
import { writeAuditLog } from '@/lib/audit'
import { createProjectExecutionFoundation, snapshotProposalBOQ } from '@/lib/project-execution'
export const dynamic='force-dynamic'

export async function GET(req:Request){
 const c=await getCurrentFinoraContext()
 if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(!canManageFinance(c.user.role))return NextResponse.json({error:'Tidak memiliki akses.'},{status:403})
 const {searchParams}=new URL(req.url)
 const q=String(searchParams.get('q')||'').trim()
 const status=String(searchParams.get('status')||'').trim()
 const clientId=String(searchParams.get('clientId')||'').trim()
 const poNumber=String(searchParams.get('poNumber')||'').trim()
 const proposalNumber=String(searchParams.get('proposalNumber')||'').trim()
 const startFrom=String(searchParams.get('startFrom')||'').trim()
 const startTo=String(searchParams.get('startTo')||'').trim()
 const where:any={workspaceId:c.workspace.id}
 const and:any[]=[]
 if(status)and.push({status})
 if(clientId)and.push({clientId})
 if(startFrom)and.push({startDate:{gte:new Date(startFrom+'T00:00:00.000Z')}})
 if(startTo)and.push({startDate:{lte:new Date(startTo+'T23:59:59.999Z')}})
 if(poNumber)and.push({customerPO:{is:{poNumber:{contains:poNumber,mode:'insensitive'}}}})
 if(proposalNumber)and.push({proposal:{is:{proposalNumber:{contains:proposalNumber,mode:'insensitive'}}}})
 if(q)and.push({OR:[
   {projectCode:{contains:q,mode:'insensitive'}},
   {projectName:{contains:q,mode:'insensitive'}},
   {location:{contains:q,mode:'insensitive'}},
   {client:{name:{contains:q,mode:'insensitive'}}},
   {customerPO:{is:{poNumber:{contains:q,mode:'insensitive'}}}},
   {proposal:{is:{proposalNumber:{contains:q,mode:'insensitive'}}}},
   {proposal:{is:{quotationReference:{contains:q,mode:'insensitive'}}}},
 ]})
 if(and.length)where.AND=and
 const projects=await prisma.project.findMany({
   where,
   include:{
     client:true,
     proposal:{select:{id:true,proposalNumber:true,status:true}},
     customerPO:{select:{id:true,poNumber:true,status:true,grandTotal:true}},
     executionMilestones:{
       select:{sequence:true,code:true,name:true,status:true,progressPct:true,plannedDate:true,actualDate:true},
       orderBy:{sequence:'asc'}
     }
   },
   orderBy:{createdAt:'desc'}
 })
 return NextResponse.json({projects,filters:{q,status,clientId,poNumber,proposalNumber,startFrom,startTo}})
}

export async function POST(req:Request){
 const c=await getCurrentFinoraContext()
 if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401})
 if(!canManageFinance(c.user.role))return NextResponse.json({error:'Hanya Owner/Finance yang dapat membuat project.'},{status:403})
 try{
   const b=await req.json()
   const poId=String(b.customerPoId||'').trim()
   if(!poId)return NextResponse.json({error:'Customer PO wajib dipilih.'},{status:400})
   const po=await prisma.customerPO.findFirst({where:{id:poId,workspaceId:c.workspace.id},include:{quotation:true,project:true}})
   if(!po)return NextResponse.json({error:'PO customer tidak ditemukan.'},{status:404})
   if(po.status!=='VERIFIED')return NextResponse.json({error:'PO harus VERIFIED sebelum project dibuat.'},{status:409})
   if(!po.quotationId||!po.quotation||po.quotation.status!=='WON')return NextResponse.json({error:'PO yang membentuk project harus memiliki proposal WON.'},{status:409})
   const quotationId=po.quotationId
   if(po.project)return NextResponse.json({error:'PO ini sudah memiliki project.'},{status:409})
   if(Number(po.commercialVarianceAmount)!==0&&!po.commercialVarianceReason)return NextResponse.json({error:'PO memiliki commercial variance tanpa alasan yang terdokumentasi. Batalkan PO ini dan buat PO baru yang sudah memiliki alasan perubahan nilai.'},{status:409})
   const projectCode=String(b.projectCode||'').trim()
   const projectName=String(b.projectName||po.quotation?.projectName||'').trim()
   if(!projectCode||!projectName)return NextResponse.json({error:'Kode dan nama project wajib diisi.'},{status:400})
   const duplicate=await prisma.project.findFirst({where:{workspaceId:c.workspace.id,projectCode}})
   if(duplicate)return NextResponse.json({error:'Kode project sudah digunakan.'},{status:409})
   const project=await prisma.$transaction(async tx=>{
     const created=await tx.project.create({data:{workspaceId:c.workspace.id,clientId:po.clientId,proposalId:po.quotationId,customerPoId:po.id,projectCode,projectName,location:String(b.location||po.quotation?.projectLocation||'').trim()||null,startDate:b.startDate?new Date(b.startDate+'T00:00:00.000Z'):null,targetEndDate:b.targetEndDate?new Date(b.targetEndDate+'T00:00:00.000Z'):null,contractValue:po.grandTotal,revenueBasisValue:po.grandTotal.sub(po.taxAmount),status:'PLANNED',notes:b.notes?String(b.notes).trim():null},include:{client:true,proposal:true,customerPO:true}})
     await snapshotProposalBOQ(tx,created.id,quotationId)
     await createProjectExecutionFoundation(tx,created.id)
     await tx.projectContractVersion.create({data:{projectId:created.id,versionNumber:1,sourceType:'CUSTOMER_PO',sourceId:po.id,effectiveDate:created.startDate??po.poDate,contractValue:created.contractValue,notes:'Initial contract snapshot saat project dibuat.'}})
     return created
   })
   await writeAuditLog({workspaceId:c.workspace.id,actorUserId:c.user.id,action:'CREATE',entityType:'PROJECT',entityId:project.id,metadata:{customerPoId:po.id,projectCode}})
   return NextResponse.json({project},{status:201})
 }catch(e){
   return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat project.'},{status:400})
 }
}
