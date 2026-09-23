'use client'

import { useEffect, useState } from 'react'
import { Badge, Card, PageHeader } from '@/components/finora-ui'

type Log = { id: string; action: string; entityType: string; entityId?: string | null; createdAt: string; actor: { name: string | null; email: string; role: string } }

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<Log[]>([])
  const [error, setError] = useState('')
  useEffect(() => { fetch('/api/audit').then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error||'Gagal memuat audit log.'); setLogs(d.logs||[]) }).catch(e => setError(e.message)) }, [])
  return <div className="f-content"><PageHeader eyebrow="Security" title="Audit Log" description="Riwayat perubahan data finance yang dicatat untuk workspace ini."/>{error&&<span className="f-badge red">{error}</span>}<div style={{height:16}}/><Card><div style={{overflowX:'auto'}}><table className="f-table f-audit-table"><thead><tr><th>Waktu</th><th>Actor</th><th>Aksi</th><th>Entitas</th><th>ID</th></tr></thead><tbody>{logs.map(log=><tr key={log.id}><td>{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(log.createdAt))}</td><td><strong>{log.actor.name||log.actor.email}</strong><div className="f-muted" style={{fontSize:10}}>{log.actor.role}</div></td><td><Badge tone={log.action.includes('DELETE')||log.action==='ARCHIVE'?'red':log.action==='APPROVE'?'green':'blue'}>{log.action}</Badge></td><td>{log.entityType}</td><td className="f-muted">{log.entityId||'—'}</td></tr>)}</tbody></table></div>{!logs.length&&!error&&<div className="f-empty"><strong>Belum ada aktivitas audit</strong>Perubahan finance akan muncul di sini setelah transaksi digunakan.</div>}</Card></div>
}
