import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function ResetPassword() {
  const { search } = useLocation()
  const query = useMemo(() => new URLSearchParams(search), [search])
  const nav = useNavigate()
  const session = api.auth.getSession()
  const fromProfile = query.get('mode') === 'self' && session?.role === 'student'

  const [accountId, setAccountId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fromQuery = String(query.get('accountId') || '').trim()
    const fallback = session?.role === 'student' ? String(session?.accountId || '').trim() : ''
    setAccountId(fromQuery || fallback)
  }, [query, session?.accountId, session?.role])

  async function onSubmit(event) {
    event.preventDefault()
    if (saving) return
    const id = String(accountId || '').trim()
    if (!id) return alert('请输入学号')
    if (!newPassword) return alert('请输入新密码')
    if (newPassword.length < 6) return alert('新密码长度不能少于 6 位')
    if (newPassword !== confirmPassword) return alert('两次输入的新密码不一致')
    setSaving(true)
    try {
      await api.auth.resetPassword({ role: 'student', accountId: id, newPassword, confirmPassword })
      api.auth.logout()
      alert('密码重置成功，请重新登录')
      nav('/login', { replace: true })
    } catch (err) {
      alert(err?.message || '密码重置失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell narrow">
      <header className="page-header">
        <div>
          <h1 className="page-title">重置密码</h1>
          <p className="page-subtitle">
            当前为网页端最简版本，暂未启用邮箱验证码。输入学号和两次新密码即可完成重置。
          </p>
        </div>
        {fromProfile ? (
          <div className="dashboard-user">
            <button className="btn btn-secondary back-home-btn" type="button" onClick={() => nav('/profile')}>返回个人主页</button>
            <button className="btn btn-secondary back-home-btn" type="button" onClick={() => nav('/')}>返回首页</button>
          </div>
        ) : null}
      </header>

      <section className="section-card">
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <label className="form-label" htmlFor="reset-account">学号</label>
            <input id="reset-account" className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)} autoComplete="username" />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="reset-password">新密码</label>
            <input id="reset-password" className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="reset-password-confirm">确认新密码</label>
            <input id="reset-password-confirm" className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn" type="submit" disabled={saving}>{saving ? '提交中...' : '确认重置密码'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => nav('/login')}>返回登录</button>
          </div>
        </form>
      </section>
    </main>
  )
}
