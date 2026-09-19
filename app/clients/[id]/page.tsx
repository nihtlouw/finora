import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import FinoraShell from '@/components/finora-shell'
import { Badge, Card, PageHeader, money } from '@/components/finora-ui'
import { canManageClients, getCurrentFinoraContext } from '@/lib/auth/current-user'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

function dateId(value: Date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function statusTone(status: string) {
  if (['PAID', 'ACCEPTED', 'APPROVED'].includes(status)) return 'green' as const
  if (['PENDING', 'PARTIAL', 'SENT'].includes(status)) return 'amber' as const
  if (['OVERDUE', 'REJECTED'].includes(status)) return 'red' as const
  return 'neutral' as const
}

export default async function ClientVendorDetailPage({ params }: PageProps) {
  const context = await getCurrentFinoraContext()
  if (!context) redirect('/sign-in')
  const { id } = await params
  const contact = await prisma.clientVendor.findFirst({
    where: { id, workspaceId: context.workspace.id },
    include: {
      proposals: { select: { id: true, proposalNumber: true, status: true, totalAmount: true, validUntil: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, dueDate: true, totalAmount: true, subtotalAmount: true, discountPercent: true, discountAmount: true, taxPercent: true, taxAmount: true, createdAt: true, payments: { select: { id: true, amount: true, paymentDate: true, method: true }, orderBy: { paymentDate: 'desc' } } }, orderBy: { createdAt: 'desc' } },
      expenses: { select: { id: true, category: true, amount: true, expenseDate: true, status: true }, orderBy: { expenseDate: 'desc' } },
    },
  })
  if (!contact) notFound()

  const proposals = contact.proposals
  const invoices = contact.invoices.map((invoice) => {
    const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return { ...invoice, totalAmount: Number(invoice.totalAmount), subtotalAmount: Number(invoice.subtotalAmount), discountPercent: Number(invoice.discountPercent), discountAmount: Number(invoice.discountAmount), taxPercent: Number(invoice.taxPercent), taxAmount: Number(invoice.taxAmount), paidAmount, outstandingAmount: Math.max(Number(invoice.totalAmount) - paidAmount, 0) }
  })
  const expenses = contact.expenses.map((expense) => ({ ...expense, amount: Number(expense.amount) }))
  const invoiceTotal = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
  const paidTotal = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0)
  const outstandingTotal = invoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0)
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const approvedExpenseTotal = expenses.filter((expense) => expense.status === 'APPROVED').reduce((sum, expense) => sum + expense.amount, 0)
  const pendingExpenseTotal = expenses.filter((expense) => expense.status === 'PENDING').reduce((sum, expense) => sum + expense.amount, 0)
  const paymentCount = invoices.reduce((sum, invoice) => sum + invoice.payments.length, 0)
  const isClient = contact.type === 'CLIENT'

  const history = [
    ...proposals.map((proposal) => ({ id:`proposal-${proposal.id}`, date:proposal.createdAt, kind:'Proposal', title:proposal.proposalNumber, detail:`Status ${proposal.status}`, amount:Number(proposal.totalAmount), tone:statusTone(proposal.status), href:`/proposals?focus=${proposal.id}` })),
    ...invoices.flatMap((invoice) => [
      { id:`invoice-${invoice.id}`, date:invoice.createdAt, kind:'Invoice', title:invoice.invoiceNumber, detail:`Status ${invoice.status}`, amount:invoice.totalAmount, tone:statusTone(invoice.status), href:`/documents/invoices/${invoice.id}` },
      ...invoice.payments.map((payment) => ({ id:`payment-${payment.id}`, date:payment.paymentDate, kind:'Payment', title:invoice.invoiceNumber, detail:`Pembayaran ${payment.method}`, amount:Number(payment.amount), tone:'green' as const, href:'/payments' })),
    ]),
    ...expenses.map((expense) => ({ id:`expense-${expense.id}`, date:expense.expenseDate, kind:'Expense', title:expense.category, detail:`Status ${expense.status}`, amount:expense.amount, tone:statusTone(expense.status), href:`/expenses?focus=${expense.id}` })),
  ].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())

  return <FinoraShell workspaceName={context.workspace.name} role={context.user.role} title={isClient ? 'Detail Klien' : 'Detail Vendor'}>
    <div className="f-content f-detail-page">
      <div className="f-breadcrumb no-print"><Link href="/clients">Klien & Vendor</Link><span>›</span><strong>{contact.name}</strong></div>
      <PageHeader eyebrow="Master Data / Detail" title={contact.name} description={isClient ? 'Ringkasan hubungan bisnis, invoice, pembayaran, dan histori aktivitas klien.' : 'Ringkasan vendor, expense, approval, dan histori aktivitas operasional.'} action={<div className="f-actions"><Badge tone={contact.isActive?'green':'neutral'}>{contact.isActive?'Aktif':'Diarsipkan'}</Badge>{canManageClients(context.user.role)&&<Link href={`/clients?edit=${contact.id}`} className="f-btn primary">Edit Kontak</Link>}<Link href="/clients" className="f-btn">← Kembali</Link></div>} />

      <section className="f-detail-hero">
        <div className="f-detail-identity"><div className={`f-contact-avatar ${isClient?'client':'vendor'}`}>{contact.name.slice(0,1).toUpperCase()}</div><div><div className="f-eyebrow">{isClient?'Klien':'Vendor'}</div><h2>{contact.name}</h2><p>{contact.picName ? `PIC: ${contact.picName}` : 'PIC belum diisi'}{contact.email ? ` · ${contact.email}` : ''}</p></div></div>
        <div className="f-detail-actions">{isClient&&<a className="f-btn primary" href="/proposals">＋ Buat Proposal</a>}{!isClient&&<a className="f-btn primary" href="/expenses">＋ Catat Expense</a>}{contact.email&&<a className="f-btn" href={`mailto:${contact.email}`}>Kirim email</a>}</div>
      </section>

      <div className="f-grid-4 f-detail-kpis">
        <div className="f-stat"><div className="f-stat-icon">▧</div><div className="f-stat-body"><span>{isClient?'Total invoice':'Total expense'}</span><strong>{money(isClient?invoiceTotal:expenseTotal)}</strong><small>{isClient?`${invoices.length} invoice`:`${expenses.length} expense`}</small></div></div>
        <div className="f-stat"><div className="f-stat-icon">✓</div><div className="f-stat-body"><span>{isClient?'Sudah dibayar':'Sudah disetujui'}</span><strong>{money(isClient?paidTotal:approvedExpenseTotal)}</strong><small>{isClient?`${paymentCount} pembayaran`:`${expenses.filter(x=>x.status==='APPROVED').length} disetujui`}</small></div></div>
        <div className="f-stat"><div className="f-stat-icon">◌</div><div className="f-stat-body"><span>{isClient?'Outstanding':'Menunggu approval'}</span><strong>{money(isClient?outstandingTotal:pendingExpenseTotal)}</strong><small>{isClient?'Sisa tagihan':'Masih pending'}</small></div></div>
        <div className="f-stat"><div className="f-stat-icon">▤</div><div className="f-stat-body"><span>Aktivitas</span><strong>{proposals.length + invoices.length + paymentCount + expenses.length}</strong><small>Aktivitas terkait</small></div></div>
      </div>

      <div className="f-detail-main-grid">
        <Card>
          <div className="f-card-head"><div><h3>Profil kontak</h3><p>Informasi master yang dipakai seluruh transaksi.</p></div></div>
          <div className="f-detail-profile-grid">
            <div><span>Jenis</span><strong>{isClient?'Klien':'Vendor'}</strong></div><div><span>Kategori</span><strong>{contact.category||'—'}</strong></div><div><span>PIC</span><strong>{contact.picName||'—'}</strong></div><div><span>Email</span><strong>{contact.email||'—'}</strong></div><div><span>Telepon</span><strong>{contact.phone||'—'}</strong></div><div><span>NPWP</span><strong>{contact.npwp||'—'}</strong></div><div><span>Terdaftar</span><strong>{dateId(contact.createdAt)}</strong></div><div className="full"><span>{isClient?'Bidang / kebutuhan utama':'Produk / jasa yang disediakan'}</span><strong>{contact.offerings||'Belum diisi'}</strong></div><div className="full"><span>Alamat</span><strong>{contact.address||'Alamat belum diisi'}</strong></div>
          </div>
        </Card>
        <Card>
          <div className="f-card-head"><div><h3>Ringkasan aktivitas</h3><p>Snapshot hubungan bisnis saat ini.</p></div></div>
          <div className="f-list"><div className="f-list-item"><span>Proposal</span><strong>{proposals.length}</strong></div><div className="f-list-item"><span>Invoice</span><strong>{invoices.length}</strong></div>{isClient?<div className="f-list-item"><span>Pembayaran</span><strong>{paymentCount}</strong></div>:<div className="f-list-item"><span>Expense</span><strong>{expenses.length}</strong></div>}<div className="f-list-item"><span>Status</span><Badge tone={contact.isActive?'green':'neutral'}>{contact.isActive?'Aktif':'Diarsipkan'}</Badge></div></div>
        </Card>
      </div>

      <Card>
        <div className="f-card-head"><div><h3>Histori transaksi</h3><p>Aktivitas terbaru yang terkait dengan kontak ini.</p></div><span className="f-badge neutral">{history.length} aktivitas</span></div>
        {history.length ? <div className="f-detail-timeline">{history.map(item=><div className="f-timeline-item" key={item.id}><div className="f-timeline-dot"/><div className="f-timeline-content"><div className="f-timeline-top"><span className="f-timeline-kind"><Badge tone={item.tone}>{item.kind}</Badge><strong>{item.title}</strong></span><strong>{money(item.amount)}</strong></div><div className="f-timeline-bottom"><span>{dateId(item.date)} · {item.detail}</span><a href={item.href} className="f-btn soft">Lihat</a></div></div></div>)}</div> : <div className="f-empty"><strong>Belum ada aktivitas</strong>Transaksi terkait kontak ini akan tampil di sini.</div>}
      </Card>

      <div className="f-detail-main-grid detail-secondary">
        <Card>
          <div className="f-card-head"><div><h3>{isClient?'Invoice & pembayaran':'Expense vendor'}</h3><p>{isClient?'Ringkasan tagihan dan saldo per invoice.':'Status biaya yang menggunakan vendor ini.'}</p></div></div>
          {isClient ? invoices.length ? <div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th></th></tr></thead><tbody>{invoices.map(invoice=><tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><div className="f-muted" style={{fontSize:10}}>Jatuh tempo {dateId(invoice.dueDate)}</div></td><td><Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge></td><td>{money(invoice.totalAmount)}</td><td>{money(invoice.paidAmount)}</td><td>{money(invoice.outstandingAmount)}</td><td><a className="f-btn" href={`/documents/invoices/${invoice.id}`} target="_blank" rel="noreferrer">PDF</a></td></tr>)}</tbody></table></div> : <div className="f-empty"><strong>Belum ada invoice</strong>Invoice yang terkait dengan klien ini akan tampil di sini.</div> : expenses.length ? <div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Status</th><th>Nilai</th><th>Aksi</th></tr></thead><tbody>{expenses.map(expense=><tr key={expense.id}><td>{dateId(expense.expenseDate)}</td><td>{expense.category}</td><td><Badge tone={statusTone(expense.status)}>{expense.status}</Badge></td><td className="f-number">{money(expense.amount)}</td><td><a className="f-btn soft" href={`/expenses?focus=${expense.id}`}>Lihat detail</a></td></tr>)}</tbody></table></div> : <div className="f-empty"><strong>Belum ada expense</strong>Expense yang memakai vendor ini akan tampil di sini.</div>}
        </Card>
      </div>
    </div>
  </FinoraShell>
}
