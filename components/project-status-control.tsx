'use client'

import { useState } from 'react'

type Props = {
  projectId: string
  status: string
}

const NEXT: Record<string, string[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['ACTIVE', 'ON_HOLD', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}

export default function ProjectStatusControl({ projectId, status }: Props) {
  const options = NEXT[status] ?? []
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!options.length) return <span className="f-muted">Status final</span>

  async function update() {
    if (!value) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status project.')
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memperbarui status project.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="f-actions">
      <label className="f-status-next"><span>Status berikutnya</span><select className="f-input" value={value} onChange={(event) => setValue(event.target.value)} disabled={busy}>
        <option value="">Pilih status berikutnya</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select></label>
      <button className="f-btn soft" type="button" onClick={update} disabled={busy||!value}>
        {busy ? 'Menyimpan…' : 'Ubah status'}
      </button>
      {message && <span className="f-badge red">{message}</span>}
    </div>
  )
}
