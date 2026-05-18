import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [plans, setPlans] = useState([])
  const nav = useNavigate()

  const features = [
    { key: 'policyQA', title: '智能政策问答' },
    { key: 'partyLeague', title: '党团事务流程管理' },
    { key: 'reminder', title: '信息提醒' },
    { key: 'certificate', title: '电子证明模板填充' },
    { key: 'academic', title: '学业情况分析' },
    { key: 'honor', title: '学生荣誉展示' },
    { key: 'activity', title: '班团活动管理' },
  ]

  useEffect(() => {
    const s = api.auth.getSession()
    setUser(s?.accountId ? { accountId: s.accountId, role: s.role } : null)
    loadPlans()
  }, [])

  async function loadPlans() {
    try {
      const resp = await api.featureApi.academicPlans()
      setPlans(resp.items || [])
    } catch (e) {
      // keep silent for scaffold
    }
  }

  function logout() {
    api.auth.logout()
    window.location.href = '/login'
  }

  function onTapFeature(key) {
    if (key === 'policyQA') return nav('/policy-qa')
    if (key === 'partyLeague') {
      const session = api.auth.getSession()
      if (session?.role === 'admin') return nav('/party/admin/list')
      return nav('/party/student')
    }
    if (key === 'reminder') return nav('/reminder')
    if (key === 'certificate') return nav('/certificate')
    if (key === 'honor') return nav('/honor')
    if (key === 'activity') return nav('/activity')
    if (key === 'academic') return nav('/academic')
    // fallback
    alert(`${key} 开发中`)
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>仪表盘</h1>
        <div>
          {user && <span style={{ marginRight: 12 }}>当前：{user.accountId} ({user.role})</span>}
          <button className="btn" onClick={logout}>登出</button>
        </div>
      </div>

      <div className="card">
        <h3>功能</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {features.map(f => (
            <button key={f.key} className="btn" style={{ minWidth: 160 }} onClick={() => onTapFeature(f.key)}>{f.title}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>学业计划（示例）</h3>
        {plans.length ? (
          <ul>
            {plans.map(p => <li key={p.id || p._id || p.name}>{p.name || p.title || JSON.stringify(p)}</li>)}
          </ul>
        ) : (
          <p className="muted">暂无计划（或后端未配置）</p>
        )}
      </div>
    </div>
  )
}
