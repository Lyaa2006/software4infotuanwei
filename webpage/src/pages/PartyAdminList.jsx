import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function PartyAdminList() {
  const [items, setItems] = useState([])
  const nav = useNavigate()

  useEffect(() => { load() }, [])
  async function load() { try { const r = await api.featureApi.partyAdminStudents(); setItems(r.items || []) } catch (e) {} }

  return (
    <div className="container">
      <h2>学生列表（管理员）</h2>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>共 {items.length} 位学生</div>
          <div>
            <button className="btn" onClick={() => {
              const v = prompt('请输入学生学号');
              if (!v) return;
              nav(`/party/admin/edit/${encodeURIComponent(String(v).trim())}`)
            }}>添加/编辑学生</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(i => (
            <div key={i.accountId} style={{ padding: 10, borderRadius: 8, background: '#fff' }}>
              <a style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => nav(`/party/admin/edit/${encodeURIComponent(i.accountId)}`)}>{i.accountId} {i.name || ''}</a>
              <div style={{ color: '#6b7280', marginTop: 6 }}>{i.tags ? `标签：${(i.tags||[]).join(',')}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
