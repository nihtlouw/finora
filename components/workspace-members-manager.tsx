'use client'
import { useEffect, useState } from 'react'

import { Badge, Card, PageHeader } from '@/components/finora-ui'

type Member={id:string;role:string;user:{id:string;name:string|null;email:string;role:string}}

const roleLabel=(role:string)=>({OWNER:'Owner',FINANCE:'Finance',SALES:'Sales',VIEWER:'Viewer'} as Record<string,string>)[role]||role

export default function WorkspaceMembersManager(){
 const [members,setMembers]=useState<Member[]>([])
 const [email,setEmail]=useState('')
 const [role,setRole]=useState('VIEWER')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')

 async function load(){
  const r=await fetch('/api/workspace/members',{cache:'no-store'});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{}}catch{d={error:`Respons server tidak valid (${r.status}).`}}
  if(!r.ok)throw new Error(d.error||'Gagal memuat anggota workspace.')
  setMembers(d.members||[])
 }
 useEffect(()=>{load().catch(e=>setError(e.message))},[])

 async function addMember(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('')
  try{const r=await fetch('/api/workspace/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,role})});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{}}catch{d={error:`Respons server tidak valid (${r.status}).`}};if(!r.ok)throw new Error(d.error||'Gagal menambah anggota.');setEmail('');setRole('VIEWER');setMessage('Anggota berhasil ditambahkan.');await load()}catch(e){setError(e instanceof Error?e.message:'Gagal menambah anggota.')}finally{setBusy(false)}
 }

 async function changeRole(member:Member,nextRole:string){
  if(nextRole==='OWNER'){
   if(!confirm(`Transfer Owner ke ${member.user.name||member.user.email}? Anda akan menjadi Viewer.`))return
  }
  setBusy(true);setError('');setMessage('')
  try{const r=await fetch(`/api/workspace/members/${member.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:nextRole})});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{}}catch{d={error:`Respons server tidak valid (${r.status}).`}};if(!r.ok)throw new Error(d.error||'Gagal mengubah role.');if(nextRole==='OWNER'){window.location.href='/settings'}else{setMessage('Role berhasil diperbarui.');await load()}}catch(e){setError(e instanceof Error?e.message:'Gagal mengubah role.')}finally{setBusy(false)}
 }

 async function removeMember(member:Member){
  if(!confirm(`Keluarkan ${member.user.name||member.user.email} dari workspace?`))return
  setBusy(true);setError('');setMessage('')
  try{const r=await fetch(`/api/workspace/members/${member.id}`,{method:'DELETE'});const text=await r.text();let d:any={};try{d=text?JSON.parse(text):{}}catch{d={error:`Respons server tidak valid (${r.status}).`}};if(!r.ok)throw new Error(d.error||'Gagal mengeluarkan anggota.');setMessage('Anggota dikeluarkan dari workspace.');await load()}catch(e){setError(e instanceof Error?e.message:'Gagal mengeluarkan anggota.')}finally{setBusy(false)}
 }

 return <div className="f-content"><PageHeader eyebrow="Workspace" title="Anggota & Role" description="Kelola anggota workspace dan transfer ownership tanpa bergantung pada email sebagai sumber role."/>
  {(message||error)&&<div style={{marginBottom:12}}>{message&&<span className="f-badge green">{message}</span>}{error&&<span className="f-badge red" style={{marginLeft:8}}>{error}</span>}</div>}
  <div className="f-grid-2">
   <Card><div className="f-card-head"><div><h3>Tambah anggota</h3><p>User harus sudah login sekali ke Finora sebelum bisa ditambahkan.</p></div></div><form className="f-form" onSubmit={addMember}><label>Email anggota<input className="f-input" required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="finance@perusahaan.com"/></label><label>Role<select className="f-select" value={role} onChange={e=>setRole(e.target.value)}><option value="VIEWER">Viewer</option><option value="SALES">Sales</option><option value="FINANCE">Finance</option></select></label><button className="f-btn primary" disabled={busy}>{busy?'Memproses...':'Tambah Anggota'}</button></form></Card>
   <Card><div className="f-card-head"><div><h3>Aturan role</h3><p>Ownership dipindahkan dengan aksi khusus.</p></div></div><div className="f-list"><div className="f-list-item"><span>OWNER</span><strong>Kelola workspace & transfer ownership</strong></div><div className="f-list-item"><span>FINANCE</span><strong>Transaksi & kontrol keuangan</strong></div><div className="f-list-item"><span>SALES</span><strong>Klien, proposal, sales flow</strong></div><div className="f-list-item"><span>VIEWER</span><strong>Akses baca</strong></div></div></Card>
  </div>
  <div style={{height:16}}/>
  <Card><div className="f-card-head"><div><h3>Anggota workspace</h3><p>{members.length} anggota terdaftar.</p></div></div><div style={{overflowX:'auto'}}><table className="f-table"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td><strong>{m.user.name||m.user.email}</strong></td><td>{m.user.email}</td><td><Badge tone={m.role==='OWNER'?'green':m.role==='FINANCE'?'blue':m.role==='SALES'?'amber':'neutral'}>{roleLabel(m.role)}</Badge></td><td>{m.role==='OWNER'?<span className="f-badge neutral">Owner aktif</span>:<div style={{display:'flex',gap:6,flexWrap:'wrap'}}><select className="f-select" style={{width:140}} value={m.role} disabled={busy} onChange={e=>changeRole(m,e.target.value)}><option value="FINANCE">Finance</option><option value="SALES">Sales</option><option value="VIEWER">Viewer</option></select><button className="f-btn soft" disabled={busy} onClick={()=>changeRole(m,'OWNER')}>Transfer Owner</button><button className="f-btn" disabled={busy} onClick={()=>removeMember(m)}>Keluarkan</button></div>}</td></tr>)}</tbody></table></div></Card>
 </div>
}
