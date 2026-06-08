import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function StudentProfile() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState({ name: '', accountId: '', role: '' })

  useEffect(() => { load() }, [])

  async function load() {
    if (loading) return
    setLoading(true)
    try {
      const resp = await api.featureApi.authMe()
      const user = resp?.user || {}
      setProfile({
        name: String(user.name || ''),
        accountId: String(user.accountId || ''),
        role: String(user.role || ''),
      })
    } catch (e) {
      alert(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const nameText = String(profile.name || '').trim() || '未填写'
  const accountText = String(profile.accountId || '').trim() || '-'

  return (
    <main className="page-shell narrow">
      <header className="page-header">
        <div>
          <h1 className="page-title">个人主页</h1>
          <p className="page-subtitle">查看基础身份信息，并进行密码重置。</p>
        </div>
      </header>

      <section className="section-card">
        <div className="section-heading">
          <h2 className="section-title">基本信息</h2>
        </div>
        <div className="form-row">
          <label className="form-label">姓名</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>{nameText}</div>
        </div>
        <div className="form-row">
          <label className="form-label">学号</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>{accountText}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => nav(`/reset-password?accountId=${encodeURIComponent(accountText)}&mode=self`)}>重置密码</button>
          <button className="btn btn-secondary" type="button" onClick={() => nav('/')}>返回首页</button>
        </div>
      </section>
    </main>
  )
}
