"use client"

import Link from "next/link"
import { SignOutButton, UserButton } from "@clerk/nextjs"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

type IconName = "dashboard"|"users"|"file"|"clipboard"|"folder"|"receipt"|"wallet"|"arrows"|"minus"|"coins"|"chart"|"settings"|"menu"|"search"|"bell"|"x"|"chevron"

const navGroups = [
  {label:"WORK",items:[
    {href:"/dashboard",label:"Dashboard",icon:"dashboard" as IconName},
    {href:"/clients",label:"Klien & Vendor",icon:"users" as IconName},
    {href:"/proposals",label:"Proposal",icon:"file" as IconName},
    {href:"/customer-pos",label:"PO Customer",icon:"clipboard" as IconName},
    {href:"/projects",label:"Project",icon:"folder" as IconName},
    {href:"/change-orders",label:"Change Orders",icon:"arrows" as IconName},
  ]},
  {label:"MONEY",items:[
    {href:"/invoices",label:"Invoice",icon:"receipt" as IconName},
    {href:"/receivables",label:"Piutang",icon:"wallet" as IconName},
    {href:"/payments",label:"Pembayaran",icon:"arrows" as IconName},
    {href:"/credit-notes",label:"Credit Note",icon:"minus" as IconName},
    {href:"/expenses",label:"Biaya",icon:"coins" as IconName},
    {href:"/cashflow",label:"Cash Flow",icon:"arrows" as IconName},
    {href:"/budgets",label:"Anggaran",icon:"chart" as IconName},
    {href:"/vendor-bills",label:"Vendor Bills",icon:"receipt" as IconName},
    {href:"/payroll",label:"Payroll",icon:"users" as IconName},
    {href:"/banks",label:"Bank",icon:"wallet" as IconName},
  ]},
  {label:"CONTROL",items:[
    {href:"/reports",label:"Laporan",icon:"chart" as IconName},
    {href:"/reconciliation",label:"Rekonsiliasi",icon:"arrows" as IconName},
    {href:"/periods",label:"Closing",icon:"file" as IconName},
    {href:"/employees",label:"Karyawan",icon:"users" as IconName},
  ]},
  {label:"ADMIN",items:[{href:"/settings",label:"Pengaturan",icon:"settings" as IconName}]},
]

function Icon({name,size=16}:{name:IconName;size?:number}){
  const c={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true}
  switch(name){
    case"dashboard":return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    case"users":return <svg {...c}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case"file":return <svg {...c}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>
    case"clipboard":return <svg {...c}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h5"/></svg>
    case"folder":return <svg {...c}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    case"receipt":return <svg {...c}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>
    case"wallet":return <svg {...c}><path d="M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h12M16 14h4"/></svg>
    case"arrows":return <svg {...c}><path d="M7 7h11l-3-3M17 17H6l3 3M18 7v4M6 13v4"/></svg>
    case"minus":return <svg {...c}><path d="M4 4h16v16H4zM8 12h8"/></svg>
    case"coins":return <svg {...c}><circle cx="9" cy="9" r="6"/><path d="M15 9h2a4 4 0 0 1 4 4v2a5 5 0 0 1-5 5H9a6 6 0 0 1-6-6v-2M9 6v6M6.5 8.5h5"/></svg>
    case"chart":return <svg {...c}><path d="M4 19V5M4 19h16"/><path d="M7 15l3-4 3 2 5-6"/></svg>
    case"settings":return <svg {...c}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.21a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.4 15 1.7 1.7 0 0 0 6.84 14H6.6v-2.4h.24A1.7 1.7 0 0 0 8.4 10a1.7 1.7 0 0 0-.34-1.87L8 8.07l1.7-1.7.06.06a1.7 1.7 0 0 0 1.87.34 1.7 1.7 0 0 0 1.03-1.56V5h2.4v.21a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l-.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 19.4 10c.31.63.93 1.03 1.64 1.03h.2v2.4h-.2A1.7 1.7 0 0 0 19.4 15Z"/></svg>
    case"menu":return <svg {...c}><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    case"search":return <svg {...c}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
    case"bell":return <svg {...c}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
    case"x":return <svg {...c}><path d="m6 6 12 12M18 6 6 18"/></svg>
    case"chevron":return <svg {...c}><path d="m9 18 6-6-6-6"/></svg>
  }
}

