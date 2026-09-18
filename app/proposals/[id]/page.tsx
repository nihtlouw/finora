import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { Badge, Card, PageHeader, StatCard, money } from '@/components/finora-ui'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

function statusTone(status: string) {
  if (status === 'WON') return 'green' as const
  if (['LOST','EXPIRED','CANCELLED'].includes(status)) return 'red' as const
  if (status === 'SENT') return 'amber' as const
  return 'blue' as const
}

function categoryLabel(category: string) {
  if (category === 'MATERIAL') return 'Material'
  if (category === 'SERVICE') return 'Jasa / Instalasi'
  return 'Lainnya'
}

function dateId(value: Date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const context = await getCurrentFinoraContext()
  if (!context) redirect('/sign-in')
  const { id } = await params
  const proposal = await prisma.proposal.findFirst({
    where: { id, client: { workspaceId: context.workspace.id } },
    include: {
      client: true,
      invoice: true,
      sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { id: 'asc' } } } },
      items: { orderBy: { id: 'asc' } },
      revisions: { orderBy: { revisionNumber: 'desc' } },
    },
  })
  if (!proposal) notFound()

  const sections = proposal.sections.length
    ? proposal.sections
    : [{ id: 'legacy', code: 'A', name: 'Pekerjaan Utama', description: '', sortOrder: 0, items: proposal.items }]
  const allItems = sections.flatMap((section) => section.items)
  const materialTotal = allItems.filter((item) => item.category === 'MATERIAL').reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0)
  const serviceTotal = allItems.filter((item) => item.category === 'SERVICE').reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0)
  const otherTotal = allItems.filter((item) => item.category === 'OTHER').reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0)

  return <FinoraShell workspaceName={context.workspace.name} role={context.user.role} title="Detail Proposal">
    <div className="f-content f-detail-page">
      <div className="f-breadcrumb"><Link href="/proposals">Proposal</Link><span>›</span><strong>{proposal.proposalNumber}</strong></div>
      <PageHeader eyebrow="Penjualan / Detail Proposal" title={proposal.proposalNumber} description="Lihat seluruh struktur BOQ, spesifikasi teknis, komponen material/jasa, dan nilai komersial proposal." action={<div className="f-actions"><Link className="f-btn" href="/proposals">← Kembali</Link>{context.user.role!=='SALES'&&proposal.status==='WON'&&<Link className="f-btn soft" href={`/customer-pos?quotationId=${proposal.id}`}>Catat PO Customer</Link>}<a className="f-btn" href={`/documents/proposals/${proposal.id}`} target="_blank" rel="noreferrer">PDF / Cetak</a></div>} />

      <div className="f-detail-hero">
        <div className="f-detail-identity"><div className="f-contact-avatar client">Q</div><div><div className="f-eyebrow">Quotation / Project</div><h2>{proposal.projectName || 'Project belum diisi'}</h2><p>{proposal.client.name} · {proposal.projectLocation || 'Lokasi project belum diisi'}</p></div></div>
        <div className="f-detail-actions"><Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge>{proposal.invoice&&<Link className="f-btn soft" href="/invoices">Lihat invoice</Link>}</div>
      </div>

      <div className="f-grid-4 f-detail-kpis">
        <StatCard label="Total BOQ" value={allItems.length} icon="▤" />
        <StatCard label="Material" value={money(materialTotal)} icon="◈" />
        <StatCard label="Jasa" value={money(serviceTotal)} icon="⚙" />
        <StatCard label="Total penawaran" value={money(Number(proposal.totalAmount))} icon="Rp" />
      </div>

      <div className="f-detail-main-grid">
        <Card>
          <div className="f-card-head"><div><h3>Informasi penawaran</h3><p>Identitas commercial document dan project yang menjadi dasar BOQ.</p></div></div>
          <div className="f-detail-profile-grid">
            <div><span>Customer</span><strong>{proposal.client.name}</strong></div>
            <div><span>Reference</span><strong>{proposal.quotationReference || '—'}</strong></div>
            <div><span>Project</span><strong>{proposal.projectName || '—'}</strong></div>
            <div><span>Lokasi</span><strong>{proposal.projectLocation || '—'}</strong></div>
            <div><span>Berlaku sampai</span><strong>{dateId(proposal.validUntil)}</strong></div>
            <div><span>Dibuat</span><strong>{dateId(proposal.createdAt)}</strong></div>
            <div className="full"><span>Scope</span><strong>{proposal.scopeSummary || 'Ringkasan scope belum diisi.'}</strong></div>
          </div>
        </Card>
        <Card>
          <div className="f-card-head"><div><h3>Ringkasan komersial</h3><p>Nilai proposal dihitung dari seluruh item BOQ.</p></div></div>
          <div className="f-list">
            <div className="f-list-item"><span>Material</span><strong>{money(materialTotal)}</strong></div>
            <div className="f-list-item"><span>Jasa</span><strong>{money(serviceTotal)}</strong></div>
            <div className="f-list-item"><span>Lainnya</span><strong>{money(otherTotal)}</strong></div>
            <div className="f-list-item"><span>Subtotal</span><strong>{money(Number(proposal.subtotalAmount))}</strong></div>
            <div className="f-list-item"><span>Diskon</span><strong>- {money(Number(proposal.discountAmount))}</strong></div>
            <div className="f-list-item"><span>Pajak</span><strong>{money(Number(proposal.taxAmount))}</strong></div>
            <div className="f-list-item"><span>Total</span><strong>{money(Number(proposal.totalAmount))}</strong></div>
          </div>
        </Card>
      </div>

      {proposal.revisions.length > 0 && <Card><div className="f-card-head"><div><h3>Revision history</h3><p>Snapshot immutable untuk audit perubahan quotation.</p></div><span className="f-badge neutral">{proposal.revisions.length} revision</span></div><div className="f-list">{proposal.revisions.map((r)=><div className="f-list-item" key={r.id}><span>Revision {r.revisionNumber} · {r.status}</span><strong>{money(Number(r.roundedTotalAmount || r.totalAmount))}</strong></div>)}</div></Card>}

      <Card>
        <div className="f-card-head"><div><h3>BOQ & spesifikasi</h3><p>{sections.length} section · {allItems.length} item. Klik detail item untuk membuka spesifikasi teknis lengkap.</p></div><span className="f-badge neutral">Project quotation</span></div>
        <div className="f-proposal-boq">
          {sections.map((section) => {
            const sectionTotal = section.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0)
            return <section className="f-proposal-section" key={section.id}>
              <div className="f-proposal-section-head"><div><strong>{section.code} — {section.name}</strong>{section.description&&<span>{section.description}</span>}</div><strong>{money(sectionTotal)}</strong></div>
              <div className="f-proposal-table-wrap"><table className="f-table f-proposal-detail-table"><colgroup><col className="col-no" /><col className="col-item" /><col className="col-category" /><col className="col-brand" /><col className="col-qty" /><col className="col-unit" /><col className="col-price" /><col className="col-total" /></colgroup><thead><tr><th>No</th><th>Item</th><th>Kategori</th><th>Brand / Type</th><th>Qty</th><th>Unit</th><th>Harga</th><th>Total</th></tr></thead><tbody>{section.items.map((item, index) => <tr key={item.id}><td>{index+1}</td><td><div className="f-proposal-item-title">{item.description}</div>{item.notes&&<div className="f-muted f-proposal-item-note">Catatan: {item.notes}</div>}<details className="f-proposal-spec"><summary>Lihat spesifikasi</summary><div className="f-proposal-spec-grid"><div><span>Spesifikasi</span><strong>{item.specification || 'Tidak ada spesifikasi.'}</strong></div><div><span>Brand</span><strong>{item.brand || '—'}</strong></div><div><span>Type</span><strong>{item.itemType || '—'}</strong></div></div></details></td><td><Badge tone={item.category === 'MATERIAL' ? 'green' : item.category === 'SERVICE' ? 'blue' : 'neutral'}>{categoryLabel(item.category)}</Badge></td><td>{item.brand || '—'}{item.itemType ? <div className="f-muted">{item.itemType}</div> : null}</td><td>{item.qty}</td><td>{item.unit}</td><td className="f-number">{money(Number(item.unitPrice))}</td><td className="f-number">{money(Number(item.unitPrice) * item.qty)}</td></tr>)}</tbody></table></div>
            </section>
          })}
        </div>
      </Card>

      <div className="f-detail-main-grid">
        <Card><div className="f-card-head"><div><h3>Terms & Conditions</h3><p>Ketentuan komersial yang ikut melekat pada quotation.</p></div></div><div className="f-detail-text">{proposal.termsAndConditions || 'Belum ada terms & conditions.'}</div></Card>
        <Card><div className="f-card-head"><div><h3>Status dokumen</h3><p>Hubungan proposal dengan proses billing.</p></div></div><div className="f-list"><div className="f-list-item"><span>Status proposal</span><Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge></div><div className="f-list-item"><span>Invoice</span><strong>{proposal.invoice?.invoiceNumber || 'Belum dikonversi'}</strong></div><div className="f-list-item"><span>Nilai</span><strong>{money(Number(proposal.totalAmount))}</strong></div></div></Card>
      </div>
    </div>
  </FinoraShell>
}
