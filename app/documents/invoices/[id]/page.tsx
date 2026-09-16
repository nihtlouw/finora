import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { getCurrentFinoraContext } from '@/lib/auth/current-user'
import { money } from '@/components/finora-ui'
import DocumentPrintButton from '@/components/document-print-button'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function InvoiceDocumentPage({ params }: Props) {
  const context = await getCurrentFinoraContext()
  if (!context) redirect('/sign-in')
  const { id } = await params
  const invoice = await prisma.invoice.findFirst({
    where: { id, client: { workspaceId: context.workspace.id } },
    include: { client: true, items: true, payments: { include: { gatewayTransaction: true } }, proposal: true },
  })
  if (!invoice) notFound()
  const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const outstanding = Math.max(Number(invoice.totalAmount) - paid, 0)
  let displayedStatus = invoice.status
  if (paid >= Number(invoice.totalAmount)) displayedStatus = 'PAID'
  else if (invoice.dueDate < new Date(new Date().toISOString().slice(0,10))) displayedStatus = 'OVERDUE'
  else if (paid > 0) displayedStatus = 'PARTIAL'

  return <main className="f-doc-page">
    <div className="f-doc-toolbar no-print"><a className="f-btn" href="/invoices">← Kembali ke Invoice</a><DocumentPrintButton /></div>
    <article className="f-document">
      <header className="f-document-head"><div><div className="f-document-brand">FINORA</div><div className="f-document-muted">Finance Made Simple</div></div><div className="f-document-type"><span>INVOICE</span><strong>{invoice.invoiceNumber}</strong><small>Status: {displayedStatus}</small></div></header>
      <section className="f-document-meta f-document-box-grid"><div><span>Tagih kepada</span><strong>{invoice.client.name}</strong><small>{invoice.client.email || '—'}</small><small>{invoice.client.address || 'Alamat belum diisi'}</small></div><div><span>Jatuh tempo</span><strong>{new Date(invoice.dueDate).toLocaleDateString('id-ID')}</strong><small>Dibuat {new Date(invoice.createdAt).toLocaleDateString('id-ID')}</small></div></section>
      <table className="f-document-table"><thead><tr><th>Deskripsi</th><th>Qty</th><th>Harga satuan</th><th>Total</th></tr></thead><tbody>{invoice.items.map(item=><tr key={item.id}><td>{item.description}</td><td>{item.qty}</td><td>{money(Number(item.unitPrice))}</td><td>{money(Number(item.unitPrice)*item.qty)}</td></tr>)}</tbody></table>
      <section className="f-document-totals"><div><span>Subtotal</span><strong>{money(Number(invoice.subtotalAmount || invoice.totalAmount))}</strong></div><div><span>Diskon ({Number(invoice.discountPercent)}%)</span><strong>- {money(Number(invoice.discountAmount))}</strong></div><div><span>Pajak ({Number(invoice.taxPercent)}%)</span><strong>{money(Number(invoice.taxAmount))}</strong></div><div className="grand"><span>Total</span><strong>{money(Number(invoice.totalAmount))}</strong></div><div><span>Sudah dibayar</span><strong>{money(paid)}</strong></div><div><span>Sisa tagihan</span><strong>{money(outstanding)}</strong></div></section>
      {invoice.termsAndConditions&&<section className="f-document-terms"><h3>Terms & Conditions</h3><p>{invoice.termsAndConditions}</p></section>}
      <section className="f-document-terms"><h3>Riwayat pembayaran</h3>{invoice.payments.length?<ul>{invoice.payments.map(payment=>{const paymentType=payment.gatewayTransaction?.paymentType;const gatewayLabel=paymentType?({qris:'QRIS',bank_transfer:'Bank Transfer',gopay:'GoPay',shopeepay:'ShopeePay',credit_card:'Kartu',cstore:'Convenience Store'} as Record<string,string>)[paymentType]||paymentType:null;const label=gatewayLabel||({BANK_TRANSFER:'Transfer Bank',CASH:'Cash',GOPAY:'GoPay',SHOPEEPAY:'ShopeePay',QRIS:'QRIS',CREDIT_CARD:'Kartu'} as Record<string,string>)[payment.method]||payment.method;return <li key={payment.id}>{new Date(payment.paymentDate).toLocaleDateString('id-ID')} · {label} · {money(Number(payment.amount))}</li>})}</ul>:<p>Belum ada pembayaran.</p>}</section>
      <footer className="f-document-footer"><span>Dokumen dibuat dari Finora.</span>{invoice.proposal&&<span>Sumber: Proposal {invoice.proposal.proposalNumber}</span>}</footer>
    </article>
  </main>
}
