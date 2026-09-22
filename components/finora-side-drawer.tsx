'use client'

import { useEffect } from 'react'

export function SideDrawer({open,onClose,title,description,children,footer}:{open:boolean;onClose:()=>void;title:string;description?:string;children:React.ReactNode;footer?:React.ReactNode;className?:string}){
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
   <aside className={`f-drawer${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-label={title}>
     <div className="f-drawer-head">
       <div><div className="f-eyebrow">Workspace action</div><h2>{title}</h2>{description&&<p>{description}</p>}</div>
       <button type="button" className="f-icon" onClick={onClose} aria-label="Tutup">×</button>
     </div>
     <div className="f-drawer-body">{children}</div>
     {footer&&<div className="f-drawer-foot">{footer}</div>}
   </aside>
 </div>
}
