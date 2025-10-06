"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Job = {
  id: string
  company: string
  role: string
  status: string
  last_update_at: string | null
  applied_at: string | null
  source: string | null
}

const STATUS_OPTIONS = [
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
]

function formatDate(input?: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleString()
  } catch {
    return '—'
  }
}

export default function JobsTable() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [since, setSince] = useState<string>('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (status) params.set('status', status)
    if (since) {
      // Convert YYYY-MM-DD to ISO string at start of day
      const d = new Date(since)
      if (!isNaN(d.getTime())) params.set('since', d.toISOString())
    }
    params.set('limit', '200')
    return params.toString()
  }, [q, status, since])

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs?${queryString}`, { signal: controller.signal })
        if (!res.ok) {
          const msg = await res.text()
          throw new Error(msg || `Request failed: ${res.status}`)
        }
        const data = await res.json()
        if (alive) setJobs((data.jobs ?? []) as Job[])
      } catch (e: any) {
        if (alive && e.name !== 'AbortError') setError(e.message || 'Failed to load jobs')
      } finally {
        if (alive) setLoading(false)
      }
    }, 300) // debounce 300ms

    return () => {
      alive = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [queryString])

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-64">
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            className="w-full rounded border p-2"
            placeholder="Company or role"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            className="rounded border p-2 min-w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Since</label>
          <input
            type="date"
            className="rounded border p-2"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </div>
        <div className="ms-auto text-sm">
          {loading ? (
            <span className="text-gray-500">Loading…</span>
          ) : error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            <span className="text-gray-500">{jobs.length} results</span>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left border-b">Company</th>
              <th className="p-3 text-left border-b">Role</th>
              <th className="p-3 text-left border-b">Status</th>
              <th className="p-3 text-left border-b">Last update</th>
              <th className="p-3 text-left border-b">Applied at</th>
              <th className="p-3 text-left border-b">Source</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-gray-50">
                <td className="p-3 border-b">
                  <Link href={`/job?id=${j.id}`} className="text-blue-600 hover:underline">
                    {j.company}
                  </Link>
                </td>
                <td className="p-3 border-b">{j.role}</td>
                <td className="p-3 border-b">{j.status}</td>
                <td className="p-3 border-b">{formatDate(j.last_update_at)}</td>
                <td className="p-3 border-b">{formatDate(j.applied_at)}</td>
                <td className="p-3 border-b">{j.source ?? '—'}</td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}