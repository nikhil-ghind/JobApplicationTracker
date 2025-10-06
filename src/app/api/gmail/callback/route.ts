import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!resp.ok) {
    const text = await resp.text()
    // Log the raw error response in development to aid debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[gmail] Token exchange failed response:', text)
    }
    throw new Error(`Token exchange failed: ${text}`)
  }
  return (await resp.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
    token_type: string
    id_token?: string
  }
}

async function fetchProfile(accessToken: string) {
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) {
    const text = await resp.text()
    if (process.env.NODE_ENV === 'development') {
      console.error('[gmail] Failed to fetch Gmail profile response:', text)
    }
    throw new Error(`Failed to fetch Gmail profile: ${text}`)
  }
  const data = (await resp.json()) as { emailAddress: string }
  return { sub: data.emailAddress, email: data.emailAddress }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const cookieStore = cookies()
  const cookieState = (await cookieStore).get('gmail_oauth_state')?.value

  if (!session) {
    return NextResponse.redirect(new URL('/signin', baseUrl))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/settings/accounts?error=Missing%20code', baseUrl))
  }
  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return NextResponse.redirect(new URL('/settings/accounts?error=Invalid%20state', baseUrl))
  }

  const redirectUri = `${baseUrl}/api/gmail/callback`
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    const { access_token, refresh_token, expires_in } = tokens

    const { sub, email } = await fetchProfile(access_token)
    if (!email) {
      return NextResponse.redirect(new URL('/settings/accounts?error=No%20email%20from%20Gmail%20profile', baseUrl))
    }

    const token_expires_at = new Date(Date.now() + expires_in * 1000)

    // Support multiple accounts per user; update if the same provider_sub exists
    const existing = await prisma.emailAccount.findFirst({
      where: { user_id: (session.user as any).id, provider: 'gmail', provider_sub: sub },
    })

    if (existing) {
      await prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          email_address: email,
          access_token: access_token,
          refresh_token: refresh_token ?? existing.refresh_token,
          token_expires_at,
        },
      })
    } else {
      await prisma.emailAccount.create({
        data: {
          user_id: (session.user as any).id,
          provider: 'gmail',
          email_address: email,
          provider_sub: sub,
          access_token: access_token,
          refresh_token: refresh_token ?? '',
          token_expires_at,
          metadata: {},
        },
      })
    }

    const res = NextResponse.redirect(new URL('/settings/accounts?success=1', baseUrl))
    res.cookies.delete('gmail_oauth_state')
    return res
  } catch (e: any) {
    // Log detailed error in development to help diagnose issues like redirect_uri_mismatch or invalid_client
    if (process.env.NODE_ENV === 'development') {
      console.error('[gmail] OAuth callback error:', e?.message ?? e)
    }
    return NextResponse.redirect(new URL('/settings/accounts?error=Gmail%20connect%20failed', baseUrl))
  }
}