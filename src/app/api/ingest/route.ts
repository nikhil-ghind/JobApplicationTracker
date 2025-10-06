import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getGmailClientForAccount, ensureFreshAccessToken } from '@/lib/gmail'
import { parseGmailMessage, makeDedupeKey } from '@/lib/messageParser'

function buildSearchQuery(): string {
  const keywords = ['application', 'interview', 'assessment', 'offer', 'regret', 'rejection']
  const domains = [
    'greenhouse.io',
    'notifications.greenhouse.io',
    'lever.co',
    'jobs.lever.co',
    'workday.com',
    'myworkdayjobs.com',
    'taleo.net',
    'oraclecloud.com',
    'ashbyhq.com',
    'smartrecruiters.com',
    'icims.com',
    'jobvite.com',
    'workable.com',
    'workablemail.com',
    'breezy.hr',
    'bamboohr.com',
    'successfactors.com',
  ]
  const kwExpr = `(${keywords.join(' OR ')})`
  const fromExpr = `(${domains.map((d) => `from:${d}`).join(' OR ')})`
  return `newer_than:30d ${kwExpr} AND ${fromExpr}`
}

function headerValue(headers: any[], name: string): string | undefined {
  if (!headers) return undefined
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return h?.value
}

function extractTextFromMessage(msg: any): string | undefined {
  // Try to find text/plain part
  const payload = msg.payload
  const traverse = (p: any): string | undefined => {
    if (!p) return undefined
    if (p.mimeType === 'text/plain' && p.body?.data) {
      try {
        const data = p.body.data.replace(/-/g, '+').replace(/_/g, '/')
        const buff = Buffer.from(data, 'base64')
        return buff.toString('utf-8')
      } catch {}
    }
    if (Array.isArray(p.parts)) {
      for (const part of p.parts) {
        const t = traverse(part)
        if (t) return t
      }
    }
    return undefined
  }
  return traverse(payload)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const accounts = await prisma.emailAccount.findMany({ where: { user_id: userId, provider: 'gmail' } })

  const q = buildSearchQuery()
  const stats = {
    accountsProcessed: 0,
    messagesFetched: 0,
    messagesParsed: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    eventsCreated: 0,
  }

  for (const account of accounts) {
    stats.accountsProcessed++
    const { gmail, oauth2 } = await getGmailClientForAccount({
      id: account.id,
      provider: account.provider,
      access_token: account.access_token ?? undefined,
      refresh_token: account.refresh_token,
      token_expires_at: account.token_expires_at ?? undefined,
    })

    let pageToken: string | undefined = undefined
    const allMessageRefs: { id: string; threadId: string }[] = []

    const MAX_PER_RUN = 50
    let attempt = 0
    do {
      try {
        const listResp = await gmail.users.messages.list({
          userId: 'me',
          q,
          maxResults: Math.min(50, MAX_PER_RUN - allMessageRefs.length),
          pageToken,
        }) as any
        const msgs = listResp.data.messages ?? []
        stats.messagesFetched += msgs.length
        allMessageRefs.push(
          ...msgs.map((m: { id: string; threadId: string }) => ({ id: m.id!, threadId: m.threadId! }))
        )
        attempt = 0 // reset on success
        if (allMessageRefs.length >= MAX_PER_RUN) {
          pageToken = undefined
          break
        }
        pageToken = listResp.data.nextPageToken ?? undefined
      } catch (err: any) {
        const status = err?.code || err?.response?.status
        // Exponential backoff for rate limiting (429)
        if (status === 429) {
          const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt))
          attempt++
          await new Promise((r) => setTimeout(r, delayMs))
          continue
        }
        // Graceful handling for 401: refresh tokens and retry
        if (status === 401) {
          try {
            await ensureFreshAccessToken(oauth2, {
              id: account.id,
              provider: account.provider,
              access_token: account.access_token ?? undefined,
              refresh_token: account.refresh_token,
              token_expires_at: account.token_expires_at ?? undefined,
            })
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('Failed to refresh access token for account', account.id, e)
            }
            // Break out if we cannot refresh
            break
          }
          // After refresh, retry
          continue
        }
        // Other errors: stop paging
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error listing messages', { status, err })
        }
        break
      }
    } while (pageToken)

    if (allMessageRefs.length === 0) {
      // Update last poll time even if no messages
      const newMetadata = { ...(account.metadata as any ?? {}), lastPollAt: new Date().toISOString() }
      await prisma.emailAccount.update({ where: { id: account.id }, data: { metadata: newMetadata } })
      continue
    }

    const ids = allMessageRefs.map((r) => r.id)
    const existing = await prisma.emailMessage.findMany({
      where: { email_account_id: account.id, provider_message_id: { in: ids } },
      select: { provider_message_id: true },
    })
    const seen = new Set(existing.map((e) => e.provider_message_id))
    const unseenRefs = allMessageRefs.filter((r) => !seen.has(r.id))

    for (const ref of unseenRefs) {
      try {
        const full = await (async () => {
          let attempt = 0
          while (true) {
            try {
              return await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' })
            } catch (err: any) {
              const status = err?.code || err?.response?.status
              if (status === 429) {
                const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt))
                attempt++
                await new Promise((r) => setTimeout(r, delayMs))
                continue
              }
              if (status === 401) {
                try {
                  await ensureFreshAccessToken(oauth2, {
                    id: account.id,
                    provider: account.provider,
                    access_token: account.access_token ?? undefined,
                    refresh_token: account.refresh_token,
                    token_expires_at: account.token_expires_at ?? undefined,
                  })
                } catch (e) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.error('Failed to refresh access token during message.get', account.id, e)
                  }
                  throw err
                }
                continue
              }
              throw err
            }
          }
        })()
        const msg = full.data
        const subject = headerValue(msg.payload?.headers ?? [], 'Subject') ?? undefined
        const snippet = msg.snippet ?? undefined
        const text = extractTextFromMessage(msg) ?? undefined
        const headersArr = msg.payload?.headers ?? []
        const headersObj: Record<string, string> = {}
        for (const h of headersArr) {
          if (h.name && h.value) headersObj[h.name] = h.value
        }
        const internalDateMs = msg.internalDate ? Number(msg.internalDate) : Date.now()
        const receivedAt = new Date(internalDateMs)

        const parsed = parseGmailMessage({ subject, snippet, text, headers: headersObj })
        stats.messagesParsed++

        const { raw, hash } = makeDedupeKey(parsed.company ?? '', parsed.role ?? '', account.id)

        const preExisting = await prisma.jobApplication.findUnique({ where: { dedupe_key_hash: hash }, select: { id: true } })

        // Upsert JobApplication by dedupe_key_hash uniqueness
        const job = await prisma.jobApplication.upsert({
          where: { dedupe_key_hash: hash },
          update: {
            company: parsed.company ?? undefined,
            role: parsed.role ?? undefined,
            source: parsed.source ?? undefined,
            status: parsed.status,
            last_update_at: parsed.eventDate ?? receivedAt,
            confidence: parsed.confidence,
          },
          create: {
            user_id: userId,
            email_account_id: account.id,
            company: parsed.company ?? 'Unknown',
            role: parsed.role ?? 'Unknown',
            source: parsed.source,
            status: parsed.status ?? 'InReview',
            applied_at: (parsed.status ?? 'InReview') === 'Applied' ? parsed.eventDate : undefined,
            last_update_at: parsed.eventDate ?? receivedAt,
            confidence: parsed.confidence,
            dedupe_key_raw: raw,
            dedupe_key_hash: hash,
          },
          select: { id: true },
        })

        // Count create vs update based on preExisting
        if (preExisting) stats.jobsUpdated++
        else stats.jobsCreated++

        await prisma.applicationEvent.create({
          data: {
            job_application_id: job.id,
            event_type: parsed.eventType ?? 'Email',
            occurred_at: parsed.eventDate ?? receivedAt,
            payload: {
              gmail_message_id: ref.id,
              gmail_thread_id: ref.threadId,
              subject,
            },
          },
        })
        stats.eventsCreated++

        // Record EmailMessage (idempotent)
        await prisma.emailMessage.upsert({
          where: {
            email_account_id_provider_message_id: {
              email_account_id: account.id,
              provider_message_id: ref.id,
            },
          },
          update: {
            thread_id: ref.threadId,
            subject,
            received_at: receivedAt,
            snippet: snippet ?? null,
            headers: headersObj,
            parsed: true,
          },
          create: {
            email_account_id: account.id,
            provider_message_id: ref.id,
            thread_id: ref.threadId,
            subject,
            received_at: receivedAt,
            snippet: snippet ?? null,
            headers: headersObj,
            parsed: true,
          },
        })
      } catch (e: any) {
        // Log in development to help diagnose ingestion issues
        if (process.env.NODE_ENV === 'development') {
          console.error('[ingest] failed for message', ref.id, e?.message ?? e)
        }
      }
    }

    // Update lastPollAt metadata
    const newMetadata = { ...(account.metadata as any ?? {}), lastPollAt: new Date().toISOString() }
    await prisma.emailAccount.update({ where: { id: account.id }, data: { metadata: newMetadata } })
  }

  return NextResponse.json({ ok: true, ...stats })
}