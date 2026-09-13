import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
export const dynamic='force-dynamic'
export async function GET(){const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401});const rows=await prisma.budget.findMany({where:{workspaceId:c.workspace.id},orderBy:{category:'asc'}});return NextResponse.json({budgets:rows})}
export async function POST(req:Request){const c=await getCurrentFinoraContext();if(!c)return NextResponse.json({error:'Unauthenticated'},{status:401});if(!['OWNER','FINANCE'].includes(c.user.role))return NextResponse.json({error:'Hanya Owner/Finance.'},{status:403});const b=await req.json();const plannedAmount=Number(b.plannedAmount);if(!b.category||!b.period||!plannedAmount)return NextResponse.json({error:'Kategori, periode dan nominal wajib diisi.'},{status:400});const row=await prisma.budget.create({data:{workspaceId:c.workspace.id,category:b.category,period:b.period,plannedAmount}});return NextResponse.json({budget:row},{status:201})}
