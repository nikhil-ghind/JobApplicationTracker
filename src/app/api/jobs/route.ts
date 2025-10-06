import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const ALLOWED_STATUSES = new Set([
  'Applied',
  'InReview',
  'Assessment',
  'PhoneScreen',
  'Interview',
  'Onsite',
  'Offer',
  'Rejected',
  'Withdrawn',
  'Ghosted',
])

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const url = new URL(req.url)
  const id = url.searchParams.get('id') || undefined
  if (id) {
    // Single job fetch
    const job = await prisma.jobApplication.findUnique({
      where: { id },
      include: {
        emailAccount: { select: { id: true, provider: true, email_address: true } },
        events: { orderBy: { occurred_at: 'desc' }, take: 50 },
      },
    })
    if (!job || job.user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ job })
  }

  const statusParam = url.searchParams.get('status') || undefined
  const q = url.searchParams.get('q') || undefined
  const sinceParam = url.searchParams.get('since') || undefined
  const limitParam = url.searchParams.get('limit') || undefined

  // Validate and normalize inputs
  let where: any = { user_id: userId }

  if (statusParam) {
    if (!ALLOWED_STATUSES.has(statusParam)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    where.status = statusParam
  }

  if (q) {
    where.OR = [
      { company: { contains: q, mode: 'insensitive' as const } },
      { role: { contains: q, mode: 'insensitive' as const } },
    ]
  }

  if (sinceParam) {
    const sinceDate = new Date(sinceParam)
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: 'Invalid since parameter' }, { status: 400 })
    }
    where.last_update_at = { gte: sinceDate }
  }

  let take = 100
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed)) {
      take = Math.max(1, Math.min(200, parsed))
    }
  }

  try {
    const jobs = await prisma.jobApplication.findMany({
      where,
      take,
      orderBy: [{ last_update_at: 'desc' }],
    })
    return NextResponse.json({ jobs })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('GET /api/jobs error', err)
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const PatchSchema = z
  .object({
    status: z
      .enum([
        'Applied',
        'InReview',
        'Assessment',
        'PhoneScreen',
        'Interview',
        'Onsite',
        'Offer',
        'Rejected',
        'Withdrawn',
        'Ghosted',
      ])
      .optional(),
    company: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
  })
  .refine((d) => d.status !== undefined || d.company !== undefined || d.role !== undefined, {
    message: 'At least one field to update is required',
    path: ['status'],
  })

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const url = new URL(req.url)
  const id = url.searchParams.get('id') || undefined
  if (!id) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const job = await prisma.jobApplication.findUnique({ where: { id }, select: { id: true, user_id: true } })
  if (!job || job.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data: any = {}
  const { status, company, role } = parsed.data
  if (status !== undefined) data.status = status
  if (company !== undefined) data.company = company
  if (role !== undefined) data.role = role

  const updated = await prisma.jobApplication.update({ where: { id }, data })
  return NextResponse.json({ job: updated })
}