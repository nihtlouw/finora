import { redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
import ClientVendorManager from '@/components/clients/client-vendor-manager'
export const dynamic='force-dynamic'
export default async function ClientsPage(){
 const context=await getCurrentFinoraContext(); if(!context) redirect('/sign-in')
 const clients=await prisma.clientVendor.findMany({where:{workspaceId:context.workspace.id},orderBy:{name:'asc'},select:{id:true,name:true,type:true,email:true,phone:true,picName:true,address:true,npwp:true,isActive:true,createdAt:true,updatedAt:true}})
 return <FinoraShell workspaceName={context.workspace.name} role={context.user.role} title="Klien & Vendor"><ClientVendorManager initialClients={JSON.parse(JSON.stringify(clients))} workspace={{id:context.workspace.id,name:context.workspace.name}} role={context.user.role}/></FinoraShell>
}
