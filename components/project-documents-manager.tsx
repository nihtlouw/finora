'use client'

import { useEffect, useMemo, useState } from 'react'
import { SideDrawer } from '@/components/finora-side-drawer'

type ProjectDocument = {
  id: string
  title: string
  category: string
  documentKey: string | null
  version: number
  documentDate: string | null
  tags: string[]
  source: string | null
  isCurrent: boolean
  fileName: string
  mimeType: string
  sizeBytes: number
}

type Props = {
  projectId: string
  role: string
}

const CATEGORY_OPTIONS = [
  ['GENERAL', 'General'],
  ['CONTRACT', 'Contract'],
  ['PO', 'PO'],
  ['FAT', 'FAT'],
  ['DELIVERY', 'Delivery'],
  ['PROGRESS', 'Progress'],
  ['TESTING', 'Testing'],
  ['SLO_NIDI', 'SLO / NIDI'],
  ['BAP_BAST', 'BAP / BAST'],
  ['CLOSEOUT', 'Closeout'],
  ['INVOICE', 'Invoice'],
  ['PAYMENT', 'Payment'],
  ['OTHER', 'Other'],
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return 'Tanggal tidak diisi'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function ProjectDocumentsManager({ projectId, role }: Props) {
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('GENERAL')
  const [documentKey, setDocumentKey] = useState('')
  const [documentDate, setDocumentDate] = useState('')
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [success, setSuccess] = useState('')

  const canWrite = ['OWNER', 'FINANCE'].includes(role)
  const canSubmit = Boolean(file && title.trim() && !busy)

  const currentCount = useMemo(() => docs.filter((doc) => doc.isCurrent).length, [docs])

  async function load() {
    try {
      const response = await fetch(`/api/project-documents?projectId=${projectId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal memuat dokumen project.')
      setDocs(data.documents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dokumen project.')
    }
  }

  useEffect(() => {
    load()
  }, [projectId])

  function resetForm() {
    setTitle('')
    setFile(null)
    setDocumentKey('')
    setDocumentDate('')
    setSource('')
    setTags('')
  }

  async function upload() {
    if (!file || !title.trim() || busy) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const form = new FormData()
      form.append('projectId', projectId)
      form.append('title', title.trim())
      form.append('category', category)
      form.append('documentKey', documentKey.trim())
      form.append('documentDate', documentDate)
      form.append('source', source.trim())
      form.append('tags', tags)
      form.append('file', file)

      const response = await fetch('/api/project-documents', {
        method: 'POST',
        body: form,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload gagal.')

      resetForm()
      await load()
      setDrawerOpen(false)
      setSuccess('Dokumen berhasil diunggah. Versi terbaru sudah ditandai sebagai current.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload gagal.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Hapus dokumen ini? Jika ini versi current, versi sebelumnya akan dipulihkan sebagai current.')) return

    setError('')
    setSuccess('')
    const response = await fetch(`/api/project-documents/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'Gagal menghapus dokumen.')
      return
    }
    await load()
    setSuccess('Dokumen berhasil dihapus.')
  }

  return (
    <section className="f-card project-documents-card" id="documents-project">
      <div className="f-card-head project-documents-head">
        <div>
          <div className="project-documents-kicker">PROJECT EVIDENCE</div>
          <h3>Project Documents</h3>
          <p>Kelola FAT, delivery, progress, testing, SLO/NIDI, BAP/BAST, dan closeout beserta versioning-nya.</p>
        </div>
        <div className="project-documents-counts">
          <span className="f-badge neutral">{docs.length} file</span>
          {currentCount > 0 && <span className="project-documents-current">{currentCount} current</span>}
          {canWrite && <button className="f-btn primary" type="button" onClick={()=>{setError('');setSuccess('');setDrawerOpen(true)}}>+ Upload document</button>}
        </div>
      </div>

      {canWrite && (
        <>
          {error && <div className="f-inline-alert error">{error}</div>}
          {success && <div className="f-inline-alert success">{success}</div>}
          <SideDrawer
            className="f-project-document-drawer"
            open={drawerOpen}
            onClose={() => !busy && setDrawerOpen(false)}
            title="Upload project document"
            description="Evidence tersimpan dengan category, document key, dan versioning. Smart Scan akan menjadi layer berikutnya di atas fondasi ini."
            footer={<div className="f-drawer-actions"><button type="button" className="f-btn" onClick={resetForm} disabled={busy}>Bersihkan</button><button type="button" className="f-btn primary" disabled={!canSubmit} onClick={upload}>{busy ? 'Mengunggah…' : file ? 'Upload document' : 'Pilih file dahulu'}</button></div>}
          >
            <div className="f-form">
              <label>Judul dokumen
                <input className="f-input" value={title} onChange={event=>setTitle(event.target.value)} placeholder="Contoh: FAT Report Panel TM" />
                <small>Nama yang mudah dikenali owner dan tim project.</small>
              </label>
              <label>Document key
                <input className="f-input" value={documentKey} onChange={event=>setDocumentKey(event.target.value.toUpperCase())} placeholder="FAT_REPORT / BAP_01" />
                <small>Gunakan key yang sama untuk membuat versi berikutnya.</small>
              </label>
              <label>Kategori
                <select className="f-select" value={category} onChange={event=>setCategory(event.target.value)}>
                  {CATEGORY_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Tanggal dokumen
                <input className="f-input" type="date" value={documentDate} onChange={event=>setDocumentDate(event.target.value)} />
              </label>
              <label>Sumber
                <input className="f-input" value={source} onChange={event=>setSource(event.target.value)} placeholder="Vendor / Site / Customer" />
              </label>
              <label>Tags
                <input className="f-input" value={tags} onChange={event=>setTags(event.target.value)} placeholder="FAT, panel TM, revision" />
              </label>
              <label>File
                <input className="f-input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event=>{setFile(event.target.files?.[0]||null);setError('');setSuccess('')}} />
                <small>{file ? file.name+' · '+formatBytes(file.size) : 'PDF / JPG / PNG / WEBP / XLSX / DOCX · max 10 MB'}</small>
              </label>
              <div className="f-inline-alert info">Dokumen sumber tetap menjadi evidence. Tahap Smart Scan akan menambahkan extraction, confidence, verification, dan hubungan ke business entity tanpa menghapus file asli.</div>
            </div>
          </SideDrawer>
        </>
      )}

      {!canWrite && (
        <div className="project-documents-readonly">
          Anda memiliki akses lihat. Upload dan penghapusan dokumen hanya tersedia untuk Owner dan Finance.
        </div>
      )}

      {docs.length === 0 ? (
        <div className="project-documents-empty">
          <div className="project-documents-empty-icon">▣</div>
          <strong>Belum ada dokumen project</strong>
          <p>Upload FAT report, BAP/BAST, delivery note, test report, atau evidence lain di atas.</p>
        </div>
      ) : (
        <div className="project-documents-list">
          <div className="project-documents-list-head">
            <span>Dokumen</span>
            <span>Status</span>
            <span>Aksi</span>
          </div>
          {docs.map((doc) => (
            <div key={doc.id} className="project-documents-row">
              <div className="project-documents-main">
                <div className="project-documents-icon">📄</div>
                <div>
                  <strong>{doc.title}</strong>
                  <div className="project-documents-meta">
                    {doc.category.replace('_', ' / ')} · {doc.documentKey || 'AUTO KEY'} · {doc.fileName}
                  </div>
                  <div className="project-documents-meta">
                    v{doc.version} · {formatBytes(doc.sizeBytes)} · {formatDate(doc.documentDate)}{doc.source ? ` · ${doc.source}` : ''}
                  </div>
                </div>
              </div>
              <div>
                {doc.isCurrent ? (
                  <span className="f-badge green">Current</span>
                ) : (
                  <span className="f-badge neutral">History v{doc.version}</span>
                )}
              </div>
              <div className="project-documents-actions">
                <a className="f-btn soft f-btn-compact" href={`/api/project-documents/${doc.id}`}>Download</a>
                {canWrite && <button className="f-btn f-btn-compact" onClick={() => remove(doc.id)}>Hapus</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
