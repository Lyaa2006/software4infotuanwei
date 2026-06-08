import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'
const IMAGE_MAX_BYTES = 5 * 1024 * 1024

function isValidYmd(value) {
  const s = String(value ?? '').trim()
  if (!s) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

function localTodayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function validateImageFile(file) {
  if (!file) return '未选择图片文件'
  const type = String(file.type || '').toLowerCase()
  const name = String(file.name || '').toLowerCase()
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp']
  const typeOk = allowedTypes.has(type)
  const extOk = allowedExts.some((ext) => name.endsWith(ext))
  if (!typeOk && !extOk) return '仅支持 PNG、JPG、JPEG、WEBP 图片'
  if (Number(file.size || 0) <= 0) return '图片文件不能为空'
  if (Number(file.size || 0) > IMAGE_MAX_BYTES) return '图片不能超过 5MB'
  return ''
}

export default function HonorProfile() {
  const { accountId } = useParams()
  const navigate = useNavigate()
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
      const session = api.auth.getSession()
      const editable = session?.role === 'student' && String(session?.accountId) === String(accountId)
      const [r, me] = editable
        ? await Promise.all([
          api.featureApi.honorMyList(),
          api.featureApi.authMe().catch(() => null),
        ])
        : [await api.featureApi.honorUserDetail({ accountId }), null]
      const baseUrl = api.getBaseUrl() || ''
      const mapped = (r.items || []).map((x) => ({ ...x, imageUrl: x.imagePath ? `${baseUrl}${x.imagePath}` : '' }))
      setItems(mapped)
      const user = editable ? (me?.user || {}) : (r.user || {})
      const fallbackTitle = editable ? String(session?.accountId || accountId || '') : String(accountId || '')
      const nameText = String(user.name || '').trim() ? String(user.name || '').trim() : String(user.accountId || fallbackTitle || '')
      setUserTitle(nameText ? `${nameText} 的荣誉主页` : '')
      setIsEditable(editable)
    } catch (e) {}
  }

  async function onUploadImage(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    const invalid = validateImageFile(file)
    if (invalid) {
      alert(invalid)
      e.target.value = ''
      return
    }
    if (uploading) return
    setUploading(true)
    try {
      const parsed = await api.featureApi.honorMyUpload(file)
      alert('图片上传成功')
      setFormImagePath(parsed?.path || '')
      setImageUrl(parsed?.path ? `${api.getBaseUrl() || ''}${parsed.path}` : '')
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
    } catch (e) {
      alert(e?.message || '删除失败')
    }
  }

  async function onSave() {
    if (saving) return
    const title = String(formTitle || '').trim()
    if (!title) return alert('请填写荣誉名称')
    if (formHonorDate && !isValidYmd(formHonorDate)) return alert('日期格式错误或日期无效，应为真实的 YYYY-MM-DD')
    if (formHonorDate && formHonorDate > localTodayYmd()) return alert('荣誉日期不能设置为未来日期')
    setSaving(true)
    try {
      if (editingId) {
        await api.featureApi.honorMyUpdate({
          id: editingId,
          title,
          description: formDescription,
          issuer: formIssuer,
          honorDate: formHonorDate,
          imagePath: formImagePath,
          isPublic: formIsPublic,
        })
      } else {
        await api.featureApi.honorMyCreate({
          title,
          description: formDescription,
          issuer: formIssuer,
          honorDate: formHonorDate,
          imagePath: formImagePath,
          isPublic: formIsPublic,
        })
      }
      alert('已保存')
      onResetForm()
      await load()
    } catch (err) {
      const body = err?.body || ''
      alert((err?.message || '保存失败') + (body ? `\n服务器返回：${body}` : ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container">
      <div className="page-toolbar">
      <h2>{userTitle || `荣誉：${accountId}`}</h2>
        <button className="btn btn-secondary back-home-btn" type="button" onClick={() => navigate('/')}>返回首页</button>
      </div>
      <div className="card">
        {isEditable && (
          <div style={{ marginBottom: 12 }}>
            <h3>我的主页管理</h3>
            <div style={{ marginBottom: 8 }}>
              <input className="input" placeholder="荣誉名称" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <textarea className="input" placeholder="描述" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="颁发单位" value={formIssuer} onChange={(e) => setFormIssuer(e.target.value)} />
              <input className="input" placeholder="荣誉日期 YYYY-MM-DD" value={formHonorDate} onChange={(e) => setFormHonorDate(e.target.value)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="btn">{uploading ? '上传中...' : '上传荣誉图片'}<input type="file" accept={IMAGE_ACCEPT} style={{ display: 'none' }} onChange={onUploadImage} /></label>
              <button className="btn" style={{ marginLeft: 8, background: '#6b7280' }} onClick={() => { setFormImagePath(''); setImageUrl('') }} disabled={uploading || !formImagePath}>清除图片</button>
              <button className="btn" style={{ marginLeft: 8 }} onClick={onSave}>{saving ? '保存中...' : '保存'}</button>
              <button className="btn" style={{ marginLeft: 8, background: '#6b7280' }} onClick={onResetForm}>重置</button>
            </div>
            {imageUrl && <div style={{ marginTop: 8 }}><img src={imageUrl} alt="preview" style={{ maxWidth: 240 }} /></div>}
          </div>
        )}

        <h3>荣誉列表</h3>
        {!items.length && <p className="empty-state">{isEditable ? '你还没有添加荣誉记录。' : '暂无公开荣誉。'}</p>}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((i) => (
            <li key={i._id || i.id} style={{ padding: 10, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.title}</div>
                  <div style={{ color: '#6b7280' }}>{i.honorDate || i.honorDateText}</div>
                </div>
                <div>
                  {i.imageUrl && <img src={i.imageUrl} alt="honor" style={{ maxWidth: 120, marginLeft: 12 }} />}
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
