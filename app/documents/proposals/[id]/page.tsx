import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { money } from '@/components/finora-ui'
import DocumentPrintButton from '@/components/document-print-button'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

function categoryLabel(category: string) {
  if (category === 'MATERIAL') return 'Material'
  if (category === 'SERVICE') return 'Jasa / Instalasi'
  return 'Lainnya'
}

function categoryClass(category: string) {
  if (category === 'MATERIAL') return 'material'
  if (category === 'SERVICE') return 'service'
  return 'other'
}

function dateId(value: Date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

export default async function ProposalDocumentPage({ params }: Props) {
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

  return <main className="f-doc-page f-proposal-doc-page">
    <div className="f-doc-toolbar no-print">
      <a className="f-btn" href="/proposals">← Kembali ke Proposal</a>
      <a className="f-btn soft" href={`/proposals/${proposal.id}`}>Detail Proposal</a>
      <DocumentPrintButton />
    </div>
    <article className="f-document f-document-proposal-detail">
      <header className="f-document-head">
        <div>
          <div className="f-document-brand">FINORA</div>
          <div className="f-document-muted">Finance Made Simple</div>
          <div className="f-document-company-note">Quotation / Bill of Quantity</div>
        </div>
        <div className="f-document-type"><span>PROPOSAL / QUOTATION</span><strong>{proposal.proposalNumber}</strong><small>Status: {proposal.status}</small></div>
      </header>

      <section className="f-proposal-doc-meta">
        <div><span>Untuk</span><strong>{proposal.client.name}</strong><small>{proposal.client.email || '—'}</small><small>{proposal.client.address || 'Alamat belum diisi'}</small></div>
        <div><span>Project</span><strong>{proposal.projectName || '—'}</strong><small>{proposal.projectLocation || 'Lokasi belum diisi'}</small></div>
        <div><span>Quotation</span><strong>{proposal.quotationReference || proposal.proposalNumber}</strong><small>Dibuat {dateId(proposal.createdAt)}</small><small>Berlaku sampai {dateId(proposal.validUntil)}</small></div>
      </section>

      {proposal.scopeSummary && <section className="f-proposal-doc-scope"><span>Scope Pekerjaan</span><p>{proposal.scopeSummary}</p></section>}

      <section className="f-proposal-doc-summary">
        <div><span>Material</span><strong>{money(materialTotal)}</strong></div>
        <div><span>Jasa / Instalasi</span><strong>{money(serviceTotal)}</strong></div>
        <div><span>Lainnya / Overhead</span><strong>{money(otherTotal)}</strong></div>
        <div className="emphasis"><span>Total Penawaran</span><strong>{money(Number(proposal.totalAmount))}</strong></div>
      </section>

      <section className="f-proposal-doc-boq">
        <div className="f-proposal-doc-section-title"><div><span>Bill of Quantity</span><strong>Detail pekerjaan & spesifikasi</strong></div><small>{sections.length} section · {allItems.length} item</small></div>
        <table className="f-document-table f-proposal-boq-table">
          <thead><tr><th>No.</th><th>Uraian / Spesifikasi</th><th>Brand / Type</th><th>Qty</th><th>Unit</th><th>Harga Satuan</th><th>Total</th></tr></thead>
          <tbody>
            {sections.map(section => {
              const sectionTotal = section.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0)
              return <Fragment key={`section-${section.id}`}>
                <tr className="f-proposal-doc-section-row"><td colSpan={6}><strong>{section.code} — {section.name}</strong>{section.description ? <span>{section.description}</span> : null}</td><td>{money(sectionTotal)}</td></tr>
                {section.items.map((item, index) => <tr key={item.id} className="f-proposal-doc-item-row">
                  <td>{index + 1}</td>
                  <td><strong>{item.description}</strong><div className="f-document-item-meta"><span className={categoryClass(item.category)}>{categoryLabel(item.category)}</span>{item.specification ? <span>{item.specification}</span> : null}{item.notes ? <span>Catatan: {item.notes}</span> : null}</div></td>
                  <td>{item.brand || '—'}{item.itemType ? <div className="f-document-muted-inline">{item.itemType}</div> : null}</td>
                  <td>{item.qty}</td>
                  <td>{item.unit}</td>
                  <td>{money(Number(item.unitPrice))}</td>
                  <td>{money(Number(item.unitPrice) * item.qty)}</td>
                </tr>)}
              </Fragment>
            })}
          </tbody>
        </table>
      </section>

      <section className="f-document-totals f-proposal-doc-totals">
        <div><span>Subtotal</span><strong>{money(Number(proposal.subtotalAmount))}</strong></div>
        <div><span>Diskon ({Number(proposal.discountPercent)}%)</span><strong>- {money(Number(proposal.discountAmount))}</strong></div>
        <div><span>Pajak ({Number(proposal.taxPercent)}%)</span><strong>{money(Number(proposal.taxAmount))}</strong></div>
        <div className="grand"><span>Grand Total</span><strong>{money(Number(proposal.totalAmount))}</strong></div>
      </section>

      <section className="f-proposal-doc-commercial-grid">
        <div className="f-document-terms"><h3>Terms & Conditions</h3><p>{proposal.termsAndConditions || 'Tidak ada terms & conditions tambahan.'}</p></div>
        <div className="f-document-terms"><h3>Informasi Dokumen</h3><p>Dokumen ini dibuat dari Finora sebagai quotation/BOQ. Nilai komersial mengikuti data item yang tercatat di proposal.</p>{proposal.invoice && <p>Proposal telah dikonversi menjadi invoice {proposal.invoice.invoiceNumber}.</p>}</div>
      </section>

      <footer className="f-document-footer"><span>PT Berjaya Sukses Makmur · Dokumen dibuat dari Finora.</span><span>{proposal.proposalNumber} · Halaman dokumen quotation</span></footer>
    </article>
  </main>
}
