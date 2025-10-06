import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import StatusMessages from './StatusMessages'
import IngestButton from './IngestButton'

function formatDate(d?: Date | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch {
    return '—'
  }
}

function isExpired(expiresAt?: Date | null) {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() <= Date.now()
}

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined

  const accounts = userId
    ? await prisma.emailAccount.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      })
    : []

  // Read any success or error messages from query (server component, so we parse via headers URL)
  // In Next.js app router, you can get it via headers but it's simpler to just render generic message when needed.

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Connected Email Accounts</h1>
        <div className="flex items-center gap-2">
          <Link href="/api/gmail/connect" className="rounded bg-black text-white px-4 py-2">
            Connect Gmail
          </Link>
          <IngestButton />
        </div>
      </div>

      {/* Status messages */}
      {/* We will show messages by looking for search params via a small client component below */}
      <StatusMessages />

      {accounts.length === 0 ? (
        <p className="text-sm text-gray-600">No email accounts connected yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 border-b">Provider</th>
                <th className="text-left p-3 border-b">Email</th>
                <th className="text-left p-3 border-b">Created</th>
                <th className="text-left p-3 border-b">Last Poll</th>
                <th className="text-left p-3 border-b">Token Expires</th>
                <th className="text-left p-3 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => {
                const metadata = acc.metadata as any | null
                const lastPoll: Date | string | undefined = metadata?.lastPoll
                const lastPollDate = typeof lastPoll === 'string' ? new Date(lastPoll) : (lastPoll as Date | undefined)
                const expired = isExpired(acc.token_expires_at)
                const needsRefresh = expired || !acc.refresh_token
                const error = metadata?.error as { type?: string; message?: string; count?: number; lastAt?: string } | null
                return (
                  <>
                    {error && (
                      <tr>
                        <td colSpan={6} className="p-3 border-b">
                          <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 text-sm flex items-center justify-between">
                            <div>
                              <strong>Account issue:</strong> {error.message || 'Authentication error detected.'}
                              {error.count ? <span className="ml-2">(repeated {error.count}x)</span> : null}
                              {error.lastAt ? <span className="ml-2">Last: {new Date(error.lastAt).toLocaleString()}</span> : null}
                            </div>
                            <Link href="/api/gmail/connect" className="rounded bg-red-600 text-white px-3 py-1 text-xs">Reconnect Gmail</Link>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr key={acc.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{acc.provider}</td>
                      <td className="p-3 border-b">{acc.email_address}</td>
                      <td className="p-3 border-b">{formatDate(acc.created_at)}</td>
                      <td className="p-3 border-b">{formatDate(lastPollDate)}</td>
                      <td className="p-3 border-b">
                        <div className="flex items-center gap-2">
                          <span>{formatDate(acc.token_expires_at)}</span>
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                              expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}
                            title={expired ? 'Token expired or missing' : 'Token valid'}
                          >
                            {expired ? 'Expired' : 'Valid'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                              needsRefresh ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}
                            title={needsRefresh ? 'Refresh needed (expired or missing refresh token)' : 'No refresh needed'}
                          >
                            {needsRefresh ? 'Needs refresh' : 'OK'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 border-b">
                        <form method="post" action={`/api/email-accounts/disconnect?id=${acc.id}`}>
                          <button
                            type="submit"
                            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                            title="Disconnect this account"
                          >
                            Disconnect
                          </button>
                        </form>
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Client component to read query params and display success/error messages gracefully