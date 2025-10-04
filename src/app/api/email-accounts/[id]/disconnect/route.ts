import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (!session) {
    return NextResponse.redirect(new URL('/signin', baseUrl))
  }

  const id = params.id
  if (!id) {
    return NextResponse.json({ error: 'Missing account id' }, { status: 400 })
  }

  const account = await prisma.emailAccount.findUnique({ where: { id } })
  if (!account || account.user_id !== (session.user as any).id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.emailAccount.delete({ where: { id } })

  return NextResponse.redirect(new URL('/settings/accounts?success=Disconnected', baseUrl))
}