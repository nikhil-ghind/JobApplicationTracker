import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import prisma from '@/lib/prisma'

export type EmailAccountLike = {
  id: string
  provider: string
  access_token?: string | null
  refresh_token: string
  token_expires_at?: Date | null
}

function assertEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} environment variable`)
  return v
}

function isExpired(expiresAt?: Date | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() <= Date.now()
}

/**
 * Create an OAuth2 client for the given EmailAccount record.
 * - Sets initial credentials from DB
 * - Listens for token refresh events and persists new tokens back to DB
 */
export function createOAuthClientForAccount(account: EmailAccountLike): OAuth2Client {
  const clientId = assertEnv('GOOGLE_CLIENT_ID')
  const clientSecret = assertEnv('GOOGLE_CLIENT_SECRET')

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token || undefined,
    // google-auth-library expects milliseconds for expiry_date
    expiry_date: account.token_expires_at ? new Date(account.token_expires_at).getTime() : undefined,
  })

  // Persist refreshed tokens automatically
  oauth2.on('tokens', async (tokens: any) => {
    try {
      const data: Record<string, any> = {}
      if (tokens.access_token) data.access_token = tokens.access_token
      if (tokens.refresh_token) data.refresh_token = tokens.refresh_token
      if (typeof tokens.expiry_date === 'number') data.token_expires_at = new Date(tokens.expiry_date)
      if (Object.keys(data).length > 0) {
        await prisma.emailAccount.update({ where: { id: account.id }, data })
      }
    } catch (err) {
      // Avoid leaking tokens; log minimal context in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('[gmail] failed to persist refreshed tokens')
      }
    }
  })

  return oauth2 as unknown as OAuth2Client
}

/**
 * Ensure the account has a valid access token.
 * If expired and a refresh token exists, attempts a refresh.
 * Throws clear error messages if tokens are missing.
 */
export async function ensureFreshAccessToken(oauth2: OAuth2Client, account: EmailAccountLike): Promise<void> {
  // If we lack a refresh token and token appears expired/missing, fail early
  const expired = isExpired(account.token_expires_at)
  const hasRefresh = !!account.refresh_token && account.refresh_token.trim().length > 0

  if ((expired || !account.access_token) && !hasRefresh) {
    throw new Error('Missing refresh token for Gmail account. Please reconnect and grant offline access.')
  }

  // Proactively refresh when expired; otherwise verify access token is still valid
  if (expired) {
    try {
      // getAccessToken will refresh automatically when needed and emit new tokens
      await oauth2.getAccessToken()
    } catch (err) {
      throw new Error('Failed to refresh Gmail access token. Please reconnect your account.')
    }
  } else {
    // Optional: validate existing token by attempting to retrieve headers
    try {
      await oauth2.getAccessToken()
    } catch (err) {
      // If token retrieval fails, try refreshing once if we have refresh token
      if (hasRefresh) {
        try {
          await oauth2.getAccessToken()
        } catch (e2) {
          throw new Error('Failed to obtain Gmail access token. Please reconnect your account.')
        }
      } else {
        throw new Error('No valid Gmail access token and no refresh token available.')
      }
    }
  }
}

/**
 * Returns an authenticated Gmail client for the provided EmailAccount.
 * Automatically refreshes expired tokens and persists updates.
 */
export async function getGmailClientForAccount(account: EmailAccountLike) {
  if (account.provider !== 'gmail') {
    throw new Error('Email account provider is not Gmail.')
  }
  const oauth2 = createOAuthClientForAccount(account)
  await ensureFreshAccessToken(oauth2, account)
  const gmail = google.gmail({ version: 'v1', auth: oauth2 as any })
  return { gmail, oauth2 }
}

/**
 * Convenience: fetch account by id, then return authenticated Gmail client.
 */
export async function getGmailClientForAccountId(accountId: string) {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Email account not found')
  return getGmailClientForAccount({
    id: account.id,
    provider: account.provider,
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    token_expires_at: account.token_expires_at,
  })
}