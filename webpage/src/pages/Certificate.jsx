import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function Certificate() {
  const [templates, setTemplates] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [college, setCollege] = useState('')
  const [platoon, setPlatoon] = useState('')
  const [reason, setReason] = useState('')
  const [proof, setProof] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')

  useEffect(() => { loadTemplates() }, [])

  useEffect(() => {
    const s = api.auth.getSession()
    setIsAdmin(s?.role === 'admin')
  }, [])

  async function loadTemplates() {
    try { const r = await api.featureApi.certTemplateList(); setTemplates(r.items || []) } catch (e) {}
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
    const params = { college, platoon, reason, proof }
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
      window.open(blobUrl, '_blank')
      // don't revoke immediately to allow browser to load
    } catch (e) {
      alert(e?.message || '生成失败')
    }
  }

  return (
    <div className="container">
      <h2>证书模板</h2>
      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 8 }}>学院：<input className="input" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="学院" /></label>
          <label style={{ marginRight: 8 }}>班：<input className="input" value={platoon} onChange={(e) => setPlatoon(e.target.value)} placeholder="支部/班级" /></label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 8 }}>事由：<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="事由" /></label>
          <label style={{ marginRight: 8 }}>证明：<input className="input" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="证明内容" /></label>
        </div>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {templates.map((t) => (
            <li key={t._id || t.id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ color: '#6b7280' }}>{t.category} · {t.format}</div>
                </div>
                <div>
                  <button className="btn" onClick={() => onDownloadTemplate(t.id || t._id, t.title)}>下载模板</button>
                  <button className="btn" style={{ marginLeft: 8 }} onClick={() => onGeneratePdf(t.id || t._id, t.title)}>生成 PDF</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ marginRight: 8 }}>模板标题：<input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="模板标题（默认使用文件名）" /></label>
              <label>分类：<input value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} placeholder="分类（可选）" /></label>
            </div>
            <label className="btn">上传证书模板<input type="file" style={{ display: 'none' }} onChange={onUploadTemplate} /></label>
            <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
