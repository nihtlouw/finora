"use client"

import { useMemo, useState } from "react"

type Transaction={type:"income"|"expense";date:string;amount:number}
type Bucket={label:string;income:number;expense:number}
type Mode="daily"|"weekly"|"monthly"
type Point={x:number;y:number}

const modeMeta:Record<Mode,{label:string;range:string}>={
 daily:{label:"Harian",range:"14 hari terakhir"},
 weekly:{label:"Mingguan",range:"8 minggu terakhir"},
 monthly:{label:"Bulanan",range:"6 bulan terakhir"},
}

export default function CashFlowChart({transactions}:{transactions:Transaction[]}){
 const [mode,setMode]=useState<Mode>("monthly")
 const [active,setActive]=useState<number|null>(null)

 const buckets=useMemo(()=>buildBuckets(transactions,mode),[transactions,mode])
 const maxFlow=Math.max(1,...buckets.flatMap(b=>[b.income,b.expense]))
 const points=useMemo(()=>{
   const left=34,right=748,top=18,bottom=178
   const span=Math.max(1,buckets.length-1)
   const xFor=(i:number)=>left+((right-left)*i/span)
   const yFor=(v:number)=>bottom-(v/maxFlow)*(bottom-top)
   return {
     income:buckets.map((b,i)=>({x:xFor(i),y:yFor(b.income)})),
     expense:buckets.map((b,i)=>({x:xFor(i),y:yFor(b.expense)})),
     left,right,top,bottom
   }
 },[buckets,maxFlow])

 const polyline=(items:Point[])=>items.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
 const activateFromClientX=(clientX:number,rect:DOMRect)=>{
   if(!buckets.length)return
   const x=((clientX-rect.left)/rect.width)*760
   const ratio=Math.max(0,Math.min(1,(x-34)/(748-34)))
   setActive(Math.max(0,Math.min(buckets.length-1,Math.round(ratio*(buckets.length-1)))))
 }
 const handleMove=(e:React.MouseEvent<SVGSVGElement>)=>activateFromClientX(e.clientX,e.currentTarget.getBoundingClientRect())
 const handleTouch=(e:React.TouchEvent<SVGSVGElement>)=>{
   const touch=e.touches[0]
   if(touch)activateFromClientX(touch.clientX,e.currentTarget.getBoundingClientRect())
 }
 const selected=active===null?null:buckets[active]
 const selectedX=active===null?null:points.income[active].x
 const selectedNet=selected?selected.income-selected.expense:0

 return <div className="f-live-chart">
   <div className="f-chart-toolbar">
     <div className="f-chart-legend">
       <span><i className="f-chart-dot income"/>Masuk</span>
       <span><i className="f-chart-dot expense"/>Keluar</span>
       {selected&&<span className="f-chart-hover-hint">Menunjuk: <strong>{selected.label}</strong></span>}
     </div>
     <div className="f-chart-periods" role="group" aria-label="Periode grafik arus kas">
       {(Object.keys(modeMeta) as Mode[]).map(key=><button key={key} type="button" className={mode===key?"is-active":""} onClick={()=>{setMode(key);setActive(null)}}>{modeMeta[key].label}</button>)}
     </div>
   </div>

   <div className="f-chart-range-label">{modeMeta[mode].range}</div>

   <div className="f-chart-live-area">
     <svg
       className="f-chart-svg"
       viewBox="0 0 760 220"
       preserveAspectRatio="none"
       role="img"
       aria-label={`Grafik arus kas periode ${modeMeta[mode].label}`}
       onMouseMove={handleMove}
       onMouseLeave={()=>setActive(null)}
       onTouchStart={handleTouch}
       onTouchMove={handleTouch}
     >
       <line x1={points.left} y1="34" x2={points.right} y2="34" className="f-chart-grid"/>
       <line x1={points.left} y1="82" x2={points.right} y2="82" className="f-chart-grid"/>
       <line x1={points.left} y1="130" x2={points.right} y2="130" className="f-chart-grid"/>
       <line x1={points.left} y1={points.bottom} x2={points.right} y2={points.bottom} className="f-chart-grid"/>

       {active!==null&&selectedX!==null&&<line x1={selectedX} y1={points.top} x2={selectedX} y2={points.bottom} className="f-chart-crosshair"/>}

       <polyline points={polyline(points.income)} className="f-chart-line-income"/>
       <polyline points={polyline(points.expense)} className="f-chart-line-expense"/>

       {points.income.map((p,i)=><circle key={`income-${i}`} cx={p.x} cy={p.y} r={active===i?6:3.5} className={active===i?"f-chart-point-income active":"f-chart-point-income"}/>)}
       {points.expense.map((p,i)=><circle key={`expense-${i}`} cx={p.x} cy={p.y} r={active===i?5.5:3} className={active===i?"f-chart-point-expense active":"f-chart-point-expense"}/>)}
       {buckets.map((b,i)=><text key={`axis-${i}`} x={points.income[i].x} y="208" textAnchor="middle" className={active===i?"f-chart-axis active":"f-chart-axis"}>{b.label}</text>)}
     </svg>

     {selected&&<div className="f-chart-tooltip" style={{left:`${(selectedX!/760)*100}%`}}>
       <strong>{selected.label}</strong>
       <div><span className="f-tooltip-dot income"/>Masuk <b>{formatMoney(selected.income)}</b></div>
       <div><span className="f-tooltip-dot expense"/>Keluar <b>{formatMoney(selected.expense)}</b></div>
       <div className="net"><span>Net</span><b>{formatMoney(selectedNet)}</b></div>
     </div>}
   </div>
 </div>
}

