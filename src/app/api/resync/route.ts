import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const url = new URL(req.url)
  const accountId = url.searchParams.get('id') || undefined
  if (!accountId) {
    return NextResponse.json({ error: 'Missing account id' }, { status: 400 })
  }

  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    select: { id: true, user_id: true, metadata: true },
  })
  if (!account || account.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Record a resync request timestamp in metadata; ingestion/resync workers can act upon this.
  const newMetadata = { ...(account.metadata as any ?? {}), resyncRequestedAt: new Date().toISOString() }
  await prisma.emailAccount.update({ where: { id: account.id }, data: { metadata: newMetadata } })

  return NextResponse.json({ ok: true, accountId })
}