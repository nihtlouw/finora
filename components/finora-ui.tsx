import { useEffect } from 'react'
import InfoTip from '@/components/info-tip'

function MetricIcon({name}:{name?:string}){
 const key=String(name||'').toLowerCase()
 const common={width:19,height:19,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true}
 if(key==='↗'||key.includes('income')||key.includes('cash-in')) return <svg {...common}><path d="M5 17 17 5"/><path d="M8 5h9v9"/></svg>
 if(key==='↘'||key.includes('expense')||key.includes('cash-out')) return <svg {...common}><path d="M5 7 17 19"/><path d="M17 11v8h-8"/></svg>
 if(key==='◫'||key.includes('receivable')) return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M8 16h8"/></svg>
 if(key==='◎'||key.includes('profit')||key.includes('net')) return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M9 12h6M12 9v6"/></svg>
 if(key==='▤'||key.includes('project')||key.includes('po')) return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
 if(key==='✓'||key.includes('verified')) return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.3 2.3 4.7-5"/></svg>
 if(key==='!'||key.includes('pending')) return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/></svg>
 if(key==='rp'||key.includes('value')||key.includes('currency')) return <svg {...common}><path d="M7 4v16M7 4h6a4 4 0 0 1 0 8H7M7 12h7a4 4 0 0 1 0 8H7"/></svg>
 return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/></svg>
}

export function PageHeader({eyebrow,title,description,action,helpText,showInfoTip=true}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode;helpText?:string;showInfoTip?:boolean}) {
 return <div className="f-pagehead"><div className="f-pagehead-main"><div className="f-eyebrow">{eyebrow}</div><div className="f-page-title-row"><h1>{title}</h1>{showInfoTip&&(helpText||description)&&<InfoTip text={helpText||description!} label={'Tentang halaman '+title}/>}</div>{description&&<p>{description}</p>}</div>{action&&<div className="f-page-actions">{action}</div>}</div>
}
export function StatCard({label,value,trend,icon}:{label:string;value:string|number;trend?:string;icon?:string}){
 return <div className="f-stat"><div className="f-stat-icon"><MetricIcon name={icon}/></div><div className="f-stat-body"><span>{label}</span><strong>{value}</strong>{trend&&<small>{trend}</small>}</div></div>
}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'blue'|'amber'|'red'|'neutral'}){
 return <span className={'f-badge '+tone}>{children}</span>
}
export function Card({children,className='',id}:{children:React.ReactNode;className?:string;id?:string}){ return <section id={id} className={'f-card '+className}>{children}</section> }

export function SideDrawer({open,onClose,title,description,children,footer}:{open:boolean;onClose:()=>void;title:string;description?:string;children:React.ReactNode;footer?:React.ReactNode}){
 useEffect(()=>{
   if(!open)return
   const onKeyDown=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
   const previousOverflow=document.body.style.overflow
   document.body.style.overflow='hidden'
   window.addEventListener('keydown',onKeyDown)
   return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',onKeyDown)}
 },[open,onClose])
 if(!open)return null
 return <div className="f-drawer-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
   <aside className="f-drawer" role="dialog" aria-modal="true" aria-label={title}>
     <div className="f-drawer-head"><div><div className="f-eyebrow">Workspace action</div><h2>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="f-icon" onClick={onClose} aria-label="Tutup">×</button></div>
     <div className="f-drawer-body">{children}</div>
     {footer&&<div className="f-drawer-foot">{footer}</div>}
   </aside>
 </div>
}

export const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n).replace('IDR','Rp')
