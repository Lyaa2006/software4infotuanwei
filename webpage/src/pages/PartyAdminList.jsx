import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { formatStudentDisplayName, logFilteredNonStudentRecords, normalizeStudentRecords } from '../utils/studentAccounts'

export default function PartyAdminList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const nav = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    if (loading) return
    setLoading(true)
    setErrorText('')
    try {
      const r = await api.featureApi.partyAdminStudents()
      logFilteredNonStudentRecords('party-admin-list', r.items)
      setItems(normalizeStudentRecords(r.items))
    } catch (e) {
      setItems([])
      setErrorText(e?.message || '加载党团学生列表失败')
    } finally {
      setLoading(false)
    }
  }

  function openStudentEditor(accountId) {
    const clean = String(accountId || '').trim()
    if (!clean) return
    nav(`/party/admin/edit/${encodeURIComponent(clean)}`)
  }

  function promptAndOpenEditor() {
    const v = prompt('请输入学生学号')
    if (!v) return
    openStudentEditor(v)
  }

  function renderStudentItem(item) {
    return (
      <div key={item.accountId} style={{ padding: 10, borderRadius: 8, background: '#fff' }}>
        <a style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => openStudentEditor(item.accountId)}>{formatStudentDisplayName(item)}</a>
        <div style={{ color: '#6b7280', marginTop: 6 }}>{item.tags ? `标签：${(item.tags || []).join(',')}` : ''}</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-toolbar">
      <h2>学生列表（管理员）</h2>
        <button className="btn btn-secondary back-home-btn" type="button" onClick={() => nav('/')}>返回首页</button>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>{loading ? '正在加载...' : `共 ${items.length} 位学生`}</div>
          <div>
            <button className="btn btn-secondary" type="button" onClick={load} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={promptAndOpenEditor}>添加/编辑学生</button>
          </div>
        </div>
        {errorText ? <p className="empty-state">{errorText}</p> : null}
        {!loading && !items.length && !errorText ? <p className="empty-state">暂无可管理学生。请确认学生账号已在权限清单中启用。</p> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(renderStudentItem)}
        </div>
      </div>
    </div>
  )
}
