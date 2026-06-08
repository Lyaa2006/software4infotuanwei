import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const COLLEGE_OPTIONS = ['信息学院']
const ACADEMY_OPTIONS = ['明理书院']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function localTodayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function isValidYmd(value) {
  const text = String(value ?? '').trim()
  if (!text) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeFieldToken(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase()
}

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
    date: '日期',
    count: '人数',
    academy: '所属书院',
    subject: '活动主题',
    summary: '概述',
    serialNo: '序号',
  }
  return map[k] || k || '字段'
}

function fieldPlaceholder(key, config) {
  if (config.options?.length) return '请选择'
  const k = String(key ?? '').trim()
  const map = {
    college: '例如：信息学院',
    platoon: '例如：三连二排',
    reason: '例如：上课冲突、就医、比赛等',
    proof: '例如：门诊证明、比赛通知等',
    phone: '例如：13800000000',
    teacher: '例如：张老师',
    place: '例如：教一-101',
    date: 'YYYY-MM-DD',
    count: '请输入人数',
    academy: '例如：明理书院',
    subject: '请输入活动主题',
    summary: '请输入活动概述',
    serialNo: '请输入序号',
  }
  return map[k] || `请输入${fieldLabel(k)}`
}

function buildFieldConfig(templateTitle, key) {
  const titleText = normalizeText(templateTitle)
  const titleToken = normalizeFieldToken(titleText)
  const label = fieldLabel(key)
  const keyToken = normalizeFieldToken(key)
  const labelToken = normalizeFieldToken(label)
  const token = `${keyToken}|${labelToken}`
  const isLeaveTemplate = titleText.includes('请假')
  const isActivity2Template = titleText.includes('活动2') || titleToken.includes('活动2')

  const config = {
    label,
    multiline: keyToken === 'reason' || keyToken === 'proof' || /text|desc|note|summary/.test(keyToken),
    options: null,
    integer: false,
    maxValue: null,
    maxLength: null,
    placeholder: '',
    hint: '',
  }

  if (token.includes('date') || token.includes('time') || label.includes('日期') || label.includes('时间')) {
    config.placeholder = 'YYYY-MM-DD'
    config.hint = '请输入真实存在的日期，格式为 YYYY-MM-DD，且不能晚于今天。'
    return config
  }

  if (token.includes('college') || label.includes('学院')) {
    config.options = COLLEGE_OPTIONS
    config.hint = '学院字段目前仅允许选择“信息学院”。'
    return config
  }

  if (token.includes('academy') || label.includes('书院')) {
    config.options = ACADEMY_OPTIONS
    config.hint = '所属书院目前仅允许选择“明理书院”。'
    return config
  }

  if (/(people|person|count|num|人数|人数上限|参与人数|数量)/.test(token)) {
    config.integer = true
    config.maxValue = 2000
    config.hint = '人数必须为不超过 2000 的整数。'
    return config
  }

  if (/(serial|sequence|index|order|no|number|序号|编号)/.test(token)) {
    config.integer = true
    config.maxValue = 1000
    config.hint = '序号或编号必须为不超过 1000 的整数。'
    return config
  }

  if (isLeaveTemplate && (keyToken === 'reason' || keyToken === 'proof' || label.includes('事由') || label.includes('证明'))) {
    config.multiline = true
    config.maxLength = 200
    config.hint = `${label}最多 200 字。`
    return config
  }

  if (isActivity2Template && (token.includes('subject') || label.includes('主题'))) {
    config.maxLength = 50
    config.hint = '活动主题最多 50 字。'
    return config
  }

  if (isActivity2Template && (token.includes('place') || label.includes('地点'))) {
    config.maxLength = 50
    config.hint = '地点最多 50 字。'
    return config
  }

  if (isActivity2Template && (token.includes('summary') || token.includes('overview') || label.includes('概述'))) {
    config.multiline = true
    config.maxLength = 200
    config.hint = '概述最多 200 字。'
    return config
  }

  if (/(amount|total|quantity|count|num|人数|数量|份数|次数)/.test(token)) {
    config.integer = true
    config.maxValue = 2000
    config.hint = '该字段必须为不超过 2000 的整数。'
    return config
  }

  if (/(year|month|day|date|time|日期|时间)/.test(token)) {
    config.placeholder = 'YYYY-MM-DD'
    config.hint = '请输入真实存在的日期，格式为 YYYY-MM-DD。'
    return config
  }

  if (/(score|level|rank|grade|quantity|count|no|number|num|amount|total)/.test(token)) {
    config.integer = true
    config.maxValue = 2000
    config.hint = '该字段必须为合理范围内的整数。'
    return config
  }

  return config
}