export default function FinoraShell({children,workspaceName="Workspace",role="VIEWER",title="Finora"}:{children:React.ReactNode;workspaceName?:string;role?:string;title?:string}){
  const pathname=usePathname(),router=useRouter()
  const[search,setSearch]=useState(""),[focused,setFocused]=useState(false),[notifications,setNotifications]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[notificationCount,setNotificationCount]=useState(0)
  const searchRef=useRef<HTMLInputElement>(null)
  const allowed=(href:string)=>!["/reconciliation","/receivables","/customer-pos","/projects","/change-orders","/credit-notes","/vendor-bills","/payroll","/banks","/periods","/employees"].includes(href)||["OWNER","FINANCE"].includes(role)
  const navItems=navGroups.flatMap(g=>g.items).filter(i=>allowed(i.href))

  useEffect(()=>{
    function onKeyDown(e:KeyboardEvent){
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}
      if(e.key==="Escape"){setFocused(false);setNotifications(false);setMobileOpen(false)}
    }
    window.addEventListener("keydown",onKeyDown)
    return()=>window.removeEventListener("keydown",onKeyDown)
  },[])
  useEffect(()=>{
    let cancelled=false
    Promise.all([fetch("/api/invoices"),fetch("/api/expenses")])
      .then(async([a,b])=>[await a.json(),await b.json()])
      .then(([a,b])=>{if(!cancelled)setNotificationCount((a.invoices||[]).filter((x:any)=>x.status==="OVERDUE").length+(b.expenses||[]).filter((x:any)=>x.status==="PENDING").length)})
      .catch(()=>{})
    return()=>{cancelled=true}
  },[pathname])
  useEffect(()=>{setMobileOpen(false)},[pathname])

  const matches=navItems.filter(i=>i.label.toLowerCase().includes(search.toLowerCase())||i.href.toLowerCase().includes(search.toLowerCase()))
  function submitSearch(e:React.FormEvent){
    e.preventDefault()
    const x=matches[0]
    if(x){router.push(x.href);setSearch("");setFocused(false)}
  }

  return <div className="f-app">
    <aside className={mobileOpen?"f-side is-open":"f-side"}>
      <div className="f-brand">
        <span className="f-brand-mark" aria-hidden="true"><i/><i/><i/></span>
        <div><b>Finora</b><small>FINANCIAL OPERATIONS</small></div>
        <button className="f-mobile-close" type="button" onClick={()=>setMobileOpen(false)} aria-label="Tutup menu"><Icon name="x" size={18}/></button>
      </div>

      <div className="f-workspace">
        <span className="f-work-avatar">{workspaceName.slice(0,2).toUpperCase()}</span>
        <div><small>WORKSPACE</small><strong>{workspaceName}</strong></div>
        <span className="f-work-caret">⌄</span>
      </div>

      <nav className="f-nav">
        {navGroups.map(g=>{
          const visible=g.items.filter(i=>allowed(i.href))
          if(!visible.length)return null
          return <div className="f-nav-group" key={g.label}>
            <div className="f-nav-group-label">{g.label}</div>
            {visible.map(i=>{
              const active=pathname===i.href||(i.href!=="/dashboard"&&pathname.startsWith(i.href))
              return <Link key={i.href} href={i.href} title={i.label} className={active?"f-nav-item active":"f-nav-item"}>
                <span className="f-nav-icon"><Icon name={i.icon}/></span>
                <span className="f-nav-label">{i.label}</span>
                {i.href==="/invoices"&&notificationCount>0&&<em>{notificationCount>9?"9+":notificationCount}</em>}
              </Link>
            })}
          </div>
        })}
      </nav>

      <div className="f-side-bottom">
        <div className="f-side-note"><span className="f-note-dot"/>Finance OS</div>
        <div className="f-user">
          <UserButton appearance={{elements:{userButtonAvatarBox:"f-user-avatar"}}}/>
          <div><strong>Profil</strong><small>{roleLabel(role)}</small></div>
          <SignOutButton><button type="button" className="f-user-logout">Keluar</button></SignOutButton>
        </div>
      </div>
    </aside>

    {mobileOpen&&<button className="f-mobile-scrim" aria-label="Tutup menu" onClick={()=>setMobileOpen(false)}/>}

    <main className="f-main">
      <header className="f-top">
        <div className="f-top-left">
          <button type="button" className="f-mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Buka menu"><Icon name="menu" size={18}/></button>
          <div className="f-breadcrumb"><span>Finora</span><b>/</b><strong>{title}</strong></div>
          <div className="f-search-wrap">
            <form className="f-top-search" onSubmit={submitSearch}>
              <span><Icon name="search" size={14}/></span>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setFocused(true)} placeholder="Cari halaman..." aria-label="Cari halaman Finora"/>
              <kbd>⌘ K</kbd>
            </form>
            {focused&&search&&<div className="f-search-results">
              {matches.length?matches.slice(0,6).map(i=><button type="button" key={i.href} onClick={()=>{router.push(i.href);setSearch("");setFocused(false)}}><span><Icon name={i.icon} size={15}/></span><div><strong>{i.label}</strong><small>{i.href}</small></div><Icon name="chevron" size={14}/></button>):<div className="f-search-empty">Tidak ada halaman yang cocok.</div>}
            </div>}
          </div>
        </div>

        <div className="f-top-right">
          <button type="button" className="f-icon" onClick={()=>setNotifications(v=>!v)} aria-label="Notifikasi"><Icon name="bell" size={16}/>{notificationCount>0&&<span className="f-notification-dot">{notificationCount>9?"9+":notificationCount}</span>}</button>
          <span className="f-date">{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium"}).format(new Date())}</span>
          <div className="f-top-user"><UserButton appearance={{elements:{userButtonAvatarBox:"f-top-avatar"}}/><span>{roleLabel(role)}</span></div>
          {notifications&&<div className="f-notification-panel">
            <div className="f-card-head"><div><h3>Notifikasi</h3><p>Prioritas yang perlu ditinjau.</p></div></div>
            <Link href="/receivables" onClick={()=>setNotifications(false)} className="f-list-item"><span>Invoice overdue</span><strong>{notificationCount}</strong></Link>
            <Link href="/expenses" onClick={()=>setNotifications(false)} className="f-list-item"><span>Biaya menunggu approval</span><strong>Lihat</strong></Link>
          </div>}
        </div>
      </header>
      {children}
    </main>
  </div>
}
function roleLabel(role:string){return role==="OWNER"?"Owner":role==="FINANCE"?"Finance":role==="SALES"?"Sales":"Viewer"}
