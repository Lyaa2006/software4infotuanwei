import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Honor() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const r = await api.featureApi.honorUsers()
      const items = Array.isArray(r?.items) ? r.items : []
      setUsers(items)
    } catch (e) {
      setUsers([])
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  function goMyProfile() {
    const s = api.auth.getSession()
    if (!s?.accountId) return alert('请先登录')
    nav(`/honor/${encodeURIComponent(s.accountId)}`)
  }

  return (
    <div className="container">
      <h2>荣誉</h2>
      <div style={{ marginBottom: 12 }}>
        <button className="btn" onClick={goMyProfile}>我的主页</button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={loadUsers}>{loading ? '加载中...' : '刷新公开主页'}</button>
      </div>
      <div className="card">
        {!!error && <p className="empty-state" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</p>}
        {!error && !users.length && <p className="empty-state">暂无可见的公开荣誉主页。请确认其他同学至少发布 1 条公开荣誉。</p>}
        {!!users.length && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {users.map(u => (
              <li key={u.accountId || u._id} style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{u.name || u.accountId}</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>
                      {u.accountId ? `学号：${u.accountId}` : ''}
                      {u.publicCount != null ? ` · 公开荣誉：${u.publicCount}` : ''}
                    </div>
                  </div>
                  <button className="btn" onClick={() => nav(`/honor/${encodeURIComponent(u.accountId)}`)}>查看主页</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
