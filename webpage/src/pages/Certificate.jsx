import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Certificate() {
  const [templates, setTemplates] = useState([])
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState('')
  const [selectedTemplateMeta, setSelectedTemplateMeta] = useState('')
  const [manualFields, setManualFields] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    loadTemplates()
  }, [])

  function fieldLabel(key) {
    const k = String(key ?? '').trim()
    const map = {
      college: '学院',
      platoon: '连排',
      reason: '事由',
      proof: '证明材料',
      phone: '联系电话',
      teacher: '教师',
      place: '地点',
    }
    return map[k] || k || '字段'
  }

  function fieldPlaceholder(key) {
    const k = String(key ?? '').trim()
    const map = {
      college: '例如：信息学院',
      platoon: '例如：三连二排',
      reason: '例如：上课冲突、就医、比赛等',
      proof: '例如：门诊证明、比赛通知等',
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
      const session = api.auth.getSession()
      const admin = session?.role === 'admin'
      setIsAdmin(admin)
      const resp = await api.featureApi.certTemplateList()
      const items = Array.isArray(resp?.items) ? resp.items : []
      setTemplates(items)
      if (!admin && items.length) {
        const first = items[0]
        const id = String(first?.id || first?._id || '')
        const title = String(first?.title || '')
        const meta = `${String(first?.format || '').toUpperCase()}${first?.category ? ` / ${String(first.category)}` : ''}`
        setSelectedTemplateId(id)
        setSelectedTemplateTitle(title)
        setSelectedTemplateMeta(meta)
        if (id) await loadTemplateFields(id)
      }
    } catch (err) {
      alert(err?.message || '加载模板失败')
    }
  }

  async function loadTemplateFields(id) {
    const templateId = String(id ?? '').trim()
    if (!templateId) return
    try {
      const resp = await api.featureApi.certTemplateFields({ id: templateId })
      const keys = Array.isArray(resp?.manualFields) ? resp.manualFields : []
      setManualFields(
        keys.map((key) => ({
          key: String(key),
          label: fieldLabel(key),
          placeholder: fieldPlaceholder(key),
          multiline: isMultilineField(key),
          value: '',
        })),
      )
    } catch (err) {
      setManualFields([])
      alert(err?.message || '加载模板字段失败')
    }
  }

  function onChangeManualField(key, value) {
    const fieldKey = String(key ?? '')
    setManualFields((prev) =>
      Array.isArray(prev) ? prev.map((item) => (item.key === fieldKey ? { ...item, value: String(value ?? '') } : item)) : prev,
    )
  }

  function buildParamsFromManualFields() {
    const params = {}
    for (const field of manualFields) {
      const key = String(field?.key ?? '').trim()
      if (!key) continue
      params[key] = String(field?.value ?? '')
    }
    return params
  }

  function buildAuthHeader(session) {
    if (!session?.token) return {}
    return { Authorization: `Bearer ${session.token}` }
  }

  async function onUploadTemplate(event) {
    const file = (event.target.files || [])[0]
    if (!file || uploading) return
    setUploading(true)
    try {
      const reader = new FileReader()
      const fileBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
      const format = file.name.endsWith('.xlsx') ? 'xlsx' : file.name.endsWith('.txt') ? 'txt' : 'html'
      await api.featureApi.certAdminTemplateUpload({
        title: uploadTitle || file.name || '模板',
        category: uploadCategory || 'default',
        format,
        fileName: file.name || 'file',
        fileBase64,
      })
      alert('模板上传成功')
      await loadTemplates()
    } catch (err) {
      alert(err?.message || '模板上传失败')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function downloadBinary(url, filename) {
    const session = api.auth.getSession()
    try {
      const res = await fetch(url, { headers: buildAuthHeader(session) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `下载失败：${res.status}`)
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
    } catch (err) {
      alert(err?.message || '下载失败')
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
        throw new Error(text || `生成失败：${res.status}`)
      }
      const blob = await res.blob()
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf') && blob.type !== 'application/pdf') {
        const text = await new Response(blob).text().catch(() => '')
        throw new Error(text || '生成失败，返回内容不是 PDF')
      }
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    } catch (err) {
      alert(err?.message || `预览${title || '证书'}失败`)
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
        throw new Error(text || `下载失败：${res.status}`)
      }
      const blob = await res.blob()
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf') && blob.type !== 'application/pdf') {
        const text = await new Response(blob).text().catch(() => '')
        throw new Error(text || '下载失败，返回内容不是 PDF')
      }
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${(title || 'document').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      alert(err?.message || '下载 PDF 失败')
    }
  }

  async function onDeleteTemplate(id) {
    if (!id) return
    if (!confirm('确认删除该模板？')) return
    try {
      await api.featureApi.certAdminTemplateDelete({ id })
      alert('模板已删除')
      await loadTemplates()
    } catch (err) {
      alert(err?.message || '删除模板失败')
    }
  }

  async function onViewTemplate(id) {
    if (!id) return
    const url = api.featureApi.certTemplatePdfUrl(id, {})
    const full = `${api.getBaseUrl() || ''}${url}`
    const session = api.auth.getSession()
    try {
      const res = await fetch(full, { headers: buildAuthHeader(session) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `打开失败：${res.status}`)
      }
      const blob = await res.blob()
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf') && blob.type !== 'application/pdf') {
        const text = await new Response(blob).text().catch(() => '')
        throw new Error(text || '打开失败，返回内容不是 PDF')
      }
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    } catch (err) {
      alert(err?.message || '打开模板失败')
    }
  }

  return (
    <div className="container">
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn-secondary back-home-btn" type="button" onClick={() => nav('/')}>返回首页</button>
      </div>
      <h2>证书模板</h2>
      <div className="card">
        {isAdmin ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {templates.map((template) => (
              <li key={template._id || template.id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{template.title}</div>
                    <div style={{ color: '#6b7280' }}>
                      {template.category} / {template.format}
                      {template.format === 'xlsx' ? '（注意：部分环境下 xlsx 模板可能无法在线生成 PDF）' : ''}
                    </div>
                  </div>
                  <div>
                    <button className="btn" type="button" onClick={() => onViewTemplate(template.id || template._id)}>查看</button>
                    <button className="btn btn-danger" style={{ marginLeft: 8 }} type="button" onClick={() => onDeleteTemplate(template.id || template._id)}>删除</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ marginRight: 8 }}>
                模板：
                <select
                  value={selectedTemplateId}
                  onChange={async (event) => {
                    const id = String(event.target.value || '')
                    const template = templates.find((item) => String(item?.id || item?._id || '') === id)
                    setSelectedTemplateId(id)
                    setSelectedTemplateTitle(String(template?.title || ''))
                    setSelectedTemplateMeta(`${String(template?.format || '').toUpperCase()}${template?.category ? ` / ${String(template.category)}` : ''}`)
                    setManualFields([])
                    if (id) await loadTemplateFields(id)
                  }}
                >
                  <option value="">请选择模板</option>
                  {templates.map((template) => (
                    <option key={template._id || template.id} value={String(template.id || template._id || '')}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ marginLeft: 8, color: '#6b7280' }}>{selectedTemplateMeta}</span>
            </div>

            <div style={{ marginBottom: 8, color: '#6b7280' }}>系统会自动填充姓名、学号和日期等基础信息。</div>

            {!selectedTemplateId ? (
              <div style={{ color: '#6b7280' }}>请选择模板后填写需要手动补充的字段。</div>
            ) : manualFields.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {manualFields.map((field) => (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: '#374151', fontSize: 12 }}>{field.label}</span>
                    {field.multiline ? (
                      <textarea className="input" value={field.value} placeholder={field.placeholder} onChange={(event) => onChangeManualField(field.key, event.target.value)} />
                    ) : (
                      <input className="input" value={field.value} placeholder={field.placeholder} onChange={(event) => onChangeManualField(field.key, event.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ color: '#6b7280' }}>该模板无需手动填写字段。</div>
            )}

            <div style={{ marginTop: 12 }}>
              <button className="btn" type="button" disabled={!selectedTemplateId} onClick={() => onGeneratePdf(selectedTemplateId, selectedTemplateTitle)}>预览</button>
              <button className="btn" style={{ marginLeft: 8 }} type="button" disabled={!selectedTemplateId} onClick={() => onDownloadGeneratedPdf(selectedTemplateId, selectedTemplateTitle)}>下载 PDF</button>
              <button className="btn" style={{ marginLeft: 8 }} type="button" disabled={!selectedTemplateId} onClick={() => onDownloadTemplate(selectedTemplateId, selectedTemplateTitle)}>下载模板</button>
            </div>
          </div>
        )}

        {isAdmin ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label>
                模板标题：
                <input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="默认使用文件名" />
              </label>
              <label>
                分类：
                <input value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)} placeholder="可选" />
              </label>
            </div>
            <label className="btn">
              上传证书模板
              <input type="file" style={{ display: 'none' }} onChange={onUploadTemplate} />
            </label>
            <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
