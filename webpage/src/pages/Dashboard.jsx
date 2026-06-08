import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const featureGroups = [
  {
    title: '常用服务',
    items: [
      { key: 'policyQA', title: '智能政策问答', desc: '快速检索奖助、评优、党团等常见政策问题。' },
      { key: 'reminder', title: '学院公告与提醒', desc: '查看学院通知，管理员可按学生标签发送消息。' },
    ],
  },
  {
    title: '党团与证明',
    items: [
      { key: 'partyLeague', title: '党团事务流程管理', desc: '学生查看发展进度，管理员维护阶段与提醒。' },
      { key: 'certificate', title: '电子证明模板填充', desc: '按模板生成证明文件，支持管理员维护模板。' },
    ],
  },
  {
    title: '学业与荣誉',
    items: [
      { key: 'academic', title: '学业情况分析', desc: '对照培养方案查看完成情况和课程建议。' },
      { key: 'honor', title: '学生荣誉展示', desc: '展示公开荣誉，学生可维护个人荣誉主页。' },
    ],
  },
  {
    title: '班团与管理',
    items: [
      { key: 'activity', title: '班团活动管理', desc: '提交活动、上传照片，管理员进行活动审核。' },
      { key: 'tagManagement', title: '学生标签管理', desc: '集中维护学生标签，供通知精准发送使用。' },
    ],
  },
]

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [plans, setPlans] = useState([])
  const nav = useNavigate()

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
      // ignore
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
    if (key === 'tagManagement') return nav('/tag-management')
    if (key === 'academic') return nav('/academic')
    alert(`${key} 开发中`)
  }

  function onOpenProfile() {
    const session = api.auth.getSession()
    if (session?.role === 'student') nav('/profile')
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">信息学院学生综合服务与党团管理平台</h1>
          <p className="page-subtitle">集中处理学生服务、党团流程、证明材料、学业分析和学院通知。</p>
        </div>
        <div className="dashboard-user">
          {user && user.role === 'student' && (
            <button className="badge" type="button" onClick={onOpenProfile}>
              学生 · {user.accountId}
            </button>
          )}
          {user && user.role !== 'student' && (
            <span className="badge">{user.accountId} · {user.role === 'admin' ? '管理员' : '学生'}</span>
          )}
          <button className="btn btn-secondary" onClick={logout}>退出登录</button>
        </div>
      </header>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">功能入口</h2>
            <p className="section-note">按使用场景分组，保留现有入口和跳转路径。</p>
          </div>
        </div>

        <div className="action-grid">
          {featureGroups.map((group) => (
            <div className="feature-group" key={group.title}>
              <h3 className="feature-group-title">{group.title}</h3>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className="feature-card"
                  type="button"
                  onClick={() => onTapFeature(item.key)}
                >
                  <span>
                    <span className="feature-title">{item.title}</span>
                    <span className="feature-desc">{item.desc}</span>
                  </span>
                  <span className="feature-arrow">进入</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <h2 className="section-title">学业计划概览</h2>
            <p className="section-note">用于快速确认后端是否已返回培养方案数据。</p>
          </div>
        </div>

        {plans.length ? (
          <ul className="plan-list">
            {plans.map((p) => <li key={p.id || p._id || p.name}>{p.name || p.title || JSON.stringify(p)}</li>)}
          </ul>
        ) : (
          <p className="empty-state">暂无学业计划数据，可能是后端未配置或当前账号暂无可见方案。</p>
        )}
      </section>
    </main>
  )
}
