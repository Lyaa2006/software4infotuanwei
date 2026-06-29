import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { collectAvailableTags, mapStudentTags, normalizeTagList } from '../utils/studentTags'
import { logFilteredNonStudentRecords, normalizeStudentRecords } from '../utils/studentAccounts'

const TARGET_ALL = 'all'
const TARGET_TAGS = 'tags'
const TARGET_BATCH = 'batch'
const SEND_SITE = 'site'
const SEND_EMAIL = 'email'

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

function mergeTargetTags(selectedTags, manualText) {
  return normalizeTagList([...normalizeTagList(selectedTags), ...normalizeTagList(manualText)])
}

function mapMessageItem(item) {
  const tags = normalizeTagList(item.targetTags)
  return {
    ...item,
    createdAtText: formatDateTime(item.createdAt),
    preview: buildPreview(item.content),
    targetTypeText: item.targetType === TARGET_TAGS ? '标签：' + (tags.join('、') || '-') : '全部学生',
  }
}

function mapMyReminderItem(item) {
  return {
    ...item,
    createdAtText: formatDateTime(item.createdAt),
    preview: buildPreview(item.content),
  }
}

export default function Reminder() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMessages, setAdminMessages] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formSendMethod, setFormSendMethod] = useState(SEND_SITE)
  const [formTargetType, setFormTargetType] = useState(TARGET_ALL)
  const [formTagsText, setFormTagsText] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [studentRows, setStudentRows] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')

  const targetTags = useMemo(() => {
    if (formTargetType !== TARGET_TAGS) return []
    return mergeTargetTags(selectedTags, formTagsText)
  }, [formTargetType, selectedTags, formTagsText])

  useEffect(() => { reloadAll() }, [])

  async function reloadAll() {
    try {
      await loadMyMessages()
      const s = api.auth.getSession()
      const admin = s?.role === 'admin'
      setIsAdmin(admin)
      if (admin) {
        await loadAdminMessages()
        await loadStudentTargetData()
      }
    } catch (e) {
      // Individual loaders already keep their own fallback state.
    }
  }

  async function loadMyMessages() {
    try {
      const r = await api.featureApi.reminderMyList()
      const list = Array.isArray(r.items) ? r.items : []
      setItems(list.map(mapMyReminderItem))
    } catch (e) {
      setItems([])
    }
  }

  async function loadAdminMessages() {
    try {
      const r = await api.featureApi.reminderAdminMessages()
      const list = Array.isArray(r.items) ? r.items : []
      setAdminMessages(list.map(mapMessageItem))
    } catch (e) {
      setAdminMessages([])
    }
  }

  async function loadStudentTargetData() {
    try {
      const r = await api.featureApi.reminderAdminStudents()
      logFilteredNonStudentRecords('reminder-tags', r.items)
      const studentRows = normalizeStudentRecords(r.items).map(mapStudentTags)
      setStudentRows(studentRows)
      setAvailableTags(collectAvailableTags(studentRows))
    } catch (e) {
      setStudentRows([])
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

  function resetForm(clearStatus = true) {
    setFormTitle('')
    setFormContent('')
    setFormSendMethod(SEND_SITE)
    setFormTargetType(TARGET_ALL)
    setFormTagsText('')
    setSelectedTags([])
    setSelectedAccounts([])
    if (clearStatus) setStatus('')
  }

  function changeSendMethod(method) {
    const nextMethod = method === SEND_EMAIL ? SEND_EMAIL : SEND_SITE
    setFormSendMethod(nextMethod)
    if (nextMethod === SEND_SITE && formTargetType === TARGET_BATCH) {
      changeTargetType(TARGET_ALL)
    }
  }

  function changeTargetType(type) {
    const nextType = type === TARGET_TAGS ? TARGET_TAGS : type === TARGET_BATCH ? TARGET_BATCH : TARGET_ALL
    setFormTargetType(nextType)
    if (nextType === TARGET_ALL) {
      setSelectedTags([])
      setFormTagsText('')
      setSelectedAccounts([])
    }
    if (nextType === TARGET_TAGS) {
      setSelectedAccounts([])
    }
    if (nextType === TARGET_BATCH) {
      setSelectedTags([])
      setFormTagsText('')
    }
  }

  function toggleTag(tag) {
    const clean = String(tag || '').trim()
    if (!clean) return
    setSelectedTags(prev => prev.includes(clean) ? prev.filter(x => x !== clean) : normalizeTagList([...prev, clean]))
  }

  function validateSendForm() {
    const title = String(formTitle || '').trim()
    const content = String(formContent || '').trim()
    if (!title) return { ok: false, message: '请填写通知标题' }
    if (!content) return { ok: false, message: '请填写通知内容' }
    if (formTargetType === TARGET_TAGS && !targetTags.length) return { ok: false, message: '请选择至少一个标签' }
    if (formSendMethod === SEND_SITE && formTargetType === TARGET_BATCH) return { ok: false, message: '站内发送不支持批量选择，请切换为邮件发送' }
    if (formSendMethod === SEND_EMAIL && formTargetType === TARGET_BATCH && !selectedAccounts.length) return { ok: false, message: '请选择至少一名学生' }
    return { ok: true, title, content }
  }

  function estimateTargetCount() {
    if (formTargetType === TARGET_ALL) return studentRows.length
    if (formTargetType === TARGET_BATCH) return selectedAccounts.length
    if (formTargetType === TARGET_TAGS) {
      const wanted = new Set(targetTags)
      return studentRows.filter(row => normalizeTagList(row.tags).some(tag => wanted.has(tag))).length
    }
    return 0
  }

  function buildSendPayload() {
    const checked = validateSendForm()
    if (!checked.ok) return checked
    return {
      ok: true,
      payload: {
        title: checked.title,
        content: checked.content,
        targetType: formTargetType,
        targetTags: formTargetType === TARGET_TAGS ? targetTags : [],
        targetAccounts: formTargetType === TARGET_BATCH ? selectedAccounts : [],
      },
    }
  }

  async function sendMessage() {
    if (sending) return
    const built = buildSendPayload()
    if (!built.ok) return alert(built.message)

    setSending(true)
    setStatus('')
    try {
      if (formSendMethod === SEND_EMAIL) {
        const count = estimateTargetCount()
        const confirmed = window.confirm(`确认通过邮件发送该通知？\n\n标题：${built.payload.title}\n预计收件人数：${count}\n\n邮件通知 5 分钟内仅允许发送一次。`)
        if (!confirmed) {
          setSending(false)
          return
        }
        const resp = await api.featureApi.reminderAdminSendEmail(built.payload)
        setStatus(`邮件已发送，成功 ${resp?.successCount || 0} 人，失败 ${resp?.failCount || 0} 人`)
      } else {
        await api.featureApi.reminderAdminSend(built.payload)
        setStatus('站内通知已发送')
      }
      resetForm(false)
      await loadAdminMessages()
      await loadMyMessages()
    } catch (e) {
      alert(e?.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  function renderMyMessages() {
    if (!items.length) return <p className='empty-state'>暂无通知。</p>
    return (
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
    )
  }

  function renderSendMethodSelector() {
    return (
      <div className='form-row'>
        <label>通知发送方式</label>
        <div className='target-option-group'>
          <label className={'target-option ' + (formSendMethod === SEND_SITE ? 'active' : '')}>
            <input type='radio' name='send-method' checked={formSendMethod === SEND_SITE} onChange={() => changeSendMethod(SEND_SITE)} />
            <span>网站内发送</span>
          </label>
          <label className={'target-option ' + (formSendMethod === SEND_EMAIL ? 'active' : '')}>
            <input type='radio' name='send-method' checked={formSendMethod === SEND_EMAIL} onChange={() => changeSendMethod(SEND_EMAIL)} />
            <span>邮件发送</span>
          </label>
        </div>
      </div>
    )
  }

  function renderTargetTypeSelector() {
    return (
      <div className='form-row'>
        <label>发送范围</label>
        <div className='target-option-group'>
          <label className={'target-option ' + (formTargetType === TARGET_ALL ? 'active' : '')}>
            <input type='radio' name='target' checked={formTargetType === TARGET_ALL} onChange={() => changeTargetType(TARGET_ALL)} />
            <span>发送给全部学生</span>
          </label>
          <label className={'target-option ' + (formTargetType === TARGET_TAGS ? 'active' : '')}>
            <input type='radio' name='target' checked={formTargetType === TARGET_TAGS} onChange={() => changeTargetType(TARGET_TAGS)} />
            <span>按标签发送</span>
          </label>
          {formSendMethod === SEND_EMAIL ? (
            <label className={'target-option ' + (formTargetType === TARGET_BATCH ? 'active' : '')}>
              <input type='radio' name='target' checked={formTargetType === TARGET_BATCH} onChange={() => changeTargetType(TARGET_BATCH)} />
              <span>批量选择</span>
            </label>
          ) : null}
        </div>
      </div>
    )
  }

  function toggleStudentAccount(accountId) {
    const id = String(accountId || '').trim()
    if (!id) return
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function renderBatchTargetPanel() {
    if (formSendMethod !== SEND_EMAIL || formTargetType !== TARGET_BATCH) return null
    return (
      <div className='tag-target-panel'>
        <div className='section-heading' style={{ marginBottom: 10 }}>
          <div>
            <div className='section-title'>选择收件学生</div>
            <div className='section-note'>已选择 {selectedAccounts.length} 人，邮件将发送至“学号@ruc.edu.cn”。</div>
          </div>
          <div className='inline-actions' style={{ marginTop: 0 }}>
            <button className='btn btn-secondary' type='button' onClick={() => setSelectedAccounts(studentRows.map(s => s.accountId).filter(Boolean))}>全选</button>
            <button className='btn btn-secondary' type='button' onClick={() => setSelectedAccounts([])}>清空</button>
          </div>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #dbe4ee', borderRadius: 12, background: '#fff' }}>
          {studentRows.length ? studentRows.map(student => {
            const accountId = String(student.accountId || '')
            return (
              <label key={accountId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input style={{ width: 'auto', minHeight: 'auto', marginTop: 3 }} type='checkbox' checked={selectedAccounts.includes(accountId)} onChange={() => toggleStudentAccount(accountId)} />
                <span>
                  <span style={{ display: 'block', fontWeight: 700 }}>{student.name || '未填写姓名'} · {accountId}</span>
                  <span className='section-note'>{normalizeTagList(student.tags).join('、') || '暂无标签'} · {accountId}@ruc.edu.cn</span>
                </span>
              </label>
            )
          }) : <div className='section-note' style={{ padding: 14 }}>暂无可选择学生。</div>}
        </div>
      </div>
    )
  }

  function renderTagTargetPanel() {
    if (formTargetType !== TARGET_TAGS) return null
    return (
      <div className='tag-target-panel'>
        <div className='section-note'>可用标签</div>
        <div className='tag-chip-list selectable'>
          {availableTags.length ? availableTags.map(tag => (
            <button key={tag} type='button' className={'tag-chip tag-choice ' + (selectedTags.includes(tag) ? 'selected' : '')} onClick={() => toggleTag(tag)}>{tag}</button>
          )) : <span className='section-note'>暂无可用标签，请先到学生标签管理维护标签。</span>}
        </div>
        <textarea rows={3} placeholder='也可以手动输入标签，支持逗号、中文逗号、顿号、空格或换行分隔' value={formTagsText} onChange={e => setFormTagsText(e.target.value)} />
        <div className='section-note' style={{ marginTop: 8 }}>本次将发送给：{targetTags.length ? targetTags.join('、') : '尚未选择标签'}</div>
      </div>
    )
  }

  function renderAdminMessages() {
    if (!adminMessages.length) return <p className='empty-state'>暂无历史通知。</p>
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {adminMessages.map(m => (
          <li key={m._id} style={{ padding: 8, borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ fontWeight: 600 }}>{m.title}</div>
            <div style={{ color: '#666', fontSize: 13 }}>{m.createdAtText} · {m.targetTypeText}</div>
            <div style={{ marginTop: 6 }}>{m.preview}</div>
          </li>
        ))}
      </ul>
    )
  }

  function renderAdminPanel() {
    if (!isAdmin) return null
    return (
      <div className='card' style={{ marginTop: 12 }}>
        <h3>管理员：发送通知</h3>
        <p className='section-note'>站内通知会进入学生网页端提醒列表；邮件通知会发送至学生邮箱，并受 5 分钟一次的发送限制。</p>
        {status ? <p className='section-note' style={{ color: '#16a34a' }}>{status}</p> : null}
        <div className='form-row'>
          <label>通知标题</label>
          <input placeholder='请输入通知标题' value={formTitle} onChange={e => setFormTitle(e.target.value)} />
        </div>
        <div className='form-row'>
          <label>通知内容</label>
          <textarea rows={6} placeholder='请输入通知内容' value={formContent} onChange={e => setFormContent(e.target.value)} />
        </div>

        {renderSendMethodSelector()}
        {renderTargetTypeSelector()}
        {renderTagTargetPanel()}
        {renderBatchTargetPanel()}

        <div className='inline-actions'>
          <button className='btn' type='button' onClick={sendMessage} disabled={sending}>{sending ? '发送中...' : '发送'}</button>
          <button className='btn btn-secondary' type='button' onClick={resetForm} disabled={sending}>重置</button>
        </div>

        <h4 style={{ marginTop: 18 }}>历史通知</h4>
        {renderAdminMessages()}
      </div>
    )
  }

  return (
    <div className='container'>
      <div className='page-toolbar'>
        <h2>提醒</h2>
        <button className='btn btn-secondary back-home-btn' type='button' onClick={() => navigate('/')}>返回首页</button>
      </div>

      <div className='card'>
        {renderMyMessages()}
      </div>

      {renderAdminPanel()}
    </div>
  )
}
