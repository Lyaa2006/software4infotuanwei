import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function Academic() {
  const [plans, setPlans] = useState([])
  const [report, setReport] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    try { const r = await api.featureApi.academicPlans(); setPlans(r.items || []) } catch (e) {}
  }

  async function loadReport() {
    try { const r = await api.featureApi.academicStudentReport({}); setReport(r) } catch (e) {}
  }

  async function onChooseTranscript(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (uploading) return
    setUploading(true)
    try {
      const session = api.auth.getSession()
      const url = `${api.getBaseUrl() || ''}/api/academic/student/transcript/upload`
      const fd = new FormData()
      fd.append('file', file)
      // include semester/planName if available (leave empty)
      const opts = { method: 'POST', headers: {} , body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts)
      const text = await res.text()
      const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '上传失败')
      alert('成绩单已上传，正在刷新')
      await loadReport()
    } catch (err) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
      // clear input
      e.target.value = ''
    }
  }

  async function onImportPlanFile(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (importing) return
    setImporting(true)
    try {
      const session = api.auth.getSession()
      const url = `${api.getBaseUrl() || ''}/api/academic/admin/plans/import`
      const fd = new FormData()
      fd.append('file', file)
      // name should be provided by user in advanced UI; use filename as fallback
      fd.append('name', file.name || 'imported')
      const opts = { method: 'POST', headers: {} , body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts)
      const text = await res.text()
      const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '导入失败')
      alert('导入成功')
      await loadPlans()
    } catch (err) {
      alert(err?.message || '导入失败')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="container">
      <h2>学业</h2>
      <div className="card">
        <h3>计划列表</h3>
          <ul>{plans.map(p => <li key={p.id || p._id || p.name}>{p.name || JSON.stringify(p)}</li>)}</ul>
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={loadReport}>加载学业报告</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="btn">上传成绩单<input type="file" style={{ display: 'none' }} onChange={onChooseTranscript} /></label>
            <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="btn">导入培养方案<input type="file" style={{ display: 'none' }} onChange={onImportPlanFile} /></label>
            <span style={{ marginLeft: 8 }}>{importing ? '导入中...' : ''}</span>
          </div>
          {report && <pre style={{ marginTop: 12 }}>{JSON.stringify(report, null, 2)}</pre>}
      </div>
    </div>
  )
}
