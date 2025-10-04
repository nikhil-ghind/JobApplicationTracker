"use client"
import { useEffect, useState } from 'react'

export default function StatusMessages() {
  const [message, setMessage] = useState<string | null>(null)
  const [type, setType] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('success')) {
      const successText = sp.get('success') === 'Disconnected' ? 'Account disconnected.' : 'Gmail account connected successfully.'
      setMessage(successText)
      setType('success')
    } else if (sp.get('error')) {
      const err = sp.get('error') || 'An error occurred while connecting Gmail.'
      setMessage(err)
      setType('error')
    }
  }, [])

  if (!message || !type) return null

  return (
    <div
      className={`rounded border p-3 text-sm ${
        type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}
      role="alert"
    >
      {message}
    </div>
  )
}