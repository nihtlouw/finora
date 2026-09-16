"use client"

import Link from 'next/link'
import { SignOutButton, UserButton } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const navGroups = [
  { label: 'Workspace', items: [
    { href:'/dashboard', label:'Dashboard', icon:'▦' },
    { href:'/clients', label:'Klien & Vendor', icon:'♙' },
  ]},
  { label: 'Commercial', items: [
    { href:'/proposals', label:'Proposal', icon:'▤' },
    { href:'/customer-pos', label:'PO Customer', icon:'▧' },
    { href:'/projects', label:'Project', icon:'◇' },
    { href:'/change-orders', label:'Change Orders', icon:'↕' },
  ]},
  { label: 'Billing & Collection', items: [
    { href:'/invoices', label:'Invoice', icon:'▧' },
    { href:'/receivables', label:'Piutang', icon:'◌' },
    { href:'/payments', label:'Pembayaran', icon:'↔' },
    { href:'/credit-notes', label:'Credit Note', icon:'−' },
  ]},
  { label: 'Cost & Treasury', items: [
    { href:'/expenses', label:'Biaya', icon:'◈' },
    { href:'/cashflow', label:'Cash Flow', icon:'⌁' },
    { href:'/budgets', label:'Anggaran', icon:'◎' },
    { href:'/vendor-bills', label:'Vendor Bills', icon:'▣' },
    { href:'/payroll', label:'Payroll', icon:'◫' },
    { href:'/banks', label:'Bank', icon:'₿' },
  ]},
  { label: 'Control & Insights', items: [
    { href:'/reports', label:'Laporan', icon:'▥' },
    { href:'/reconciliation', label:'Rekonsiliasi', icon:'≈' },
    { href:'/periods', label:'Closing', icon:'▥' },
    { href:'/employees', label:'Karyawan', icon:'♙' },
  ]},
  { label: 'System', items: [
    { href:'/settings', label:'Pengaturan', icon:'⚙' },
  ]},
]
const nav = navGroups.flatMap((g) => g.items)

export default function FinoraShell({children, workspaceName='Workspace', role='VIEWER', title='Finora'}:{children:React.ReactNode;workspaceName?:string;role?:string;title?:string}) {
  const pathname = usePathname()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const allowed = (href:string) => !['/reconciliation','/receivables','/customer-pos','/projects','/change-orders','/credit-notes','/vendor-bills','/payroll','/banks','/periods','/employees'].includes(href) || ['OWNER','FINANCE'].includes(role)
  const navItems = nav.filter((item) => allowed(item.href))
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setFocused(false)
        setNotifications(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetch('/api/invoices'), fetch('/api/expenses')])
      .then(async ([invoiceRes, expenseRes]) => [await invoiceRes.json(), await expenseRes.json()])
      .then(([invoiceData, expenseData]) => {
        if (cancelled) return
        const overdue = (invoiceData.invoices || []).filter((x:any) => x.status === 'OVERDUE').length
        const pending = (expenseData.expenses || []).filter((x:any) => x.status === 'PENDING').length
        setNotificationCount(overdue + pending)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pathname])

  const matches = navItems.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()) || item.href.toLowerCase().includes(search.toLowerCase()))
  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const exact = matches[0]
    if (exact) { router.push(exact.href); setSearch(''); setFocused(false) }
  }

  return (
    <div className="f-app">
      <aside className="f-side">
        <div className="f-brand"><span className="f-brand-mark">◢</span><div><b>Finora</b><small>Finance Made Simple.</small></div></div>
        <div className="f-workspace"><span className="f-work-avatar">{workspaceName.slice(0,2).toUpperCase()}</span><div><small>Workspace</small><strong>{workspaceName}</strong></div></div>
        <nav className="f-nav">
          {navGroups.map(group=>{
            const visible=group.items.filter(item=>allowed(item.href))
            if(!visible.length) return null
            return <div key={group.label} className="f-nav-group">
              <div className="f-nav-group-label">{group.label}</div>
              {visible.map(item=>{
                const active=pathname===item.href || (item.href!=='/dashboard' && pathname.startsWith(item.href))
                return <Link key={item.href} href={item.href} className={active?'f-nav-item active':'f-nav-item'}><span>{item.icon}</span>{item.label}{item.href==='/invoices' && notificationCount>0 && <em>{notificationCount}</em>}</Link>
              })}
            </div>
          })}
        </nav>
        <div className="f-side-bottom">
          <div className="f-help-card"><strong>Kelola keuangan dengan lebih mudah.</strong><p>Dari proposal sampai pembayaran, semua dalam satu platform.</p></div>
          <div className="f-user" style={{alignItems:'center'}}>
            <UserButton appearance={{elements:{userButtonAvatarBox:'f-user-avatar'}}}/>
            <div style={{minWidth:0}}><strong>Profil</strong><small>{roleLabel(role)}</small></div>
            <SignOutButton>
              <button type="button" className="f-btn" style={{marginLeft:'auto',whiteSpace:'nowrap'}}>Keluar</button>
            </SignOutButton>
          </div>
        </div>
      </aside>
      <main className="f-main">
        <header className="f-top">
          <div className="f-search-wrap">
            <form className="f-top-search" onSubmit={submitSearch}>
              <span>⌕</span>
              <input ref={searchRef} value={search} onChange={(e)=>setSearch(e.target.value)} onFocus={()=>setFocused(true)} placeholder="Cari menu, klien, invoice, atau lainnya..." aria-label="Pencarian Finora" />
              <kbd>Ctrl K</kbd>
            </form>
            {focused && search && <div className="f-search-results">{matches.length ? matches.slice(0,6).map(item=><button type="button" key={item.href} onClick={()=>{router.push(item.href);setSearch('');setFocused(false)}}><span>{item.icon}</span>{item.label}<small>{item.href}</small></button>) : <div className="f-search-empty">Tidak ada menu yang cocok.</div>}</div>}
          </div>
          <div className="f-top-right">
            <button type="button" className="f-icon" onClick={()=>setNotifications((v)=>!v)} aria-label="Notifikasi">♧{notificationCount>0&&<span className="f-notification-dot">{notificationCount>9?'9+':notificationCount}</span>}</button>
            <span className="f-date">{new Intl.DateTimeFormat('id-ID',{dateStyle:'full'}).format(new Date())}</span>
            <span className="f-title">{title}</span>
            {notifications && <div className="f-notification-panel"><div className="f-card-head"><div><h3>Notifikasi</h3><p>Prioritas yang perlu ditinjau.</p></div></div><Link href="/receivables" onClick={()=>setNotifications(false)} className="f-list-item"><span>Invoice overdue</span><strong>{notificationCount}</strong></Link><Link href="/expenses" onClick={()=>setNotifications(false)} className="f-list-item"><span>Biaya menunggu approval</span><strong>Lihat</strong></Link></div>}
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
function roleLabel(role:string){return role==='OWNER'?'Owner':role==='FINANCE'?'Finance':role==='SALES'?'Sales':'Viewer'}
