import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Certificate() {
  const featureDisabled = false
  const [templates, setTemplates] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState('')
  const [selectedTemplateMeta, setSelectedTemplateMeta] = useState('')
  const [manualFields, setManualFields] = useState([])
  const nav = useNavigate()

  // feature flag is enabled; render real UI and load templates

  useEffect(() => {
    if (featureDisabled) return
    loadTemplates()
  }, [])

  function fieldLabel(key) {
    const k = String(key ?? '').trim()
    const map = {
      college: '学院',
      platoon: '连排',
      reason: '事由',
      proof: '证明',
      phone: '联系电话',
      teacher: '老师',
      place: '地点',
    }
    return map[k] || k || '字段'
  }

  function fieldPlaceholder(key) {
    const k = String(key ?? '').trim()
    const map = {
      college: '例如：信息工程学院',
      platoon: '例如：三连二排',
      reason: '例如：上课冲突/生病/比赛等',
      proof: '例如：附门诊证明/比赛通知等',
      phone: '例如：13800000000',
      teacher: '例如：张老师',
      place: '例如：教一-101',
    }
    return map[k] || `请输入${fieldLabel(k)}`
  }

  function isMultilineField(key) {
    const k = String(key ?? '').trim()
    return k === 'reason' || k === 'proof' || k.endsWith('Text') || k.endsWith('Desc') || k.endsWith('Note')
  }

  async function loadTemplates() {
    try {
      const s = api.auth.getSession()
      const admin = s?.role === 'admin'
      setIsAdmin(admin)
      const r = await api.featureApi.certTemplateList()
      const items = r.items || []
      setTemplates(items)
      if (!admin && items.length) {
        const first = items[0]
        const id = String(first?.id || first?._id || '')
        const title = String(first?.title || '')
        const meta = `${String(first?.format || '').toUpperCase()}${first?.category ? ` · ${String(first.category)}` : ''}`
        setSelectedTemplateId(id)
        setSelectedTemplateTitle(title)
        setSelectedTemplateMeta(meta)
        if (id) await loadTemplateFields(id)
      }
    } catch (e) {}
  }

  async function loadTemplateFields(id) {
    const i = String(id ?? '').trim()
    if (!i) return
    try {
      const r = await api.featureApi.certTemplateFields({ id: i })
      const keys = Array.isArray(r.manualFields) ? r.manualFields : []
      setManualFields(keys.map((k) => ({
        key: String(k),
        label: fieldLabel(k),
        placeholder: fieldPlaceholder(k),
        multiline: isMultilineField(k),
        value: '',
      })))
    } catch (e) {
      setManualFields([])
    }
  }

  function onChangeManualField(key, value) {
    const k = String(key ?? '')
    const v = String(value ?? '')
    setManualFields((prev) => (Array.isArray(prev) ? prev.map((f) => (f.key === k ? { ...f, value: v } : f)) : prev))
  }

  function buildParamsFromManualFields() {
    const params = {}
    for (const f of manualFields || []) {
      const k = String(f?.key ?? '').trim()
      if (!k) continue
      params[k] = String(f?.value ?? '')
    }
    return params
  }

  async function onUploadTemplate(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (uploading) return
    setUploading(true)
    try {
      // read as base64 to support the API that accepts base64 content
      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
      const format = file.name.endsWith('.xlsx') ? 'xlsx' : file.name.endsWith('.txt') ? 'txt' : 'html'
      const title = uploadTitle || file.name || '模板'
      const category = uploadCategory || 'default'
      await api.featureApi.certAdminTemplateUpload({ title, category, format, fileName: file.name || 'file', fileBase64: base64 })
      alert('模板上传成功')
      await loadTemplates()
    } catch (err) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function buildAuthHeader(session) {
    if (!session?.token) return {}
    return { Authorization: `Bearer ${session.token}` }
  }

  async function downloadBinary(url, filename) {
    const session = api.auth.getSession()
    try {
      const res = await fetch(url, { headers: buildAuthHeader(session) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `下载失败（${res.status}）`)
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename || 'file'
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      alert(e?.message || '下载失败')
    }
  }

  async function onDownloadTemplate(id, title) {
    if (!id) return
    const url = api.featureApi.certTemplateFileDownloadUrl(id)
    const full = `${api.getBaseUrl() || ''}${url}`
    await downloadBinary(full, title || `template_${id}`)
  }

  async function onGeneratePdf(id, title) {
    if (!id) return
    const params = buildParamsFromManualFields()
    const url = api.featureApi.certTemplatePdfUrl(id, params)
    const full = `${api.getBaseUrl() || ''}${url}`
    const session = api.auth.getSession()
    try {
      const res = await fetch(full, { headers: buildAuthHeader(session) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `生成失败（${res.status}）`)
      }
      const blob = await res.blob()
      // basic check for PDF mime
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf') && blob.type !== 'application/pdf') {
        const text = await (new Response(blob)).text().catch(() => '')
        const msg = text || '生成失败（返回内容不是 PDF）'
        throw new Error(msg)
      }
      const blobUrl = URL.createObjectURL(blob)
      // preview in a new tab
      window.open(blobUrl, '_blank')
      // don't revoke immediately to allow browser to load
    } catch (e) {
      alert(e?.message || '生成失败')
    }
  }

  async function onDownloadGeneratedPdf(id, title) {
    if (!id) return
    const params = buildParamsFromManualFields()
    const url = api.featureApi.certTemplatePdfUrl(id, params)
    const full = `${api.getBaseUrl() || ''}${url}`
    const session = api.auth.getSession()
    try {
      const res = await fetch(full, { headers: buildAuthHeader(session) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `下载失败（${res.status}）`)
      }
      const blob = await res.blob()
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf') && blob.type !== 'application/pdf') {
        const text = await (new Response(blob)).text().catch(() => '')
        const msg = text || '下载失败（返回内容不是 PDF）'
        throw new Error(msg)
      }
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${(title || 'document').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      alert(e?.message || '下载失败')
    }
  }

  async function onDeleteTemplate(id) {
    if (!id) return
    if (!confirm('确认删除该模板？')) return
    try {
      await api.featureApi.certAdminTemplateDelete({ id })
      alert('已删除')
      await loadTemplates()
    } catch (e) {
      alert(e?.message || '删除失败')
    }
  }

  async function onViewTemplate(id) {
    // For admin: preview generated PDF without filled fields
    if (!id) return
    const params = {}
    const url = api.featureApi.certTemplatePdfUrl(id, params)
    const full = `${api.getBaseUrl() || ''}${url}`
    const session = api.auth.getSession()
    try {
      const res = await fetch(full, { headers: buildAuthHeader(session) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `加载失败（${res.status}）`)
      }
      const blob = await res.blob()
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf') && blob.type !== 'application/pdf') {
        const text = await (new Response(blob)).text().catch(() => '')
        const msg = text || '加载失败（返回内容不是 PDF）'
        throw new Error(msg)
      }
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    } catch (e) {
      alert(e?.message || '打开失败')
    }
  }

  // Render the certificate template UI (feature enabled)

  return (
    <div className="container">
      <h2>证书模板</h2>
      <div className="card">
        {isAdmin ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {templates.map((t) => (
              <li key={t._id || t.id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div style={{ color: '#6b7280' }}>{t.category} · {t.format}{t.format === 'xlsx' ? '（注意：xlsx 模板在部分环境下可能无法在线生成 PDF）' : ''}</div>
                  </div>
                  <div>
                    <button className="btn" onClick={() => onViewTemplate(t.id || t._id)}>查看</button>
                    <button className="btn btn-danger" style={{ marginLeft: 8 }} onClick={() => onDeleteTemplate(t.id || t._id)}>删除</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ marginRight: 8 }}>模板：
                <select
                  value={selectedTemplateId}
                  onChange={async (e) => {
                    const id = String(e.target.value || '')
                    const t = templates.find(x => String(x?.id || x?._id || '') === id)
                    setSelectedTemplateId(id)
                    setSelectedTemplateTitle(String(t?.title || ''))
                    setSelectedTemplateMeta(`${String(t?.format || '').toUpperCase()}${t?.category ? ` · ${String(t.category)}` : ''}`)
                    setManualFields([])
                    if (id) await loadTemplateFields(id)
                  }}
                >
                  <option value="">请选择模板</option>
                  {templates.map(t => (
                    <option key={t._id || t.id} value={String(t.id || t._id || '')}>{t.title}</option>
                  ))}
                </select>
              </label>
              <span style={{ marginLeft: 8, color: '#6b7280' }}>{selectedTemplateMeta}</span>
            </div>

            <div style={{ marginBottom: 8, color: '#6b7280' }}>系统会自动填充：姓名、学号、日期</div>

            {!selectedTemplateId ? (
              <div style={{ color: '#6b7280' }}>请选择模板后填写需要手动补充的字段</div>
            ) : manualFields.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {manualFields.map((f) => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: '#374151', fontSize: 12 }}>{f.label}</span>
                    {f.multiline ? (
                      <textarea className="input" value={f.value} placeholder={f.placeholder} onChange={(e) => onChangeManualField(f.key, e.target.value)} />
                    ) : (
                      <input className="input" value={f.value} placeholder={f.placeholder} onChange={(e) => onChangeManualField(f.key, e.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>该模板无需手动填写字段</div>
            )}

            <div style={{ marginTop: 12 }}>
              <button className="btn" disabled={!selectedTemplateId} onClick={() => onGeneratePdf(selectedTemplateId, selectedTemplateTitle)}>预览</button>
              <button className="btn" style={{ marginLeft: 8 }} disabled={!selectedTemplateId} onClick={() => onDownloadGeneratedPdf(selectedTemplateId, selectedTemplateTitle)}>下载 PDF</button>
              <button className="btn" style={{ marginLeft: 8 }} disabled={!selectedTemplateId} onClick={() => onDownloadTemplate(selectedTemplateId, selectedTemplateTitle)}>下载模板</button>
            </div>
          </div>
        )}

        {isAdmin ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ marginRight: 8 }}>模板标题：<input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="模板标题（默认使用文件名）" /></label>
              <label>分类：<input value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} placeholder="分类（可选）" /></label>
            </div>
            <label className="btn">上传证书模板<input type="file" style={{ display: 'none' }} onChange={onUploadTemplate} /></label>
            <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
