import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Login() {
  const [role, setRole] = useState('student')
  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      await api.auth.loginWithAccount({ role, accountId, password })
      navigate('/')
    } catch (err) {
      alert(err?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <div>
            <span className="badge green">信息学院</span>
            <h1>学生综合服务与党团管理平台</h1>
            <p>面向学生事务、党团管理与信息服务的一体化平台，支持学生自助办理与管理端审核维护。</p>
          </div>
          <div className="login-meta">
            <span className="badge">学生服务</span>
            <span className="badge amber">党团流程</span>
            <span className="badge green">学院通知</span>
          </div>
        </div>

        <div className="login-panel">
          <h2>账号登录</h2>
          <p className="page-subtitle">请选择身份并使用学工号或管理员账号进入系统。</p>

          <form onSubmit={onSubmit}>
            <div className="form-row">
              <label htmlFor="login-role">角色</label>
              <select id="login-role" className="input" value={role} onChange={e => setRole(e.target.value)}>
                <option value="student">学生</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="login-account">学工号 / 账号</label>
              <input
                id="login-account"
                className="input"
                value={accountId}
                autoComplete="username"
                onChange={e => setAccountId(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="login-password">密码</label>
              <input
                id="login-password"
                className="input"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button className="btn login-submit" type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
