'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

const nav = [
  { href:'/dashboard', label:'Dashboard', icon:'▦' },
  { href:'/clients', label:'Klien & Vendor', icon:'♙' },
  { href:'/proposals', label:'Proposal', icon:'▤' },
  { href:'/invoices', label:'Invoice', icon:'▧' },
  { href:'/payments', label:'Pembayaran', icon:'↔' },
  { href:'/expenses', label:'Biaya (Expense)', icon:'◈' },
  { href:'/budgets', label:'Anggaran (Budget)', icon:'◎' },
  { href:'/reports', label:'Laporan', icon:'▥' },
  { href:'/settings', label:'Pengaturan', icon:'⚙' },
]

export default function FinoraShell({children, workspaceName='Workspace', role='VIEWER', title='Finora'}:{children:React.ReactNode;workspaceName?:string;role?:string;title?:string}) {
  const pathname = usePathname()
  return (
    <div className="f-app">
      <aside className="f-side">
        <div className="f-brand"><span className="f-brand-mark">◢</span><div><b>Finora</b><small>Finance Made Simple.</small></div></div>
        <div className="f-workspace"><span className="f-work-avatar">{workspaceName.slice(0,2).toUpperCase()}</span><div><small>Workspace</small><strong>{workspaceName}</strong></div><span>⌄</span></div>
        <nav className="f-nav">
          {nav.map(item=>{
            const active=pathname===item.href || (item.href!=='/dashboard' && pathname.startsWith(item.href))
            return <Link key={item.href} href={item.href} className={active?'f-nav-item active':'f-nav-item'}><span>{item.icon}</span>{item.label}{item.href==='/invoices' && <em>3</em>}</Link>
          })}
        </nav>
        <div className="f-side-bottom">
          <div className="f-help-card"><strong>Kelola keuangan dengan lebih mudah.</strong><p>Dari proposal sampai pembayaran, semua dalam satu platform.</p></div>
          <div className="f-user"><UserButton /><div><strong>Profil</strong><small>{roleLabel(role)}</small></div></div>
        </div>
      </aside>
      <main className="f-main">
        <header className="f-top">
          <div className="f-top-search">⌕ <span>Cari klien, vendor, invoice, atau lainnya...</span><kbd>Ctrl K</kbd></div>
          <div className="f-top-right"><button className="f-icon">◔</button><button className="f-icon dot">♧</button><span className="f-date">{new Intl.DateTimeFormat('id-ID',{dateStyle:'full'}).format(new Date())}</span><span className="f-title">{title}</span></div>
        </header>
        {children}
      </main>
    </div>
  )
}
function roleLabel(role:string){return role==='OWNER'?'Owner':role==='FINANCE'?'Finance':role==='SALES'?'Sales':'Viewer'}
