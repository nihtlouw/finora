'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Card } from '@/components/finora-ui'

type Milestone = {
  id: string
  sequence: number
  code: string
  name: string
  status: string
  progressPct: number
  plannedDate?: string | null
  actualDate?: string | null
}

type Props = { projectId: string; role: string }

const tones = (status: string) => {
  if (status === 'COMPLETED') return 'green'
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'red'
  if (status === 'IN_PROGRESS') return 'blue'
  return 'amber'
}

const label = (status: string) => {
  if (status === 'IN_PROGRESS') return 'Berjalan'
  if (status === 'COMPLETED') return 'Selesai'
  if (status === 'BLOCKED') return 'Tertahan'
  if (status === 'CANCELLED') return 'Dibatalkan'
  return 'Belum mulai'
}

export default function ProjectExecutionControl({ projectId, role }: Props) {
  const [rows, setRows] = useState<Milestone[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const can = ['OWNER', 'FINANCE'].includes(role)

  async function load() {
    const r = await fetch(`/api/projects/${projectId}/execution-milestones`)
    const d = await r.json()
    setRows(d.executionMilestones || [])
  }

  useEffect(() => {
    void load()
  }, [projectId])

  async function changeStatus(id: string, status: string) {
    setBusyId(id)
    setError('')
    try {
      const r = await fetch(`/api/projects/${projectId}/execution-milestones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Gagal memperbarui milestone.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memperbarui milestone.')
    } finally {
      setBusyId(null)
    }
  }

  const completed = rows.filter((x) => x.status === 'COMPLETED').length
  const overall = rows.length ? rows.reduce((sum, x) => sum + Number(x.progressPct), 0) / rows.length : 0
  const activeIndex = useMemo(() => {
    const index = rows.findIndex((x) => x.status === 'IN_PROGRESS')
    return index >= 0 ? index : rows.findIndex((x) => x.status === 'PLANNED')
  }, [rows])

  return (
    <Card id="execution-project" className="project-execution-card">
      <div className="f-card-head project-execution-head">
        <div className="project-execution-head-copy">
          <div className="f-eyebrow">EXECUTION CONTROL</div>
          <h3>Lifecycle Pelaksanaan</h3>
          <p>Setiap milestone menunjukkan posisi pekerjaan dan dapat menjadi syarat billing. Update berdasarkan kondisi lapangan yang benar-benar terjadi.</p>
        </div>
        <div className="project-execution-head-side">
          <Badge tone={completed === rows.length && rows.length ? 'green' : 'neutral'}>{completed}/{rows.length} selesai</Badge>
          <strong>{overall.toFixed(0)}%</strong>
          <span>progress rata-rata</span>
        </div>
      </div>

      {error && <div className="f-inline-alert error project-execution-alert">{error}</div>}

      <div className="project-execution-progress">
        <div className="project-execution-progress-line"><span style={{ width: `${Math.max(0, Math.min(100, (completed / Math.max(rows.length, 1)) * 100))}%` }} /></div>
        <div className="project-execution-progress-copy"><span>Urutan pekerjaan</span><strong>{activeIndex >= 0 ? `Fokus sekarang: ${rows[activeIndex]?.name}` : 'Semua milestone belum dimulai'}</strong></div>
      </div>

      <div className="project-execution-timeline">
        {rows.map((row, index) => (
          <div className={`project-execution-row ${row.status === 'COMPLETED' ? 'is-completed' : ''} ${row.status === 'IN_PROGRESS' ? 'is-active' : ''}`} key={row.id}>
            <div className="project-execution-marker"><span>{row.status === 'COMPLETED' ? '✓' : row.sequence}</span></div>
            <div className="project-execution-main">
              <div className="project-execution-title-row">
                <div>
                  <span className="project-execution-kicker">{row.code}</span>
                  <strong>{row.name}</strong>
                </div>
                <Badge tone={tones(row.status)}>{label(row.status)}</Badge>
              </div>
              <div className="project-execution-meta">
                <span>Progress {Number(row.progressPct).toFixed(0)}%</span>
                {row.plannedDate && <span>Rencana {new Date(row.plannedDate).toLocaleDateString('id-ID')}</span>}
                {row.actualDate && <span>Aktual {new Date(row.actualDate).toLocaleDateString('id-ID')}</span>}
              </div>
              <div className="project-execution-mini-bar"><span style={{ width: `${Math.max(0, Math.min(100, Number(row.progressPct)))}%` }} /></div>
            </div>
            <div className="project-execution-actions">
              {can && row.status === 'PLANNED' && (
                <button className="f-btn soft" disabled={busyId === row.id} onClick={() => changeStatus(row.id, 'IN_PROGRESS')}>{busyId === row.id ? 'Memproses…' : 'Mulai'}</button>
              )}
              {can && row.status === 'IN_PROGRESS' && (
                <button className="f-btn primary" disabled={busyId === row.id} onClick={() => changeStatus(row.id, 'COMPLETED')}>{busyId === row.id ? 'Memproses…' : 'Tandai selesai'}</button>
              )}
              {can && row.status === 'BLOCKED' && (
                <button className="f-btn soft" disabled={busyId === row.id} onClick={() => changeStatus(row.id, 'IN_PROGRESS')}>{busyId === row.id ? 'Memproses…' : 'Lanjutkan'}</button>
              )}
              {!can && <span className="project-execution-readonly">Read only</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
