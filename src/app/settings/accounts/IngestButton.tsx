"use client"
import { useState } from 'react'

export default function IngestButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [type, setType] = useState<'success' | 'error' | null>(null)

  async function onClick() {
    setLoading(true)
    setMessage(null)
    setType(null)
    try {
      const res = await fetch('/api/ingest', { method: 'POST' })
      if (!res.ok) {
        const errText = await safeText(res)
        throw new Error(errText || `Request failed (${res.status})`)
      }
      const data = await res.json()
      const msg = `Ingestion complete: accounts=${data.accountsProcessed}, fetched=${data.messagesFetched}, parsed=${data.messagesParsed}, jobsCreated=${data.jobsCreated}, jobsUpdated=${data.jobsUpdated}, events=${data.eventsCreated}`
      setMessage(msg)
      setType('success')
    } catch (e: any) {
      setMessage(e?.message || 'Failed to ingest Gmail messages')
      setType('error')
    } finally {
      setLoading(false)
    }
  }

  async function safeText(res: Response): Promise<string | null> {
    try {
      const ct = res.headers.get('content-type')
      if (ct && ct.includes('application/json')) {
        const j = await res.json()
        return j?.error || JSON.stringify(j)
      }
      return await res.text()
    } catch {
      return null
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`rounded px-4 py-2 text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        title="Fetch and ingest recent Gmail messages"
      >
        {loading ? 'Ingesting…' : 'Ingest Recent Gmail'}
      </button>
      {message && type && (
        <span className={`text-sm ${type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{message}</span>
      )}
    </div>
  )
}