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
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [sentEmail, setSentEmail] = useState('')

  useEffect(() => {
    const fromQuery = String(query.get('accountId') || '').trim()
    const fallback = session?.role === 'student' ? String(session?.accountId || '').trim() : ''
    setAccountId(fromQuery || fallback)
  }, [query, session?.accountId, session?.role])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function onSendCode() {
    if (sending || cooldown > 0) return
    const id = String(accountId || '').trim()
    if (!id) return alert('请输入学号')
    setSending(true)
    try {
      const resp = await api.auth.sendResetPasswordCode({ role: 'student', accountId: id })
      setSentEmail(String(resp?.email || `${id}@ruc.edu.cn`))
      setCooldown(Number(resp?.resendAfterSeconds || 60))
      alert('验证码已发送，请查看学号对应邮箱')
    } catch (err) {
      if (err?.code === 'TOO_FREQUENT' && err?.waitSeconds) {
        setCooldown(Number(err.waitSeconds || 0))
      }
      alert(err?.message || '验证码发送失败')
    } finally {
      setSending(false)
    }
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (saving) return
    const id = String(accountId || '').trim()
    const resetCode = String(code || '').trim()
    if (!id) return alert('请输入学号')
    if (!/^\d{6}$/.test(resetCode)) return alert('请输入6位数字验证码')
    if (!newPassword) return alert('请输入新密码')
    if (newPassword.length < 6) return alert('新密码长度不能少于6位')
    if (newPassword !== confirmPassword) return alert('两次输入的新密码不一致')
    setSaving(true)
    try {
      await api.auth.resetPasswordByCode({
        role: 'student',
        accountId: id,
        code: resetCode,
        newPassword,
        confirmPassword,
      })
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
            系统会向学号对应邮箱发送验证码，邮箱地址规则为“学号@ruc.edu.cn”。
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
            <input
              id="reset-account"
              className="input"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-row">
            <button className="btn btn-secondary" type="button" disabled={sending || cooldown > 0} onClick={onSendCode}>
              {sending ? '发送中...' : cooldown > 0 ? `${cooldown}s 后重新发送` : '发送验证码'}
            </button>
            {sentEmail ? (
              <p className="section-note" style={{ marginTop: 8 }}>验证码已发送至 {sentEmail}，5 分钟内有效。</p>
            ) : null}
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="reset-code">验证码</label>
            <input
              id="reset-code"
              className="input"
              value={code}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="reset-password">新密码</label>
            <input
              id="reset-password"
              className="input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="reset-password-confirm">确认新密码</label>
            <input
              id="reset-password-confirm"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
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
