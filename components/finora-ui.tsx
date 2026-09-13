export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}) {
 return <div className="f-pagehead"><div><div className="f-eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>
}
export function StatCard({label,value,trend,icon}:{label:string;value:string|number;trend?:string;icon?:string}){
 return <div className="f-stat"><div className="f-stat-icon">{icon||'◉'}</div><div className="f-stat-body"><span>{label}</span><strong>{value}</strong>{trend&&<small>{trend}</small>}</div></div>
}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'blue'|'amber'|'red'|'neutral'}){
 return <span className={`f-badge ${tone}`}>{children}</span>
}
export function Card({children,className='' }:{children:React.ReactNode;className?:string}){ return <section className={`f-card ${className}`}>{children}</section> }
export const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n).replace('IDR','Rp')
