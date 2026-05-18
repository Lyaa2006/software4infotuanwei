import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function Activity() {
  const [items, setItems] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadMy() }, [])

  async function loadMy() {
    try { const r = await api.featureApi.activityMyList(); setItems(r.items || []) } catch (e) {}
  }

  async function onUploadPhoto(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (uploading) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const url = `${api.getBaseUrl() || ''}/api/activity/cadre/upload`
      const session = api.auth.getSession()
      const opts = { method: 'POST', headers: {}, body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts)
      const text = await res.text()
      const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '上传失败')
      alert('照片上传成功')
      await loadMy()
    } catch (err) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="container">
      <h2>活动管理</h2>
      <div className="card">
        <h3>我的活动</h3>
          <div style={{ marginBottom: 8 }}>
            <label className="btn">上传活动照片<input type="file" style={{ display: 'none' }} onChange={onUploadPhoto} /></label>
            <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
          </div>
          <ul>{items.map(i => <li key={i._id || i.id}>{i.title || i.summary || JSON.stringify(i)}</li>)}</ul>
      </div>
    </div>
  )
}
