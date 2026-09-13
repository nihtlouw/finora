import { NextResponse } from 'next/server'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'
export const dynamic='force-dynamic'
export async function GET(){const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401});const rows=await prisma.cashflowTransaction.findMany({where:{OR:[{workspaceId:c.workspace.id},{payment:{invoice:{client:{workspaceId:c.workspace.id}}}},{expense:{vendor:{workspaceId:c.workspace.id}}}]},orderBy:{transactionDate:'desc'},take:200});return NextResponse.json({transactions:rows.map(x=>({...x,amount:Number(x.amount)}))})}
