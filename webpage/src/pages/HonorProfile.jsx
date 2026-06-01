import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'

export default function HonorProfile() {
  const { accountId } = useParams()
  const [items, setItems] = useState([])
  const [userTitle, setUserTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isEditable, setIsEditable] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIssuer, setFormIssuer] = useState('')
  const [formHonorDate, setFormHonorDate] = useState('')
  const [formIsPublic, setFormIsPublic] = useState(true)
  const [formImagePath, setFormImagePath] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [accountId])

  async function load() {
    try {
      const r = await api.featureApi.honorUserDetail({ accountId })
      const baseUrl = api.getBaseUrl() || ''
      const mapped = (r.items || []).map(x => ({ ...x, imageUrl: x.imagePath ? `${baseUrl}${x.imagePath}` : '' }))
      setItems(mapped)
      const user = r.user || {}
      const nameText = String(user.name || '').trim() ? String(user.name || '').trim() : String(user.accountId || accountId || '')
      setUserTitle(nameText ? `${nameText} 的荣誉主页` : '')
      const session = api.auth.getSession()
      setIsEditable(session?.role === 'student' && String(session?.accountId) === String(accountId))
    } catch (e) {}
  }

  async function onUploadImage(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    const uploadDisabled = true
    if (uploadDisabled) {
      alert('开发中，敬请期待')
      e.target.value = ''
      return
    }
    if (uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const session = api.auth.getSession()
      const url = `${api.getBaseUrl() || ''}/api/honor/me/upload`
      const opts = { method: 'POST', headers: {}, body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts)
      const text = await res.text()
      const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '上传失败')
      const parsed = obj
      alert('图片上传成功')
      setFormImagePath(parsed.data?.path || '')
      setImageUrl(parsed.data?.path ? `${api.getBaseUrl() || ''}${parsed.data?.path}` : '')
      await load()
    } catch (err) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function onEdit(item) {
    setEditingId(item._id || '')
    setFormTitle(item.title || '')
    setFormDescription(item.description || '')
    setFormIssuer(item.issuer || '')
    setFormHonorDate(item.honorDate || '')
    setFormIsPublic(!!item.isPublic)
    setFormImagePath(item.imagePath || '')
    setImageUrl(item.imageUrl || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onResetForm() {
    setEditingId('')
    setFormTitle('')
    setFormDescription('')
    setFormIssuer('')
    setFormHonorDate('')
    setFormIsPublic(true)
    setFormImagePath('')
    setImageUrl('')
  }

  async function onDelete(item) {
    if (!item || !item._id) return
    if (!confirm('删除后不可恢复，确定删除吗？')) return
    try {
      await api.featureApi.honorMyDelete({ id: item._id })
      alert('已删除')
      if (String(editingId) === String(item._id)) onResetForm()
      await load()
    } catch (e) { alert(e?.message || '删除失败') }
  }

  async function onSave() {
    if (saving) return
    const title = String(formTitle || '').trim()
    if (!title) return alert('请填写荣誉名称')
    // validate honorDate format if provided
    if (formHonorDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(formHonorDate))) return alert('日期格式应为 YYYY-MM-DD')
    setSaving(true)
    try {
      if (editingId) {
        await api.featureApi.honorMyUpdate({ id: editingId, title, description: formDescription, issuer: formIssuer, honorDate: formHonorDate, imagePath: formImagePath, isPublic: formIsPublic })
      } else {
        await api.featureApi.honorMyCreate({ title, description: formDescription, issuer: formIssuer, honorDate: formHonorDate, imagePath: formImagePath, isPublic: formIsPublic })
      }
      alert('已保存')
      onResetForm()
      await load()
    } catch (err) {
      // prefer detailed server body when available
      const body = err?.body || ''
      alert((err?.message || '保存失败') + (body ? `\n服务器返回：${body}` : ''))
    } finally { setSaving(false) }
  }

  return (
    <div className="container">
      <h2>{userTitle || `荣誉：${accountId}`}</h2>
      <div className="card">
        {isEditable && (
          <div style={{ marginBottom: 12 }}>
            <h3>我的主页管理</h3>
            <div style={{ marginBottom: 8 }}>
              <input className="input" placeholder="荣誉名称" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <textarea className="input" placeholder="描述" value={formDescription} onChange={e => setFormDescription(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="颁发单位" value={formIssuer} onChange={e => setFormIssuer(e.target.value)} />
              <input className="input" placeholder="荣誉日期 YYYY-MM-DD" value={formHonorDate} onChange={e => setFormHonorDate(e.target.value)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="btn">上传荣誉图片<input type="file" style={{ display: 'none' }} onChange={onUploadImage} /></label>
              <button className="btn" style={{ marginLeft: 8 }} onClick={onSave}>{saving ? '保存中...' : '保存'}</button>
              <button className="btn" style={{ marginLeft: 8, background: '#6b7280' }} onClick={onResetForm}>重置</button>
            </div>
            {imageUrl && <div style={{ marginTop: 8 }}><img src={imageUrl} alt="preview" style={{ maxWidth: 240 }} /></div>}
          </div>
        )}

        <h3>荣誉列表</h3>
        {!items.length && <p className="empty-state">暂无公开荣誉。</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map(i => (
            <li key={i._id || i.id} style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.title}</div>
                  <div style={{ color: '#6b7280' }}>{i.honorDate || i.honorDateText}</div>
                </div>
                <div>
                  {i.imageUrl && <img src={i.imageUrl} alt="i" style={{ maxWidth: 120, marginLeft: 12 }} />}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>{i.description}</div>
              {isEditable && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => onEdit(i)}>编辑</button>
                  <button className="btn" style={{ marginLeft: 8, background: '#ef4444' }} onClick={() => onDelete(i)}>删除</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
