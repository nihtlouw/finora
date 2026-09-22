"use client"

import { useMemo, useState } from "react"

type Bucket={label:string;income:number;expense:number}
type Point={x:number;y:number}

export default function CashFlowChart({data}:{data:Bucket[]}){
 const [active,setActive]=useState<number|null>(null)
 const maxFlow=Math.max(1,...data.flatMap(b=>[b.income,b.expense]))
 const points=useMemo(()=>{
   const left=34,right=748,top=18,bottom=178
   const span=Math.max(1,data.length-1)
   const xFor=(i:number)=>left+((right-left)*i/span)
   const yFor=(v:number)=>bottom-(v/maxFlow)*(bottom-top)
   return {
     income:data.map((b,i)=>({x:xFor(i),y:yFor(b.income)})),
     expense:data.map((b,i)=>({x:xFor(i),y:yFor(b.expense)})),
     left,right,top,bottom
   }
 },[data,maxFlow])

 const polyline=(items:Point[])=>items.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
 const activateFromClientX=(clientX:number,rect:DOMRect)=>{
   if(!data.length)return
   const x=((clientX-rect.left)/rect.width)*760
   const ratio=Math.max(0,Math.min(1,(x-34)/(748-34)))
   setActive(Math.max(0,Math.min(data.length-1,Math.round(ratio*(data.length-1)))))
 }
 function handleMove(e:React.MouseEvent<SVGSVGElement>){
   activateFromClientX(e.clientX,e.currentTarget.getBoundingClientRect())
 }
 function handleTouch(e:React.TouchEvent<SVGSVGElement>){
   const touch=e.touches[0]
   if(touch)activateFromClientX(touch.clientX,e.currentTarget.getBoundingClientRect())
 }

 const selected=active===null?null:data[active]
 const selectedX=active===null?null:points.income[active].x
 const selectedNet=selected?selected.income-selected.expense:0

 return <div className="f-live-chart">
   <div className="f-chart-legend">
     <span><i className="f-chart-dot income"/>Masuk</span>
     <span><i className="f-chart-dot expense"/>Keluar</span>
     {selected&&<span className="f-chart-hover-hint">Menunjuk: <strong>{selected.label}</strong></span>}
   </div>
   <div className="f-chart-live-area">
     <svg
       className="f-chart-svg"
       viewBox="0 0 760 220"
       preserveAspectRatio="none"
       role="img"
       aria-label="Grafik arus kas 6 bulan"
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

       {data.map((b,i)=><text key={`axis-${i}`} x={points.income[i].x} y="208" textAnchor="middle" className={active===i?"f-chart-axis active":"f-chart-axis"}>{b.label}</text>)}
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

function formatMoney(value:number){
 return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value).replace("IDR","Rp")
}
