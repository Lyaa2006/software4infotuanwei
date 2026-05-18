import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function Certificate() {
  const [templates, setTemplates] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadTemplates() }, [])

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
      await api.featureApi.certAdminTemplateUpload({ title: file.name || '模板', category: 'default', format, fileName: file.name || 'file', fileBase64: base64 })
      alert('模板上传成功')
      await loadTemplates()
    } catch (err) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="container">
      <h2>证书模板</h2>
      <div className="card">
        <ul>{templates.map(t => <li key={t._id || t.id}>{t.title || t.category || JSON.stringify(t)}</li>)}</ul>
        <div style={{ marginTop: 8 }}>
          <label className="btn">上传证书模板<input type="file" style={{ display: 'none' }} onChange={onUploadTemplate} /></label>
          <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
        </div>
      </div>
    </div>
  )
}
