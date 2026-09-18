'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, money } from '@/components/finora-ui'

type BOQItem = {
  id: string
  description: string
  brand?: string | null
  itemType?: string | null
  unit: string
  plannedQty: number
  unitPrice: number
  actualQty: number
  actualAmount: number
  progressPct: number
  sectionCode: string
}

type Props = { projectId: string; role: string }

const canEdit = (role: string) => ['OWNER', 'FINANCE'].includes(role)

export default function ProjectBOQControl({ projectId, role }: Props) {
  const [data, setData] = useState<any>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [edits, setEdits] = useState<Record<string, Partial<Pick<BOQItem, 'actualQty' | 'actualAmount' | 'progressPct'>>>>({})
  const editable = canEdit(role)

  async function load() {
    const r = await fetch(`/api/projects/${projectId}/boq`)
    const d = await r.json()
    setData(d)
  }

  useEffect(() => {
    void load()
  }, [projectId])

  function editedItem(item: BOQItem): BOQItem {
    const edit = edits[item.id] || {}
    return { ...item, ...edit }
  }

  async function update(item: BOQItem) {
    setBusyItemId(item.id)
    setError('')
    try {
      const r = await fetch(`/api/projects/${projectId}/boq`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          actualQty: item.actualQty,
          actualAmount: item.actualAmount,
          progressPct: item.progressPct,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan actual BOQ.')
      setEdits((current) => { const next = { ...current }; delete next[item.id]; return next })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan actual BOQ.')
    } finally {
      setBusyItemId(null)
    }
  }

  const items: BOQItem[] = useMemo(
    () =>
      data?.sections?.flatMap((section: any) =>
        (section.items || []).map((item: any) => ({
          ...item,
          sectionCode: section.code,
          plannedQty: Number(item.plannedQty),
          unitPrice: Number(item.unitPrice),
          actualQty: Number(item.actualQty),
          actualAmount: Number(item.actualAmount),
          progressPct: Number(item.progressPct),
        })),
      ) || [],
    [data],
  )

  const completedItems = items.filter((item) => item.progressPct >= 100).length
  const avgProgress = items.length ? items.reduce((sum, item) => sum + item.progressPct, 0) / items.length : 0

  if (!data) return null

  return (
    <Card id="boq-project" className="project-boq-card">
      <div className="f-card-head project-boq-head">
        <div className="project-boq-head-copy">
          <div className="f-eyebrow">EXECUTION BOQ SNAPSHOT</div>
          <h3>BOQ Project</h3>
          <p>Snapshot budget project yang berdiri sendiri dari quotation. Update actual qty, actual amount, dan progress dari pelaksanaan nyata.</p>
        </div>
        <div className="project-boq-head-side">
          <Badge tone="neutral">{items.length} item</Badge>
          <span>{data.sections?.length || 0} section</span>
        </div>
      </div>

      {error && <div className="f-inline-alert error project-boq-alert">{error}</div>}

      <div className="project-boq-summary">
        <div className="project-boq-stat">
          <span>Budget planned</span>
          <strong>{money(Number(data.totals.planned))}</strong>
          <small>Nilai snapshot contract</small>
        </div>
        <div className="project-boq-stat">
          <span>Actual amount</span>
          <strong>{money(Number(data.totals.actual))}</strong>
          <small>Aktual yang tercatat</small>
        </div>
        <div className="project-boq-stat">
          <span>Average progress</span>
          <strong>{avgProgress.toFixed(0)}%</strong>
          <small>{completedItems} dari {items.length} item selesai</small>
        </div>
        <div className="project-boq-stat">
          <span>Contract version</span>
          <strong>V{data.project.contractVersion || 1}</strong>
          <small>Snapshot tetap historis</small>
        </div>
      </div>

      <div className="project-boq-list">
        {(data.sections || []).map((section: any) => (
          <div className="project-boq-section" key={section.id || section.code}>
            <div className="project-boq-section-head">
              <div>
                <span className="project-boq-section-code">SECTION {section.code}</span>
                <strong>{section.name || section.title || `Section ${section.code}`}</strong>
              </div>
              <span>{section.items?.length || 0} item</span>
            </div>

            <div className="project-boq-items">
              {(section.items || []).map((raw: any) => {
                const baseItem: BOQItem = items.find((x) => x.id === raw.id) || {
                  ...raw,
                  sectionCode: section.code,
                  plannedQty: Number(raw.plannedQty),
                  unitPrice: Number(raw.unitPrice),
                  actualQty: Number(raw.actualQty),
                  actualAmount: Number(raw.actualAmount),
                  progressPct: Number(raw.progressPct),
                }
                const item = editedItem(baseItem)
                const progressTone = item.progressPct >= 100 ? 'green' : item.progressPct > 0 ? 'blue' : 'amber'
                return (
                  <div className="project-boq-item" key={item.id}>
                    <div className="project-boq-item-main">
                      <div className="project-boq-item-title">
                        <span className="project-boq-index">{section.code}</span>
                        <div>
                          <strong>{item.description}</strong>
                          <small>{[item.brand, item.itemType, item.unit].filter(Boolean).join(' · ') || 'Item project'}</small>
                        </div>
                      </div>
                    </div>

                    <div className="project-boq-metric">
                      <span>Planned</span>
                      <strong>{item.plannedQty} {item.unit}</strong>
                      <small>{money(item.unitPrice)} / unit</small>
                    </div>

                    <div className="project-boq-metric project-boq-input-metric">
                      <span>Actual qty</span>
                      {editable ? (
                        <input
                          className="f-input project-boq-input"
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.actualQty}
                          onChange={(e) => {
                            setEdits((current) => ({ ...current, [item.id]: { ...(current[item.id] || {}), actualQty: Number(e.target.value || 0) } }))
                          }}
                        />
                      ) : (
                        <strong>{item.actualQty} {item.unit}</strong>
                      )}
                    </div>

                    <div className="project-boq-metric project-boq-input-metric">
                      <span>Actual amount</span>
                      {editable ? (
                        <input
                          className="f-input project-boq-input"
                          type="number"
                          min="0"
                          step="1000"
                          value={item.actualAmount}
                          onChange={(e) => {
                            setEdits((current) => ({ ...current, [item.id]: { ...(current[item.id] || {}), actualAmount: Number(e.target.value || 0) } }))
                          }}
                        />
                      ) : (
                        <strong>{money(item.actualAmount)}</strong>
                      )}
                    </div>

                    <div className="project-boq-progress">
                      <div className="project-boq-progress-head">
                        <span>Progress</span>
                        <Badge tone={progressTone}>{item.progressPct.toFixed(0)}%</Badge>
                      </div>
                      <div className="project-boq-progress-bar"><span style={{ width: `${Math.max(0, Math.min(100, item.progressPct))}%` }} /></div>
                      {editable && (
                        <input
                          className="f-input project-boq-input project-boq-progress-input"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={item.progressPct}
                          onChange={(e) => {
                            setEdits((current) => ({ ...current, [item.id]: { ...(current[item.id] || {}), progressPct: Math.max(0, Math.min(100, Number(e.target.value || 0))) } }))
                          }}
                        />
                      )}
                    </div>

                    {editable && (
                      <div className="project-boq-item-action">
                        <button
                          className="f-btn soft"
                          disabled={busyItemId === item.id}
                          onClick={() => update(item)}
                        >
                          {busyItemId === item.id ? 'Menyimpan…' : 'Simpan perubahan'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
