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

function buildCsvLine(values) {
  return values.map((value) => {
    const text = String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }).join(',')
}

function normalizePlanModules(modules) {
  const list = Array.isArray(modules) ? modules : []
  return list.map((module, moduleIndex) => ({
    localId: `module-${Date.now()}-${moduleIndex}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(module?.name ?? '').trim(),
    requiredCredits: String(module?.requiredCredits ?? ''),
    courses: (Array.isArray(module?.courses) ? module.courses : []).map((course, courseIndex) => ({
      localId: `course-${Date.now()}-${moduleIndex}-${courseIndex}-${Math.random().toString(36).slice(2, 8)}`,
      code: String(course?.code ?? '').trim(),
      name: String(course?.name ?? '').trim(),
      credits: String(course?.credits ?? ''),
    })),
  }))
}

function createEmptyCourse() {
  return {
    localId: `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: '',
    name: '',
    credits: '',
  }
}

function createEmptyModule() {
  return {
    localId: `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    requiredCredits: '',
    courses: [createEmptyCourse()],
  }
}

function serializePlanModules(modules) {
  return (Array.isArray(modules) ? modules : []).map((module) => ({
    name: String(module?.name ?? '').trim(),
    requiredCredits: Number(String(module?.requiredCredits ?? '').trim() || 0),
    courses: (Array.isArray(module?.courses) ? module.courses : [])
      .map((course) => ({
        code: String(course?.code ?? '').trim(),
        name: String(course?.name ?? '').trim(),
        credits: Number(String(course?.credits ?? '').trim() || 0),
      }))
      .filter((course) => course.code || course.name),
  })).filter((module) => module.name || module.courses.length)
}

export default function Academic() {
  const featureDisabled = false
  const [isAdmin, setIsAdmin] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
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

  const [planEditingId, setPlanEditingId] = useState('')
  const [planFormName, setPlanFormName] = useState('')
  const [planFormModules, setPlanFormModules] = useState([createEmptyModule()])

  const nav = useNavigate()

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
      const r = await api.featureApi.academicStudentReport({ planName: selectedPlanName })
      setReportLoaded(true)
      setReport({ hasTranscript: !!r.hasTranscript, planName: String(r.planName ?? ''), transcriptCreatedAtText: r.transcript?.createdAt ? formatDateTime(r.transcript.createdAt) : '', modules: Array.isArray(r.modules) ? r.modules : [], missingCourses: Array.isArray(r.missingCourses) ? r.missingCourses : [] })
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

  function onPlanPickerChange(e) { const idx = Number(e.target.value || 0); setPlanIndex(idx); const names = Array.isArray(planNames) ? planNames : []; const sel = String(names[idx] ?? ''); setSelectedPlanName(sel); loadReport() }

  async function onChooseTranscript(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (uploading) return
    setUploading(true)
    try {
      const session = api.auth.getSession()
      const parts = []
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

  function applyPlanToEditor({ id = '', name = '', modules = [] }) {
    setPlanEditingId(String(id || ''))
    setPlanFormName(String(name || ''))
    const normalized = normalizePlanModules(modules)
    setPlanFormModules(normalized.length ? normalized : [createEmptyModule()])
  }

  async function onImportPlanFile(e) {
    const file = (e.target.files || [])[0]
    if (!file) return
    if (importingPlan) return
    setImportingPlan(true)
    try {
      const session = api.auth.getSession()
      const url = `${api.getBaseUrl() || ''}/api/academic/admin/plans/import`
      const fd = new FormData(); fd.append('file', file); fd.append('name', planFormName || file.name.replace(/\.[^.]+$/, '') || 'imported')
      const opts = { method: 'POST', headers: {}, body: fd }
      if (session?.token) opts.headers['Authorization'] = `Bearer ${session.token}`
      const res = await fetch(url, opts); const text = await res.text(); const obj = JSON.parse(text)
      if (!obj?.success) throw new Error(obj?.message || '导入失败')
      const data = obj?.data || {}
      applyPlanToEditor({ id: data.id, name: data.name || planFormName || file.name, modules: data.modules || [] })
      alert('导入成功，请继续检查并保存')
      await loadPlans()
    } catch (err) {
      alert(err?.message || '导入失败')
    } finally {
      setImportingPlan(false); e.target.value = ''
    }
  }

  function onResetPlanForm() {
    setPlanEditingId('')
    setPlanFormName('')
    setPlanFormModules([createEmptyModule()])
  }

  function onEditPlan(item) {
    applyPlanToEditor({ id: item._id || item.id || '', name: item.name || '', modules: item.modules || [] })
  }

  function updateModuleField(moduleId, field, value) {
    setPlanFormModules((prev) => prev.map((module) => module.localId === moduleId ? { ...module, [field]: value } : module))
  }

  function addModule() {
    setPlanFormModules((prev) => [...prev, createEmptyModule()])
  }

  function removeModule(moduleId) {
    setPlanFormModules((prev) => {
      const next = prev.filter((module) => module.localId !== moduleId)
      return next.length ? next : [createEmptyModule()]
    })
  }

  function addCourse(moduleId) {
    setPlanFormModules((prev) => prev.map((module) => module.localId === moduleId ? { ...module, courses: [...module.courses, createEmptyCourse()] } : module))
  }

  function updateCourseField(moduleId, courseId, field, value) {
    setPlanFormModules((prev) => prev.map((module) => {
      if (module.localId !== moduleId) return module
      return {
        ...module,
        courses: module.courses.map((course) => course.localId === courseId ? { ...course, [field]: value } : course),
      }
    }))
  }

  function removeCourse(moduleId, courseId) {
    setPlanFormModules((prev) => prev.map((module) => {
      if (module.localId !== moduleId) return module
      const nextCourses = module.courses.filter((course) => course.localId !== courseId)
      return { ...module, courses: nextCourses.length ? nextCourses : [createEmptyCourse()] }
    }))
  }

  async function onDeletePlan(id) {
    if (!id) return
    if (!confirm('确认删除该培养方案？')) return
    try {
      await api.featureApi.academicAdminPlanDelete({ id })
      alert('已删除')
      await loadPlans()
      if (String(planEditingId) === String(id)) onResetPlanForm()
    } catch (e) { alert(e?.message || '删除失败') }
  }

  async function onSavePlan() {
    if (savingPlan) return
    const name = String(planFormName || '').trim(); if (!name) { alert('请填写方案名称'); return }
    const modules = serializePlanModules(planFormModules)
    if (!modules.length) { alert('请至少填写一个模块或课程'); return }
    const hasInvalidModule = modules.some((module) => !module.name)
    if (hasInvalidModule) { alert('请填写每个模块的名称'); return }
    const hasInvalidCourse = modules.some((module) => module.courses.some((course) => !course.name))
    if (hasInvalidCourse) { alert('请填写课程名称后再保存'); return }
    setSavingPlan(true)
    try {
      if (planEditingId) await api.featureApi.academicAdminPlanUpdate({ id: planEditingId, name, modules })
      else {
        const resp = await api.featureApi.academicAdminPlanCreate({ name, modules })
        if (resp?.id) setPlanEditingId(String(resp.id))
      }
      alert('已保存')
      await loadPlans()
      applyPlanToEditor({ id: planEditingId, name, modules })
    } catch (e) { alert(e?.message || '保存失败') }
    finally { setSavingPlan(false) }
  }

  function onDownloadPlanTemplate() {
    const rows = [
      ['模块名称', '要求学分', '课程代码', '课程名称', '学分'],
      ['通识必修', '12', 'GE101', '大学英语', '2'],
      ['通识必修', '12', 'GE102', '高等数学A(上)', '4'],
      ['专业必修', '18', 'CS201', '数据结构', '3'],
      ['专业必修', '18', 'CS202', '计算机组成原理', '3'],
    ]
    const csv = `${rows.map(buildCsvLine).join('\r\n')}`.replace(/^\u001a/, '\uFEFF')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '培养方案导入模板.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
      <div className="page-header" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-secondary back-home-btn" type="button" onClick={() => nav('/')}>返回首页</button>
      </div>
      <h2>学业情况分析</h2>
      {isStudent && <div className="card">
        <h3>学生视图</h3>
        <div style={{ marginBottom: 8 }}>
          <label>培养方案: <select value={planIndex} onChange={onPlanPickerChange}>{planNames.map((n,i)=> <option key={n} value={i}>{n}</option>)}</select></label>
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
      </div>}

      {isAdmin && <div className="card academic-admin-card" style={{ marginTop: 12 }}>
        <div className="academic-admin-header">
          <div>
            <h3>管理员：培养方案管理</h3>
            <p className="section-note">逐条维护模块和课程，不再直接编辑 JSON。</p>
          </div>
          <div className="inline-actions" style={{ marginTop: 0 }}>
            <button className="btn btn-secondary" onClick={onResetPlanForm}>新建方案</button>
            <button className="btn" onClick={onDownloadPlanTemplate}>下载CSV模板</button>
            <label className="btn">
              导入培养方案
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onImportPlanFile} />
            </label>
          </div>
        </div>
        <div className="academic-admin-layout">
          <section className="academic-plan-list">
            <div className="academic-panel-heading">
              <h4>已有方案</h4>
              <span className="badge">{plans.length} 个方案</span>
            </div>
            {plans.length ? (
              <div className="academic-plan-items">
                {plans.map((p) => (
                  <div key={p._id || p.id} className={`academic-plan-item ${String(planEditingId) === String(p._id || p.id) ? 'active' : ''}`}>
                    <div className="academic-plan-item-main">
                      <div className="academic-plan-item-name">{p.name}</div>
                      <div className="academic-plan-item-meta">{p.updatedAtText || '未记录更新时间'}</div>
                    </div>
                    <div className="inline-actions academic-plan-item-actions" style={{ marginTop: 0 }}>
                      <button className="btn btn-secondary" onClick={() => onEditPlan(p)}>编辑</button>
                      <button className="btn btn-secondary" onClick={() => onDeletePlan(p._id || p.id)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="empty-state">暂无培养方案，先下载模板填写后导入，或者在右侧新建。</p>}
          </section>

          <section className="academic-plan-editor">
            <div className="academic-panel-heading">
              <h4>{planEditingId ? '编辑方案' : '新建方案'}</h4>
              <span className="academic-editor-hint">导入后也会落到这里继续调整</span>
            </div>
            <div className="form-row">
              <label className="form-label">方案名称</label>
              <input className="input" placeholder="例如：2024级计算机科学与技术本科培养方案" value={planFormName} onChange={(e) => setPlanFormName(e.target.value)} />
            </div>
            <div className="academic-module-list">
              {planFormModules.map((module, moduleIndex) => (
                <div key={module.localId} className="academic-module-card">
                  <div className="academic-module-header">
                    <div>
                      <div className="academic-module-index">模块 {moduleIndex + 1}</div>
                      <div className="academic-module-title">{module.name || '未命名模块'}</div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => removeModule(module.localId)}>删除模块</button>
                  </div>
                  <div className="academic-module-grid">
                    <div className="form-row">
                      <label className="form-label">模块名称</label>
                      <input className="input" value={module.name} placeholder="例如：专业必修" onChange={(e) => updateModuleField(module.localId, 'name', e.target.value)} />
                    </div>
                    <div className="form-row">
                      <label className="form-label">要求学分</label>
                      <input className="input" value={module.requiredCredits} placeholder="例如：18" onChange={(e) => updateModuleField(module.localId, 'requiredCredits', e.target.value)} />
                    </div>
                  </div>
                  <div className="academic-course-list">
                    {module.courses.map((course, courseIndex) => (
                      <div key={course.localId} className="academic-course-row">
                        <div className="academic-course-number">{courseIndex + 1}</div>
                        <input className="input" value={course.code} placeholder="课程代码" onChange={(e) => updateCourseField(module.localId, course.localId, 'code', e.target.value)} />
                        <input className="input" value={course.name} placeholder="课程名称" onChange={(e) => updateCourseField(module.localId, course.localId, 'name', e.target.value)} />
                        <input className="input" value={course.credits} placeholder="学分" onChange={(e) => updateCourseField(module.localId, course.localId, 'credits', e.target.value)} />
                        <button className="btn btn-secondary" onClick={() => removeCourse(module.localId, course.localId)}>删除</button>
                      </div>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <button className="btn btn-secondary" onClick={() => addCourse(module.localId)}>新增课程</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="inline-actions">
              <button className="btn btn-secondary" onClick={addModule}>新增模块</button>
              <button className="btn" onClick={onSavePlan}>{savingPlan ? '保存中...' : '保存方案'}</button>
              <button className="btn btn-secondary" onClick={onResetPlanForm}>清空编辑区</button>
              <span className="academic-editor-hint">{importingPlan ? '导入中...' : '模板列顺序：模块名称、要求学分、课程代码、课程名称、学分。'}</span>
            </div>
          </section>
        </div>
      </div>}
    </div>
  )
}
