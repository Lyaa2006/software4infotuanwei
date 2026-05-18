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
    <div className="container">
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <h2>登录</h2>
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <label>角色</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="student">学生</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="form-row">
            <label>学工号 / 账号</label>
            <input className="input" value={accountId} onChange={e => setAccountId(e.target.value)} />
          </div>
          <div className="form-row">
            <label>密码</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="form-row">
            <button className="btn" type="submit" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