function validateManualFields(fields, templateTitle) {
  const todayYmd = localTodayYmd()
  for (const field of fields) {
    const value = normalizeText(field?.value)
    const label = String(field?.label || fieldLabel(field?.key))
    const config = buildFieldConfig(templateTitle, field?.key)
    const keyToken = normalizeFieldToken(field?.key)
    const isYmdField = config.placeholder === 'YYYY-MM-DD' || keyToken.includes('date') || keyToken.includes('time') || label.includes('日期') || label.includes('时间')
    if (!value) return `请填写${label}`

    if (config.options?.length && !config.options.includes(value)) {
      return `${label}只能从指定选项中选择`
    }

    if (config.maxLength && value.length > config.maxLength) {
      return `${label}不能超过 ${config.maxLength} 字`
    }

    if (isYmdField && !isValidYmd(value)) {
      return `${label}格式错误或日期无效，应为真实的 YYYY-MM-DD`
    }

    if (isYmdField && value > todayYmd) {
      return `${label}不能设置为未来日期`
    }

    if (config.integer) {
      if (!/^\d+$/.test(value)) return `${label}必须为整数`
      const num = Number(value)
      if (!Number.isSafeInteger(num)) return `${label}数值超出允许范围`
      if (num > Number(config.maxValue || 2000)) return `${label}不能超过 ${config.maxValue || 2000}`
    }
  }
  return ''
}

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

  const normalizedFields = useMemo(
    () =>
      manualFields.map((field) => {
        const config = buildFieldConfig(selectedTemplateTitle, field.key)
        return {
          ...field,
          config,
          placeholder: fieldPlaceholder(field.key, config),
        }
      }),
    [manualFields, selectedTemplateTitle],
  )

  useEffect(() => {
    loadTemplates()
  }, [])

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
        if (id) await loadTemplateFields(id, title)
      }
    } catch (err) {
      alert(err?.message || '加载模板失败')
    }
  }

  async function loadTemplateFields(id, templateTitle = '') {
    const templateId = String(id ?? '').trim()
    if (!templateId) return
    try {
      const resp = await api.featureApi.certTemplateFields({ id: templateId })
      const keys = Array.isArray(resp?.manualFields) ? resp.manualFields : []
      setManualFields(
        keys.map((key) => ({
          key: String(key),
          label: fieldLabel(key),
          value: '',
        })),
      )
      if (templateTitle) setSelectedTemplateTitle(String(templateTitle))
    } catch (err) {
      setManualFields([])
      alert(err?.message || '加载模板字段失败')
    }
  }

  function onChangeManualField(key, value) {
    const fieldKey = String(key ?? '')
    setManualFields((prev) =>
      Array.isArray(prev)
        ? prev.map((item) => (item.key === fieldKey ? { ...item, value: String(value ?? '') } : item))
        : prev,
    )
  }

  function buildParamsFromManualFields() {
    const params = {}
    for (const field of manualFields) {
      const key = String(field?.key ?? '').trim()
      if (!key) continue
      params[key] = normalizeText(field?.value)
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
    const validationMessage = validateManualFields(normalizedFields, selectedTemplateTitle)
    if (validationMessage) return alert(validationMessage)
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
    const validationMessage = validateManualFields(normalizedFields, selectedTemplateTitle)
    if (validationMessage) return alert(validationMessage)
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

  function renderManualField(field) {
    const config = field.config || {}
    const commonProps = {
      className: 'input',
      value: field.value,
      onChange: (event) => onChangeManualField(field.key, event.target.value),
    }
    if (config.options?.length) {
      return (
        <select {...commonProps}>
          <option value="">请选择</option>
          {config.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )
    }
    if (config.multiline) {
      return <textarea {...commonProps} placeholder={field.placeholder} maxLength={config.maxLength || undefined} rows={4} />
    }
    return (
      <input
        {...commonProps}
        placeholder={field.placeholder}
        maxLength={config.maxLength || undefined}
        inputMode={config.integer ? 'numeric' : undefined}
      />
    )
  }

  return (
    <div className="container">
      <div className="page-header" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
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
                    if (id) await loadTemplateFields(id, template?.title || '')
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

            <div style={{ marginBottom: 8, color: '#6b7280' }}>系统会自动填充姓名、学号和日期等基础信息。手动字段会按模板规则进行校验。</div>

            {!selectedTemplateId ? (
              <div style={{ color: '#6b7280' }}>请选择模板后填写需要手动补充的字段。</div>
            ) : normalizedFields.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {normalizedFields.map((field) => (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ color: '#374151', fontSize: 12 }}>{field.label}</span>
                    {renderManualField(field)}
                    {field.config?.maxLength ? (
                      <span style={{ color: '#64748b', fontSize: 12 }}>
                        {field.config.hint} 当前 {String(field.value || '').length}/{field.config.maxLength}
                      </span>
                    ) : field.config?.hint ? (
                      <span style={{ color: '#64748b', fontSize: 12 }}>{field.config.hint}</span>
                    ) : null}
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