function buildBuckets(transactions:Transaction[],mode:Mode):Bucket[]{
 const now=new Date()
 if(mode==="daily"){
   const days:number[]=[]
   for(let i=13;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push(d.getTime())}
   return days.map(ts=>{
     const d=new Date(ts)
     return {label:d.toLocaleDateString("id-ID",{day:"2-digit",month:"short"}),income:sumForDay(transactions,"income",d),expense:sumForDay(transactions,"expense",d)}
   })
 }
 if(mode==="weekly"){
   const starts:number[]=[]
   const anchor=startOfWeek(now)
   for(let i=7;i>=0;i--){const d=new Date(anchor);d.setDate(d.getDate()-i*7);starts.push(d.getTime())}
   return starts.map(ts=>{
     const d=new Date(ts)
     const end=new Date(d);end.setDate(end.getDate()+7)
     return {label:`${d.toLocaleDateString("id-ID",{day:"2-digit",month:"short"})}`,income:sumInRange(transactions,"income",d,end),expense:sumInRange(transactions,"expense",d,end)}
   })
 }
 const months:number[]=[]
 const first=new Date(now.getFullYear(),now.getMonth()-5,1)
 for(let i=0;i<6;i++)months.push(new Date(first.getFullYear(),first.getMonth()+i,1).getTime())
 return months.map(ts=>{
   const d=new Date(ts)
   const end=new Date(d.getFullYear(),d.getMonth()+1,1)
   return {label:d.toLocaleDateString("id-ID",{month:"short"}),income:sumInRange(transactions,"income",d,end),expense:sumInRange(transactions,"expense",d,end)}
 })
}

function normalizeDate(value:string|Date){
 const d=new Date(value)
 return new Date(d.getFullYear(),d.getMonth(),d.getDate())
}
function sumForDay(transactions:Transaction[],type:Transaction["type"],day:Date){
 const target=day.getTime()
 return transactions.filter(x=>x.type===type&&normalizeDate(x.date).getTime()===target).reduce((sum,x)=>sum+x.amount,0)
}
function sumInRange(transactions:Transaction[],type:Transaction["type"],start:Date,end:Date){
 const from=start.getTime(),to=end.getTime()
 return transactions.filter(x=>{
   if(x.type!==type)return false
   const ts=normalizeDate(x.date).getTime()
   return ts>=from&&ts<to
 }).reduce((sum,x)=>sum+x.amount,0)
}
function startOfWeek(date:Date){
 const d=new Date(date)
 d.setHours(0,0,0,0)
 const day=d.getDay()
 const diff=day===0?-6:1-day
 d.setDate(d.getDate()+diff)
 return d
}
function formatMoney(value:number){
 return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value).replace("IDR","Rp")
}
