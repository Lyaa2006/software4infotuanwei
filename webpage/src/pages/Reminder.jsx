import React, { useEffect, useState } from 'react'
import api from '../services/api'

function pad2(n) { return String(n).padStart(2, '0') }
function formatDateTime(ts) {
  const n = Number(ts || 0)
  if (!n) return ''
  const d = new Date(n)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function buildPreview(content) {
  const s = String(content ?? '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  return s.length > 80 ? `${s.slice(0, 80)}...` : s
}

export default function Reminder() {
  const [items, setItems] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)

  // admin states
  const [adminMessages, setAdminMessages] = useState([])
  const [adminStudents, setAdminStudents] = useState([])
  const [availableTagsText, setAvailableTagsText] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTargetType, setFormTargetType] = useState('all')
  const [formTagsText, setFormTagsText] = useState('')
  const [sending, setSending] = useState(false)

  // edit tags
  const [editingAccountId, setEditingAccountId] = useState('')
  const [editingNameText, setEditingNameText] = useState('')
  const [editingTagsText, setEditingTagsText] = useState('')
  const [savingTags, setSavingTags] = useState(false)

  useEffect(() => { reloadAll() }, [])

  async function reloadAll() {
    try {
      await load()
      const s = api.auth.getSession()
      const admin = s?.role === 'admin'
      setIsAdmin(admin)
      if (admin) {
        await loadAdminMessages(); await loadAdminStudents()
      }
    } catch (e) {}
  }

  async function load() {
    try {
      const r = await api.featureApi.reminderMyList()
      const list = Array.isArray(r.items) ? r.items : []
      const mapped = list.map(x => ({ ...x, createdAtText: formatDateTime(x.createdAt), preview: buildPreview(x.content) }))
      setItems(mapped)
    } catch (e) {
      // ignore
    }
  }

  async function loadAdminMessages() {
    try {
      const r = await api.featureApi.reminderAdminMessages()
      const list = Array.isArray(r.items) ? r.items : []
      const mapped = list.map(x => ({ ...x, createdAtText: formatDateTime(x.createdAt), preview: buildPreview(x.content), targetTypeText: x.targetType === 'tags' ? `标签：${(x.targetTags||[]).join('、')||'-'}` : '全部学生' }))
      setAdminMessages(mapped)
    } catch (e) {}
  }

  async function loadAdminStudents() {
    try {
      const r = await api.featureApi.reminderAdminStudents()
      const list = Array.isArray(r.items) ? r.items : []
      const mapped = list.map(x => { const tags = Array.isArray(x.tags) ? x.tags : []; return { ...x, tagsText: tags.length?`标签：${tags.join('、')}`:'标签：-', tagsTextRaw: tags.join(',') } })
      const tagSet = new Set(); for (const s of mapped) { const tags = Array.isArray(s.tags) ? s.tags : []; for (const t of tags) tagSet.add(String(t)) }
      setAdminStudents(mapped)
      setAvailableTagsText(Array.from(tagSet).slice(0,30).join('、'))
    } catch (e) {}
  }

  async function onTapItem(id) {
    const found = (items || []).find(x => String(x._id) === String(id))
    if (!found) return
    // show details
    window.alert(`${found.title || '通知'}\n\n${found.createdAtText || ''}\n\n${found.content || ''}`)

    if (!found.readAt) {
      try {
        await api.featureApi.reminderMyMarkRead({ id: found._id })
        const next = (items || []).map(x => {
          if (String(x._id) !== String(found._id)) return x
          return { ...x, readAt: Date.now() }
        })
        setItems(next)
      } catch (e) {
        // ignore mark-read errors
      }
    }
  }

  function parseTagsText(text) {
    const raw = String(text ?? '')
    const parts = raw.split(/[,，\n\r\t ]+/).map(x => String(x).trim())
    const out = []
    const seen = new Set()
    for (const p of parts) {
      if (!p) continue
      if (seen.has(p)) continue
      seen.add(p)
      out.push(p)
    }
    return out
  }

  function onFormReset() { setFormTitle(''); setFormContent(''); setFormTargetType('all'); setFormTagsText('') }

  async function onSend() {
    if (sending) return
    setSending(true)
    try {
      const targetTags = formTargetType === 'tags' ? parseTagsText(formTagsText) : []
      await api.featureApi.reminderAdminSend({ title: formTitle, content: formContent, targetType: formTargetType, targetTags })
      alert('已发送')
      onFormReset()
      await loadAdminMessages(); await load()
    } catch (e) { alert(e?.message || '发送失败') } finally { setSending(false) }
  }

  function onEditTags(accountId, name, tagsText) { setEditingAccountId(accountId); setEditingNameText(name?`${accountId}（${name}）`:accountId); setEditingTagsText(tagsText) }

  function onCancelEditTags() { setEditingAccountId(''); setEditingNameText(''); setEditingTagsText('') }

  async function onSaveEditTags() {
    if (savingTags) return
    const accountId = String(editingAccountId || '')
    if (!accountId) return
    setSavingTags(true)
    try {
      const tags = parseTagsText(editingTagsText)
      await api.featureApi.reminderAdminStudentTagsSave({ accountId, tags })
      alert('已保存')
      onCancelEditTags()
      await loadAdminStudents()
    } catch (e) { alert(e?.message || '保存失败') } finally { setSavingTags(false) }
  }

  return (
    <div className="container">
      <h2>提醒</h2>
      <div className="card">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map(i => (
            <li key={i._id} style={{ padding: 10, borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onClick={() => onTapItem(i._id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: i.readAt ? 400 : 700 }}>{i.title || '(无标题)'}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{i.createdAtText || ''}</div>
              </div>
              <div style={{ color: '#6b7280', marginTop: 6 }}>{i.preview}</div>
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && <div className="card" style={{ marginTop: 12 }}>
        <h3>管理员：发送通知</h3>
        <div>
          <div><input placeholder="标题" value={formTitle} onChange={e=>setFormTitle(e.target.value)} style={{ width: '100%' }} /></div>
          <div style={{ marginTop: 8 }}><textarea rows={6} style={{ width: '100%' }} placeholder='内容' value={formContent} onChange={e=>setFormContent(e.target.value)} /></div>
          <div style={{ marginTop: 8 }}>
            <label><input type="radio" name="target" checked={formTargetType==='all'} onChange={()=>setFormTargetType('all')} /> 发送给全部</label>
            <label style={{ marginLeft: 12 }}><input type="radio" name="target" checked={formTargetType==='tags'} onChange={()=>setFormTargetType('tags')} /> 发送给标签</label>
          </div>
          {formTargetType === 'tags' && <div style={{ marginTop: 8 }}>
            <input placeholder='标签，逗号或换行分隔' value={formTagsText} onChange={e=>setFormTagsText(e.target.value)} style={{ width: '100%' }} />
            <div style={{ color: '#888', marginTop: 6 }}>可用标签：{availableTagsText || '-'}</div>
          </div>}
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={onSend}>{sending ? '发送中...' : '发送'}</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={onFormReset}>重置</button>
          </div>
        </div>

        <h4 style={{ marginTop: 12 }}>历史通知</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {adminMessages.map(m => (
            <li key={m._id} style={{ padding: 8, borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <div style={{ color: '#666', fontSize: 13 }}>{m.createdAtText} · {m.targetTypeText}</div>
              <div style={{ marginTop: 6 }}>{m.preview}</div>
            </li>
          ))}
        </ul>

        <h4 style={{ marginTop: 12 }}>学生及标签管理</h4>
        <div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {adminStudents.map(s => (
              <li key={s.accountId} style={{ padding: 8, borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>{s.accountId} {s.name ? `(${s.name})` : ''} <small style={{ color: '#666', marginLeft: 8 }}>{s.tagsText}</small></div>
                  <div><button className="btn" onClick={()=>onEditTags(s.accountId, s.name, s.tagsTextRaw)}>编辑标签</button></div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {editingAccountId ? <div style={{ marginTop: 12, padding: 8, border: '1px solid #eee' }}>
          <div>编辑学生标签：{editingNameText}</div>
          <div style={{ marginTop: 8 }}><input style={{ width: '100%' }} value={editingTagsText} onChange={e=>setEditingTagsText(e.target.value)} placeholder='用逗号或换行分隔' /></div>
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={onSaveEditTags}>{savingTags ? '保存中...' : '保存'}</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={onCancelEditTags}>取消</button>
          </div>
        </div> : null}
      </div>}
    </div>
  )
}
