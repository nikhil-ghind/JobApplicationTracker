import Link from 'next/link'
import StatusControls from './StatusControls'

async function fetchJob(id: string) {
  const base = process.env.NEXTAUTH_URL ?? ''
  const res = await fetch(`${base}/api/jobs?id=${encodeURIComponent(id)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to load job')
  return res.json()
}

export default async function JobDetailPage({ searchParams }: { searchParams: { id?: string } }) {
  const id = searchParams?.id

  if (!id) {
    return (
      <main className="max-w-4xl mx-auto p-4">
        <Link href="/jobs" className="text-blue-600 hover:underline text-sm">← Back to jobs</Link>
        <h1 className="text-2xl font-semibold mt-2 mb-4">Job not found</h1>
        <p className="text-gray-600">Missing job id in URL. Try opening a job from the list.</p>
      </main>
    )
  }

  const data = await fetchJob(id)
  const job = data.job as any

  return (
    <main className="max-w-4xl mx-auto p-4">
      <Link href="/jobs" className="text-blue-600 hover:underline text-sm">← Back to jobs</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-4">{job.company} — {job.role}</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded border p-3">
          <div className="text-sm text-gray-500">Status</div>
          <div className="font-medium">{job.status}</div>
          <StatusControls jobId={job.id} currentStatus={job.status} />
        </div>
        <div className="rounded border p-3">
          <div className="text-sm text-gray-500">Source</div>
          <div className="font-medium">{job.source ?? '—'}</div>
          <div className="mt-2 text-sm text-gray-500">Email account</div>
          <div className="text-sm">{job.emailAccount ? `${job.emailAccount.provider} — ${job.emailAccount.email_address}` : '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-sm text-gray-500">Applied at</div>
          <div className="font-medium">{job.applied_at ? new Date(job.applied_at).toLocaleString() : '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-sm text-gray-500">Last update</div>
          <div className="font-medium">{job.last_update_at ? new Date(job.last_update_at).toLocaleString() : '—'}</div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-2">Recent events</h2>
        <div className="rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left border-b">Type</th>
                <th className="p-3 text-left border-b">Occurred</th>
                <th className="p-3 text-left border-b">Details</th>
                <th className="p-3 text-left border-b">Original thread</th>
              </tr>
            </thead>
            <tbody>
              {job.events?.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="p-3 border-b">{e.event_type}</td>
                  <td className="p-3 border-b">{new Date(e.occurred_at).toLocaleString()}</td>
                  <td className="p-3 border-b"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(e.payload ?? {}, null, 2)}</pre></td>
                  <td className="p-3 border-b">
                    {e.payload?.gmail_thread_id ? (
                      <a
                        className="text-blue-600 hover:underline text-xs"
                        href={`https://mail.google.com/mail/u/0/#inbox/${e.payload.gmail_thread_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Gmail
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!job.events || job.events.length === 0) && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-gray-500">No events</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}