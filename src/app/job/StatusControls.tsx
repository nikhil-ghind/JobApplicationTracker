"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

export default function StatusControls({ jobId, currentStatus }: { jobId: string; currentStatus: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function setStatus(nextStatus: string) {
    if (nextStatus === currentStatus || pending) return
    setPending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/jobs?id=${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed: ${res.status}`)
      }
      setSuccess('Status updated')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to update')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => {
          const isActive = s === currentStatus
          return (
            <button
              key={s}
              disabled={pending || isActive}
              onClick={() => setStatus(s)}
              className={`px-2 py-1 rounded border text-xs ${
                isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'
              } ${pending ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isActive ? 'Current status' : `Change status to ${s}`}
            >
              {s}
            </button>
          )
        })}
      </div>
      <div className="mt-1 text-xs h-4">
        {pending && <span className="text-gray-500">Updating…</span>}
        {error && <span className="text-red-600">{error}</span>}
        {success && <span className="text-green-700">{success}</span>}
      </div>
    </div>
  )
}