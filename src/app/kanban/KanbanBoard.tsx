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

const STATUS_COLUMNS = [
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
] as const

export default function KanbanBoard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetch('/api/jobs?limit=200')
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then((data) => {
        if (alive) setJobs((data.jobs ?? []) as Job[])
      })
      .catch((e) => {
        if (alive) setError(e.message || 'Failed to load jobs')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const columns = useMemo(() => {
    const map: Record<string, Job[]> = {}
    for (const s of STATUS_COLUMNS) map[s] = []
    for (const j of jobs) {
      if (!map[j.status]) map[j.status] = []
      map[j.status].push(j)
    }
    // sort each column by last_update_at desc
    for (const s of STATUS_COLUMNS) {
      map[s].sort((a, b) => {
        const ta = a.last_update_at ? new Date(a.last_update_at).getTime() : 0
        const tb = b.last_update_at ? new Date(b.last_update_at).getTime() : 0
        return tb - ta
      })
    }
    return map
  }, [jobs])

  async function changeStatus(jobId: string, nextStatus: string) {
    const idx = jobs.findIndex((j) => j.id === jobId)
    if (idx === -1) return
    const prev = jobs[idx]
    if (prev.status === nextStatus) return

    setPending((p) => ({ ...p, [jobId]: true }))
    // optimistic update
    setJobs((list) => {
      const copy = [...list]
      copy[idx] = { ...copy[idx], status: nextStatus }
      return copy
    })

    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed: ${res.status}`)
      }
    } catch (e) {
      // revert on error
      setJobs((list) => {
        const copy = [...list]
        const i = copy.findIndex((j) => j.id === jobId)
        if (i !== -1) copy[i] = { ...copy[i], status: prev.status }
        return copy
      })
      console.error('Failed to update status', e)
    } finally {
      setPending((p) => ({ ...p, [jobId]: false }))
    }
  }

  function onDragStart(ev: React.DragEvent<HTMLDivElement>, jobId: string) {
    ev.dataTransfer.setData('text/plain', jobId)
    ev.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'move'
  }

  function onDrop(ev: React.DragEvent<HTMLDivElement>, targetStatus: string) {
    ev.preventDefault()
    const jobId = ev.dataTransfer.getData('text/plain')
    if (jobId) changeStatus(jobId, targetStatus)
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold">Kanban</h1>
        <span className="text-sm text-gray-500">Drag a card between columns to change status.</span>
        <div className="ms-auto text-sm">
          {loading ? <span className="text-gray-500">Loading…</span> : error ? <span className="text-red-600">{error}</span> : <span className="text-gray-500">{jobs.length} jobs</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {STATUS_COLUMNS.map((status) => (
          <div key={status} className="rounded border bg-gray-50/50">
            <div className="px-3 py-2 border-b bg-gray-100 text-sm font-medium flex items-center justify-between">
              <span>{status}</span>
              <span className="text-gray-500">{columns[status]?.length ?? 0}</span>
            </div>
            <div
              className="p-2 min-h-64 max-h-[70vh] overflow-auto"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, status)}
            >
              {(columns[status] ?? []).map((j) => (
                <div
                  key={j.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, j.id)}
                  className={`mb-2 rounded border bg-white p-3 shadow-sm ${pending[j.id] ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <Link href={`/job?id=${j.id}`} className="text-blue-600 hover:underline font-medium">
                      {j.company}
                    </Link>
                    <span className="text-xs text-gray-500">{j.role}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Last update: {j.last_update_at ? new Date(j.last_update_at).toLocaleString() : '—'}
                  </div>
                  {j.source && <div className="mt-1 text-xs text-gray-500">Source: {j.source}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}