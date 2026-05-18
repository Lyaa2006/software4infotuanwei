import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Honor() {
  const [users, setUsers] = useState([])
  const nav = useNavigate()

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const r = await api.featureApi.honorUsers()
      setUsers(r.items || [])
    } catch (e) {
      // ignore
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
      </div>
      <div className="card">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {users.map(u => (
            <li key={u.accountId || u._id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
              <a style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => nav(`/honor/${encodeURIComponent(u.accountId)}`)}>{u.name || u.accountId}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
