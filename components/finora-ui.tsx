import InfoTip from '@/components/info-tip'

export function PageHeader({eyebrow,title,description,action,helpText}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode;helpText?:string}) {
 return <div className="f-pagehead"><div className="f-pagehead-main"><div className="f-eyebrow">{eyebrow}</div><div className="f-page-title-row"><h1>{title}</h1>{(helpText||description)&&<InfoTip text={helpText||description!} label={`Tentang halaman ${title}`}/>}</div>{description&&<p>{description}</p>}</div>{action&&<div className="f-page-actions">{action}</div>}</div>
}
export function StatCard({label,value,trend,icon}:{label:string;value:string|number;trend?:string;icon?:string}){
 return <div className="f-stat"><div className="f-stat-icon"><MetricIcon name={icon}/></div><div className="f-stat-body"><span>{label}</span><strong>{value}</strong>{trend&&<small>{trend}</small>}</div></div>
}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'blue'|'amber'|'red'|'neutral'}){
 return <span className={`f-badge ${tone}`}>{children}</span>
}
export function Card({children,className='',id}:{children:React.ReactNode;className?:string;id?:string}){ return <section id={id} className={`f-card ${className}`}>{children}</section> }
export const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n).replace('IDR','Rp')
