import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function pad2(n) { return String(n).padStart(2, '0') }
function formatDateTime(ts) {
  const n = Number(ts || 0)
  if (!n) return ''
  const d = new Date(n)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function defaultSemesterFromNow() {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth() + 1; return m <= 7 ? `${y}-春` : `${y}-秋`
}
function splitCsvLine(line) {
  const s = String(line ?? ''); const out = []; let cur = ''; let inQuote = false
  for (let i=0;i<s.length;i++){ const ch = s[i]; if (ch === '"') { if (inQuote && s[i+1] === '"') { cur += '"'; i += 1 } else { inQuote = !inQuote } continue } if (!inQuote && ch === ',') { out.push(cur); cur = ''; continue } cur += ch }
  out.push(cur); return out.map(x => String(x ?? '').trim())
}
function parseSemesterCoursesCsv(text) {
  const lines = String(text ?? '').replace(/\r/g,'').split('\n').map(x => String(x).trim()).filter(Boolean)
  const out = []
  for (const line of lines) {
    const cols = splitCsvLine(line)
    const courseCode = String(cols[0] ?? '').trim(); const courseName = String(cols[1] ?? '').trim(); const credits = Number(String(cols[2] ?? '').trim() || 0); const moduleName = String(cols[3] ?? '').trim()
    if (!courseCode && !courseName) continue
    out.push({ courseCode, courseName, credits, moduleName })
  }
  return out
}

export default function Academic() {
  const featureDisabled = true
  const [isAdmin, setIsAdmin] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  const [semester, setSemester] = useState(defaultSemesterFromNow())
  const [planNames, setPlanNames] = useState([])
  const [planIndex, setPlanIndex] = useState(0)
  const [selectedPlanName, setSelectedPlanName] = useState('')

  const [plans, setPlans] = useState([])
  const [report, setReport] = useState(null)
  const [reportLoaded, setReportLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [importingPlan, setImportingPlan] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

  // plan edit form
  const [planEditingId, setPlanEditingId] = useState('')
  const [planFormName, setPlanFormName] = useState('')
  const [planFormModulesJson, setPlanFormModulesJson] = useState('')

  // semester courses admin
  const [adminSemester, setAdminSemester] = useState(defaultSemesterFromNow())
  const [semesterCoursesCsv, setSemesterCoursesCsv] = useState('')
  const [semesterCoursesLoadedCount, setSemesterCoursesLoadedCount] = useState(0)
  const [savingSemesterCourses, setSavingSemesterCourses] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!featureDisabled) return
    alert('开发中，敬请期待')
  }, [])

  useEffect(() => {
    if (featureDisabled) return
    const s = api.auth.getSession()
    const role = s?.role
    setIsAdmin(role === 'admin')
    setIsStudent(role === 'student')
    ;(async () => {
      try {
        if (role === 'student') { await loadPlanOptions(); await loadReport() }
        if (role === 'admin') { await loadPlans() }
      } catch (e) {}
    })()
  }, [])

  async function loadPlanOptions() {
    const r = await api.featureApi.academicPlans(); const items = Array.isArray(r.items) ? r.items : []
    const names = items.map(x => String(x.name ?? '')).filter(Boolean)
    let selected = String(selectedPlanName || '').trim()
    if (!selected && names.length === 1) selected = names[0]
    let idx = names.findIndex(x => x === selected); if (idx < 0) idx = 0
    const finalSelected = selected && names.includes(selected) ? selected : names[idx] || ''
    setPlanNames(names); setPlanIndex(idx); setSelectedPlanName(finalSelected)
  }

  async function loadReport() {
    try {
      if (loading) return
      setLoading(true)
      const r = await api.featureApi.academicStudentReport({ semester, planName: selectedPlanName })
      setReportLoaded(true)
      setReport({ hasTranscript: !!r.hasTranscript, planName: String(r.planName ?? ''), transcriptCreatedAtText: r.transcript?.createdAt ? formatDateTime(r.transcript.createdAt) : '', modules: Array.isArray(r.modules) ? r.modules : [], missingCourses: Array.isArray(r.missingCourses) ? r.missingCourses : [], recommendations: Array.isArray(r.recommendations) ? r.recommendations : [] })
    } catch (e) {
      alert(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadPlans() {
    try {
      const r = await api.featureApi.academicAdminPlans(); const items = Array.isArray(r.items) ? r.items : []
      const mapped = items.map(x => ({ ...x, updatedAtText: x.updatedAt ? formatDateTime(x.updatedAt) : '' }))
      setPlans(mapped)
    } catch (e) {}
  }

  function onSemesterChange(e) { setSemester(e.target.value) }
  function onPlanPickerChange(e) { const idx = Number(e.target.value || 0); setPlanIndex(idx); const names = Array.isArray(planNames) ? planNames : []; const sel = String(names[idx] ?? ''); setSelectedPlanName(sel); loadReport() }

  async function onChooseTranscript(e) {
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
      const session = api.auth.getSession()
      const parts = []
      if (semester) parts.push(`semester=${encodeURIComponent(semester)}`)
      if (selectedPlanName) parts.push(`planName=${encodeURIComponent(selectedPlanName)}`)
      const qs = parts.length ? `?${parts.join('&')}` : ''
      const url = `${api.getBaseUrl() || ''}/api/academic/student/transcript/upload${qs}`
      const fd = new FormData(); fd.append('file', file)
      const opts = { method: 'POST', headers: {}, body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts); const text = await res.text(); const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '上传失败')
      alert('已解析，准备刷新')
      await loadReport()
    } catch (err) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false); e.target.value = ''
    }
  }

  async function onImportPlanFile(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (importingPlan) return
    setImportingPlan(true)
    try {
      const session = api.auth.getSession()
      const url = `${api.getBaseUrl() || ''}/api/academic/admin/plans/import`
      const fd = new FormData(); fd.append('file', file); fd.append('name', planFormName || file.name || 'imported')
      const opts = { method: 'POST', headers: {}, body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts); const text = await res.text(); const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '导入失败')
      const modules = obj?.data?.modules || []
      const id = obj?.data?.id || ''
      setPlanEditingId(String(id || ''))
      setPlanFormModulesJson(JSON.stringify(modules, null, 2))
      alert('导入成功')
      await loadPlans()
    } catch (err) {
      alert(err?.message || '导入失败')
    } finally {
      setImportingPlan(false); e.target.value = ''
    }
  }

  function onResetPlanForm() { setPlanEditingId(''); setPlanFormName(''); setPlanFormModulesJson('') }

  function onEditPlan(item) { setPlanEditingId(item._id || item.id || ''); setPlanFormName(item.name || ''); setPlanFormModulesJson(JSON.stringify(item.modules || [], null, 2)) }

  async function onDeletePlan(id) {
    if (!id) return
    if (!confirm('确认删除该培养方案？')) return
    try { await api.featureApi.academicAdminPlanDelete({ id }); alert('已删除'); await loadPlans(); onResetPlanForm() } catch (e) { alert(e?.message || '删除失败') }
  }

  async function onSavePlan() {
    if (savingPlan) return
    const name = String(planFormName || '').trim(); if (!name) { alert('请填写方案名称'); return }
    let modules
    try { modules = JSON.parse(String(planFormModulesJson || '').trim() || '[]') } catch { alert('modules JSON 不合法'); return }
    if (!Array.isArray(modules)) { alert('modules 必须是数组'); return }
    setSavingPlan(true)
    try {
      if (planEditingId) await api.featureApi.academicAdminPlanUpdate({ id: planEditingId, name, modules })
      else await api.featureApi.academicAdminPlanCreate({ name, modules })
      alert('已保存')
      await loadPlans(); onResetPlanForm()
    } catch (e) { alert(e?.message || '保存失败') }
    finally { setSavingPlan(false) }
  }

  async function onLoadSemesterCourses() {
    const sem = String(adminSemester || '').trim() || defaultSemesterFromNow()
    try {
      const resp = await api.featureApi.academicAdminSemesterCourses({ semester: sem })
      const items = Array.isArray(resp.items) ? resp.items : []
      const csv = items.map(x => `${x.courseCode || ''},${x.courseName || ''},${x.credits || 0},${x.moduleName || ''}`).join('\n')
      setAdminSemester(sem); setSemesterCoursesCsv(csv); setSemesterCoursesLoadedCount(items.length)
      alert('已加载')
    } catch (e) { alert(e?.message || '加载失败') }
  }

  async function onSaveSemesterCourses() {
    if (savingSemesterCourses) return
    const sem = String(adminSemester || '').trim() || defaultSemesterFromNow()
    const items = parseSemesterCoursesCsv(semesterCoursesCsv)
    if (!items.length) { alert('课程列表为空'); return }
    setSavingSemesterCourses(true)
    try { await api.featureApi.academicAdminSemesterCoursesSave({ semester: sem, items }); alert('已保存'); setAdminSemester(sem); await onLoadSemesterCourses() } catch (e) { alert(e?.message || '保存失败') } finally { setSavingSemesterCourses(false) }
  }

  if (featureDisabled) {
    return (
      <div className="container">
        <h2>学业情况分析</h2>
        <p className="empty-state">开发中，敬请期待</p>
        <button className="btn" onClick={() => nav('/')}>返回首页</button>
      </div>
    )
  }

  return (
    <div className="container">
      <h2>学业情况分析</h2>
      <div className="card">
        <h3>学生视图</h3>
        <div style={{ marginBottom: 8 }}>
          <label>学期: <input value={semester} onChange={onSemesterChange} /></label>
          <label style={{ marginLeft: 12 }}>培养方案: <select value={planIndex} onChange={onPlanPickerChange}>{planNames.map((n,i)=> <option key={n} value={i}>{n}</option>)}</select></label>
          <button className="btn" style={{ marginLeft: 8 }} onClick={loadReport} disabled={loading}>{loading ? '加载中...' : '加载学业报告'}</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <label className="btn">上传成绩单<input type="file" style={{ display: 'none' }} onChange={onChooseTranscript} /></label>
          <span style={{ marginLeft: 8 }}>{uploading ? '上传中...' : ''}</span>
        </div>
        {reportLoaded && report && <div style={{ marginTop: 12 }}>
          <h4>分析结果（{report.planName}）</h4>
          <div>已上传成绩单: {report.hasTranscript ? `是（${report.transcriptCreatedAtText}）` : '否'}</div>

          {report.hasTranscript && <div style={{ marginTop: 10 }}>
            <h5>模块完成情况</h5>
            <div>
              {(report.modules || []).map((m, idx) => (
                <div key={m.name || idx} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600 }}>{m.name || '模块'}</div>
                  <div style={{ color: '#666', fontSize: 13 }}>需 {m.requiredCredits || 0} 学分 · 已修 {m.earnedCredits || 0} 学分 · 缺 {m.deficitCredits || 0} 学分</div>
                  <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 6px', borderRadius: 4, background: (m.deficitCredits || 0) > 0 ? '#fde2e2' : '#e6f7e6', color: (m.deficitCredits || 0) > 0 ? '#c12d2d' : '#2d7a2d' }}>{(m.deficitCredits || 0) > 0 ? '未修满' : '已满足'}</div>
                </div>
              ))}
            </div>

            <h5 style={{ marginTop: 12 }}>推荐课程</h5>
            {(report.recommendations || []).length ? (
              (report.recommendations || []).map((rec, i) => (
                <div key={rec.courseCode || rec.courseName || i} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ fontWeight: 600 }}>{rec.courseName || rec.courseCode}</div>
                  <div style={{ color: '#666', fontSize: 13 }}>{rec.semester || '-'} · {rec.credits || 0} 学分 · {rec.moduleName || '-'}</div>
                  <div style={{ color: '#444', marginTop: 6 }}>{rec.reason}</div>
                </div>
              ))
            ) : <div style={{ color: '#888' }}>暂无推荐（可能未配置本学期开课课程，或必修已修完）</div>}

            <h5 style={{ marginTop: 12 }}>未修课程</h5>
            {(report.missingCourses || []).length ? (
              (report.missingCourses || []).map((c, i) => (
                <div key={c.code || c.name || i} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ fontWeight: 600 }}>{c.name || c.code}</div>
                  <div style={{ color: '#666', fontSize: 13 }}>{c.code || '-'} · {c.credits || 0} 学分 · {c.moduleName || '-'}</div>
                  <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 6px', borderRadius: 4, background: '#fde2e2', color: '#c12d2d' }}>未修</div>
                </div>
              ))
            ) : <div style={{ color: '#888' }}>暂无未修课程</div>}
          </div>}

          {!report.hasTranscript && <div style={{ marginTop: 8, color: '#888' }}>尚未上传成绩单</div>}
        </div>}
      </div>

      {isAdmin && <div className="card" style={{ marginTop: 12 }}>
        <h3>管理员：培养方案管理</h3>
        <div>
          <ul>{plans.map(p => <li key={p._id || p.id}><strong>{p.name}</strong> <small style={{ marginLeft: 8 }}>{p.updatedAtText}</small> <button className="btn" style={{ marginLeft: 8 }} onClick={() => onEditPlan(p)}>编辑</button> <button className="btn" style={{ marginLeft: 8 }} onClick={() => onDeletePlan(p._id || p.id)}>删除</button></li>)}</ul>
        </div>
        <div style={{ marginTop: 8 }}>
          <div><input placeholder="方案名" value={planFormName} onChange={e=>setPlanFormName(e.target.value)} /></div>
          <div style={{ marginTop: 8 }}><textarea rows={8} style={{ width: '100%' }} placeholder='modules JSON' value={planFormModulesJson} onChange={e=>setPlanFormModulesJson(e.target.value)} /></div>
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={onSavePlan}>{savingPlan ? '保存中...' : '保存方案'}</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={onResetPlanForm}>重置</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="btn">导入培养方案<input type="file" style={{ display: 'none' }} onChange={onImportPlanFile} /></label>
            <span style={{ marginLeft: 8 }}>{importingPlan ? '导入中...' : ''}</span>
          </div>
        </div>
      </div>}

      {isAdmin && <div className="card" style={{ marginTop: 12 }}>
        <h3>管理员：学期课程（CSV）</h3>
        <div>
          <label>学期: <input value={adminSemester} onChange={e=>setAdminSemester(e.target.value)} /></label>
          <button className="btn" style={{ marginLeft: 8 }} onClick={onLoadSemesterCourses}>加载课程</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <textarea rows={10} style={{ width: '100%' }} value={semesterCoursesCsv} onChange={e=>setSemesterCoursesCsv(e.target.value)} placeholder={'courseCode,courseName,credits,moduleName\n...'} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={onSaveSemesterCourses}>{savingSemesterCourses ? '保存中...' : '保存课程'}</button>
          <span style={{ marginLeft: 8 }}>已加载 {semesterCoursesLoadedCount} 条</span>
        </div>
      </div>}
    </div>
  )
}
