'use client'

import { useEffect, useMemo, useState } from 'react'

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
        </div>
      </div>

      {canWrite && (
        <div className="project-documents-form-wrap">
          <div className="project-documents-form-intro">
            <div>
              <strong>Upload evidence project</strong>
              <span>Gunakan document key yang sama untuk membuat versi berikutnya.</span>
            </div>
            <div className="project-documents-hint">PDF, JPG, PNG, WEBP, XLSX, DOCX · max 10 MB</div>
          </div>

          {error && <div className="f-inline-alert error">{error}</div>}
          {success && <div className="f-inline-alert success">{success}</div>}

          <div className="project-documents-form">
            <label className="project-doc-field project-doc-field-wide">
              <span>Judul dokumen <em>Wajib</em></span>
              <input
                className="f-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Contoh: FAT Report Panel TM"
              />
              <small>Nama yang mudah dikenali oleh owner dan tim project.</small>
            </label>

            <label className="project-doc-field">
              <span>Document key <em>Opsional</em></span>
              <input
                className="f-input"
                value={documentKey}
                onChange={(event) => setDocumentKey(event.target.value.toUpperCase())}
                placeholder="FAT_REPORT"
              />
              <small>Identitas versioning. Contoh: FAT_REPORT atau BAP_01.</small>
            </label>

            <label className="project-doc-field">
              <span>Kategori</span>
              <select className="f-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <small>Pilih sesuai jenis evidence.</small>
            </label>

            <label className="project-doc-field">
              <span>Tanggal dokumen</span>
              <input
                type="date"
                className="f-input"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
              />
              <small>Isi tanggal yang tercantum pada dokumen.</small>
            </label>

            <label className="project-doc-field">
              <span>Sumber</span>
              <input
                className="f-input"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Vendor / Site / Customer"
              />
              <small>Siapa atau dari mana evidence berasal.</small>
            </label>

            <label className="project-doc-field">
              <span>Tags</span>
              <input
                className="f-input"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="FAT, panel TM, revision"
              />
              <small>Pisahkan tag dengan koma.</small>
            </label>

            <div className="project-doc-field project-doc-upload-field">
              <span>File <em>Wajib</em></span>
              <label className="project-doc-dropzone">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null)
                    setError('')
                    setSuccess('')
                  }}
                />
                <span className="project-doc-drop-icon">↑</span>
                <span>
                  <strong>{file ? file.name : 'Pilih file evidence'}</strong>
                  <small>{file ? formatBytes(file.size) : 'Klik untuk memilih file dari komputer'}</small>
                </span>
              </label>
            </div>

            <div className="project-doc-actions">
              <button className="f-btn" type="button" onClick={resetForm} disabled={busy}>
                Bersihkan
              </button>
              <button className="f-btn primary" type="button" disabled={!canSubmit} onClick={upload}>
                {busy ? 'Mengunggah…' : file ? 'Upload document' : 'Pilih file dahulu'}
              </button>
            </div>
          </div>
        </div>
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
