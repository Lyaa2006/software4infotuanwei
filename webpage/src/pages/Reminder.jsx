import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { collectAvailableTags, mapStudentTags, normalizeTagList } from '../utils/studentTags'
import { filterStudentAccountRecords } from '../utils/studentAccounts'

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
  return y + '-' + m + '-' + day + ' ' + hh + ':' + mm
}

function buildPreview(content) {
  const s = String(content ?? '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  return s.length > 80 ? s.slice(0, 80) + '...' : s
}

export default function Reminder() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMessages, setAdminMessages] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTargetType, setFormTargetType] = useState('all')
  const [formTagsText, setFormTagsText] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [sending, setSending] = useState(false)

  const targetTags = useMemo(() => {
    if (formTargetType !== 'tags') return []
    return normalizeTagList([...selectedTags, ...normalizeTagList(formTagsText)])
  }, [formTargetType, selectedTags, formTagsText])

  useEffect(() => { reloadAll() }, [])

  async function reloadAll() {
    try {
      await load()
      const s = api.auth.getSession()
      const admin = s?.role === 'admin'
      setIsAdmin(admin)
      if (admin) {
        await loadAdminMessages()
        await loadAvailableTags()
      }
    } catch (e) {}
  }

  async function load() {
    try {
      const r = await api.featureApi.reminderMyList()
      const list = Array.isArray(r.items) ? r.items : []
      setItems(list.map(x => ({ ...x, createdAtText: formatDateTime(x.createdAt), preview: buildPreview(x.content) })))
    } catch (e) {
      setItems([])
    }
  }

  async function loadAdminMessages() {
    try {
      const r = await api.featureApi.reminderAdminMessages()
      const list = Array.isArray(r.items) ? r.items : []
      const mapped = list.map(x => {
        const tags = normalizeTagList(x.targetTags)
        return {
          ...x,
          createdAtText: formatDateTime(x.createdAt),
          preview: buildPreview(x.content),
          targetTypeText: x.targetType === 'tags' ? '标签：' + (tags.join('、') || '-') : '全部学生',
        }
      })
      setAdminMessages(mapped)
    } catch (e) {
      setAdminMessages([])
    }
  }

  async function loadAvailableTags() {
    try {
      const r = await api.featureApi.reminderAdminStudents()
      const list = filterStudentAccountRecords(r.items)
      setAvailableTags(collectAvailableTags(list.map(mapStudentTags)))
    } catch (e) {
      setAvailableTags([])
    }
  }

  async function onTapItem(id) {
    const found = (items || []).find(x => String(x._id) === String(id))
    if (!found) return
    window.alert((found.title || '通知') + '\n\n' + (found.createdAtText || '') + '\n\n' + (found.content || ''))
    if (!found.readAt) {
      try {
        await api.featureApi.reminderMyMarkRead({ id: found._id })
        setItems((items || []).map(x => String(x._id) === String(found._id) ? { ...x, readAt: Date.now() } : x))
      } catch (e) {}
    }
  }

  function onFormReset() {
    setFormTitle('')
    setFormContent('')
    setFormTargetType('all')
    setFormTagsText('')
    setSelectedTags([])
  }

  function onTargetTypeChange(type) {
    setFormTargetType(type)
  }

  function onToggleTag(tag) {
    const clean = String(tag || '').trim()
    if (!clean) return
    setSelectedTags(prev => prev.includes(clean) ? prev.filter(x => x !== clean) : normalizeTagList([...prev, clean]))
  }

  async function onSend() {
    if (sending) return
    const title = String(formTitle || '').trim()
    const content = String(formContent || '').trim()
    if (!title) return alert('请填写通知标题')
    if (!content) return alert('请填写通知内容')
    const tags = formTargetType === 'tags' ? targetTags : []
    if (formTargetType === 'tags' && !tags.length) return alert('请选择至少一个标签')
    setSending(true)
    try {
      await api.featureApi.reminderAdminSend({ title, content, targetType: formTargetType, targetTags: tags })
      alert('已发送')
      onFormReset()
      await loadAdminMessages()
      await load()
    } catch (e) {
      alert(e?.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='container'>
      <div className='page-toolbar'>
        <h2>提醒</h2>
        <button className='btn btn-secondary back-home-btn' type='button' onClick={() => navigate('/')}>返回首页</button>
      </div>

      <div className='card'>
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

      {isAdmin && <div className='card' style={{ marginTop: 12 }}>
        <h3>管理员：发送通知</h3>
        <div className='form-row'>
          <label>通知标题</label>
          <input placeholder='请输入通知标题' value={formTitle} onChange={e => setFormTitle(e.target.value)} />
        </div>
        <div className='form-row'>
          <label>通知内容</label>
          <textarea rows={6} placeholder='请输入通知内容' value={formContent} onChange={e => setFormContent(e.target.value)} />
        </div>

        <div className='form-row'>
          <label>发送范围</label>
          <div className='target-option-group'>
            <label className={'target-option ' + (formTargetType === 'all' ? 'active' : '')}>
              <input type='radio' name='target' checked={formTargetType === 'all'} onChange={() => onTargetTypeChange('all')} />
              <span>发送给全部学生</span>
            </label>
            <label className={'target-option ' + (formTargetType === 'tags' ? 'active' : '')}>
              <input type='radio' name='target' checked={formTargetType === 'tags'} onChange={() => onTargetTypeChange('tags')} />
              <span>按标签发送</span>
            </label>
          </div>
        </div>

        {formTargetType === 'tags' && <div className='tag-target-panel'>
          <div className='section-note'>可用标签</div>
          <div className='tag-chip-list selectable'>
            {availableTags.length ? availableTags.map(tag => (
              <button key={tag} type='button' className={'tag-chip tag-choice ' + (selectedTags.includes(tag) ? 'selected' : '')} onClick={() => onToggleTag(tag)}>{tag}</button>
            )) : <span className='section-note'>暂无可用标签，请先到学生标签管理维护。</span>}
          </div>
          <textarea rows={3} placeholder='也可以手动输入标签，支持逗号、中文逗号、顿号、空格或换行分隔' value={formTagsText} onChange={e => setFormTagsText(e.target.value)} />
          <div className='section-note' style={{ marginTop: 8 }}>本次将发送给：{targetTags.length ? targetTags.join('、') : '尚未选择标签'}</div>
        </div>}

        <div className='inline-actions'>
          <button className='btn' type='button' onClick={onSend} disabled={sending}>{sending ? '发送中...' : '发送'}</button>
          <button className='btn btn-secondary' type='button' onClick={onFormReset} disabled={sending}>重置</button>
        </div>

        <h4 style={{ marginTop: 18 }}>历史通知</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {adminMessages.map(m => (
            <li key={m._id} style={{ padding: 8, borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <div style={{ color: '#666', fontSize: 13 }}>{m.createdAtText} · {m.targetTypeText}</div>
              <div style={{ marginTop: 6 }}>{m.preview}</div>
            </li>
          ))}
        </ul>
      </div>}
    </div>
  )
}
