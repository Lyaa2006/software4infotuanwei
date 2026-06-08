import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { filterStudentAccountRecords } from '../utils/studentAccounts'

function pad2(n) { return String(n).padStart(2, '0') }
function formatYmd(ymd) {
  const s = String(ymd ?? '').trim()
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return ''
  return s
}
function isValidYmd(ymd) {
  const s = formatYmd(ymd)
  if (!s) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}
function formatDateTime(ts) {
  const n = Number(ts || 0)
  if (!n) return ''
  const d = new Date(n)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}
function joinUrl(baseUrl, p) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  const path = String(p || '')
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
function parseIds(text) {
  const raw = String(text ?? '')
  const parts = raw.split(/[\n\r,，\t ]+/).map((x) => String(x).trim())
  const out = []
  const seen = new Set()
  for (const p of parts) {
    if (!p) continue
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

export default function Activity() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  const [isCadre, setIsCadre] = useState(false)

  const [myItems, setMyItems] = useState([])
  const [cadreItems, setCadreItems] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [students, setStudents] = useState([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const [editingId, setEditingId] = useState('')
  const [editingRejectReason, setEditingRejectReason] = useState('')
  const [previewItem, setPreviewItem] = useState(null)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState('')

  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formSummary, setFormSummary] = useState('')
  const [formTargetTag, setFormTargetTag] = useState('')
  const [formOrganizers, setFormOrganizers] = useState('')
  const [formParticipants, setFormParticipants] = useState('')
  const [formHelpers, setFormHelpers] = useState('')
  const [formPhotoPaths, setFormPhotoPaths] = useState([])
  const [formPhotos, setFormPhotos] = useState([])

  useEffect(() => { init() }, [])

  async function init() {
    const s = api.auth.getSession()
    setIsAdmin(s?.role === 'admin')
    setIsStudent(s?.role === 'student')
    await reloadAll()
  }

  async function reloadAll() {
    if (loading) return
    setLoading(true)
    try {
      await loadMy()
      // use current session role instead of relying on state that may not be updated yet
      const s = api.auth.getSession()
      const role = s?.role
      if (role === 'student') await tryLoadCadreMine()
      if (role === 'admin') {
        await loadPending()
        await loadStudents()
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function loadMy() {
    try {
      const r = await api.featureApi.activityMyList()
      const items = Array.isArray(r.items) ? r.items : []
      const mapped = items.map((x) => ({ ...x, activityDateText: formatYmd(x.activityDate) || formatDateTime(x.updatedAt) || '', myRoleText: x.myRole === 'organizer' ? '组织' : x.myRole === 'helper' ? '协助' : '参与' }))
      setMyItems(mapped)
    } catch (e) {
      setMyItems([])
    }
  }

  async function tryLoadCadreMine() {
    try {
      const r = await api.featureApi.activityCadreMine()
      const items = Array.isArray(r.items) ? r.items : []
      const mapped = items.map((x) => ({ ...x, activityDateText: formatYmd(x.activityDate) || formatDateTime(x.updatedAt) || '', statusText: x.status === 'approved' ? '已通过' : x.status === 'rejected' ? '已驳回' : '待审核', canEdit: x.status !== 'approved' }))
      setIsCadre(true)
      setCadreItems(mapped)
    } catch (e) {
      setIsCadre(false)
      setCadreItems([])
    }
  }

  async function loadPending() {
    try {
      const r = await api.featureApi.activityAdminPending()
      const items = Array.isArray(r.items) ? r.items : []
      const baseUrl = api.getBaseUrl()
      const currentPreviewId = String(previewItem?._id || previewItem?.id || '')
      const mapped = items.map((x) => ({
        ...x,
        activityDateText: formatYmd(x.activityDate) || formatDateTime(x.updatedAt) || '',
        photoUrls: (x.photoPaths || []).map((p) => joinUrl(baseUrl, p)).filter(Boolean),
      }))
      setPendingItems(mapped)
      if (currentPreviewId) {
        const found = mapped.find((item) => String(item._id || item.id) === currentPreviewId) || null
        setPreviewItem(found)
        setPreviewPhotoUrl((prev) => {
          if (!found) return ''
          const nextUrls = found.photoUrls || []
          return nextUrls.includes(prev) ? prev : (nextUrls[0] || '')
        })
      }
    } catch (e) {
      setPendingItems([])
      setPreviewItem(null)
      setPreviewPhotoUrl('')
    }
  }

  async function loadStudents() {
    try {
      const r = await api.featureApi.reminderAdminStudents()
      const items = filterStudentAccountRecords(r.items)
      const mapped = items.map((x) => {
        const tags = Array.isArray(x.tags) ? x.tags : []
        const isCad = tags.includes('班团骨干')
        return { ...x, isCadre: isCad, tagsText: tags.length ? `标签：${tags.join('、')}` : '标签：-' }
      })
      setStudents(mapped)
    } catch (e) {
      setStudents([])
    }
  }

  function onTapItem(item) {
    if (!item) return
    alert(`${item.activityDateText || ''}\n角色：${item.myRoleText || ''}\n\n${item.summary || ''}`)
  }

  function onEditItem(found) {
    if (!found) return
    const baseUrl = api.getBaseUrl()
    const photoPaths = Array.isArray(found.photoPaths) ? found.photoPaths : []
    const joinIds = (list) => (Array.isArray(list) ? list.join('\n') : '')
    setEditingId(found._id || '')
    setEditingRejectReason(found.rejectReason || '')
    setFormTitle(found.title || '')
    setFormDate(found.activityDate || '')
    setFormSummary(found.summary || '')
    setFormTargetTag(found.targetTag || '')
    setFormOrganizers(joinIds(found?.participants?.organizers))
    setFormParticipants(joinIds(found?.participants?.participants))
    setFormHelpers(joinIds(found?.participants?.helpers))
    setFormPhotoPaths(photoPaths)
    setFormPhotos(photoPaths.map((p) => joinUrl(baseUrl, p)).filter(Boolean))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onClearPhotos() {
    setFormPhotoPaths([])
    setFormPhotos([])
  }

  async function uploadPhotos(files) {
    if (!files || !files.length) return
    // allow uploads — previously disabled with a "敬请期待" alert
    const apiSvc = api
    const baseUrl = apiSvc.getBaseUrl()
    const outPaths = []
    const outUrls = []
    setUploading(true)
    try {
      for (const f of Array.from(files).slice(0, 6)) {
        try {
          const data = await api.featureApi.activityCadreUpload(f)
          const path = data?.path || ''
          if (path) {
            outPaths.push(path)
            outUrls.push(joinUrl(baseUrl, path))
          }
        } catch (e) {
          // ignore individual upload failure
        }
      }
      const mergedPaths = (formPhotoPaths || []).concat(outPaths).slice(0, 6)
      const mergedUrls = (formPhotos || []).concat(outUrls).slice(0, 6)
      setFormPhotoPaths(mergedPaths)
      setFormPhotos(mergedUrls)
      if (outPaths.length) window.alert('上传成功')
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit() {
    if (saving) return
    const title = String(formTitle || '').trim()
    if (!title) return alert('请填写标题')
    const date = String(formDate || '').trim()
    if (date && !isValidYmd(date)) return alert('日期格式错误或日期无效，应为真实的 YYYY-MM-DD')
    setSaving(true)
    try {
      const participants = { organizers: parseIds(formOrganizers), participants: parseIds(formParticipants), helpers: parseIds(formHelpers) }
      if (editingId) {
        await api.featureApi.activityCadreUpdate({ id: editingId, title, summary: formSummary, activityDate: date, targetTag: formTargetTag, photoPaths: formPhotoPaths, participants })
      } else {
        await api.featureApi.activityCadreCreate({ title, summary: formSummary, activityDate: date, targetTag: formTargetTag, photoPaths: formPhotoPaths, participants })
      }
      alert('已提交')
      // reset
      setEditingId('')
      setEditingRejectReason('')
      setFormTitle('')
      setFormDate('')
      setFormSummary('')
      setFormTargetTag('')
      setFormOrganizers('')
      setFormParticipants('')
      setFormHelpers('')
      setFormPhotoPaths([])
      setFormPhotos([])
      await tryLoadCadreMine()
    } catch (e) {
      alert(e?.message || '提交失败')
    } finally {
      setSaving(false)
    }
  }

  async function onApprove(id) {
    if (!id) return
    if (!confirm('确认通过该活动申请？')) return
    try {
      await api.featureApi.activityAdminApprove({ id })
      alert('已通过')
      await loadPending()
    } catch (e) { alert(e?.message || '操作失败') }
  }

  async function onDeleteCadreItem(id) {
    if (!id || deletingId) return
    if (!window.confirm('确认删除该活动提案？删除后不可恢复。')) return
    setDeletingId(String(id))
    try {
      await api.featureApi.activityCadreDelete({ id })
      alert('已删除')
      if (String(editingId) === String(id)) {
        setEditingId('')
        setEditingRejectReason('')
        setFormTitle('')
        setFormDate('')
        setFormSummary('')
        setFormTargetTag('')
        setFormOrganizers('')
        setFormParticipants('')
        setFormHelpers('')
        setFormPhotoPaths([])
        setFormPhotos([])
      }
      await tryLoadCadreMine()
    } catch (e) {
      alert(e?.message || '删除失败')
    } finally {
      setDeletingId('')
    }
  }

  async function onReject(id) {
    if (!id) return
    const reason = prompt('驳回原因（可选）', '')
    if (reason === null) return
    try {
      const s = api.auth.getSession()
      const reviewedBy = String(s?.accountId || '').trim()
      await api.featureApi.activityAdminReject({ id, reason: reason || '', reviewed_by: reviewedBy })
      alert('已驳回')
      await loadPending()
    } catch (e) {
      const msg = [
        e?.message || '操作失败',
        e?.code ? `code=${e.code}` : '',
        e?.status ? `status=${e.status}` : '',
        e?.debug ? `debug=${JSON.stringify(e.debug, null, 2)}` : '',
      ].filter(Boolean).join('\n')
      alert(msg)
    }
  }

  function openPreview(item) {
    if (!item) return
    setPreviewItem(item)
    setPreviewPhotoUrl((item.photoUrls || [])[0] || '')
  }

  function closePreview() {
    setPreviewItem(null)
    setPreviewPhotoUrl('')
  }

  function participantText(item, key) {
    const arr = Array.isArray(item?.participants?.[key]) ? item.participants[key] : []
    return arr.length ? arr.join('、') : '无'
  }

  async function onToggleCadre(accountId) {
    if (!accountId) return
    const found = (students || []).find((x) => String(x.accountId) === String(accountId))
    if (!found) return
    const nextTags = (Array.isArray(found.tags) ? found.tags.slice() : [])
    const idx = nextTags.indexOf('班团骨干')
    if (idx >= 0) nextTags.splice(idx, 1)
    else nextTags.push('班团骨干')
    try {
      await api.featureApi.reminderAdminStudentTagsSave({ accountId, tags: nextTags })
      alert('已保存')
      await loadStudents()
    } catch (e) { alert(e?.message || '保存失败') }
  }

  return (
    <div className="container">
      <div className="page-toolbar">
      <h2>班团活动管理</h2>
        <button className="btn btn-secondary back-home-btn" type="button" onClick={() => navigate('/')}>返回首页</button>
      </div>

      {isStudent && <div className="card">
        <h3>我的活动</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {myItems.map((i) => (
            <li key={i._id || i.id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.title}</div>
                  <div style={{ color: '#6b7280' }}>{i.activityDateText} · {i.myRoleText}</div>
                </div>
                <div>
                  <button className="btn" onClick={() => onTapItem(i)}>详情</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>}

      {isStudent && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>班团骨干申请 / 我的提案</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {cadreItems.map((i) => (
              <li key={i._id || i.id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.title}</div>
                    <div style={{ color: '#6b7280' }}>{i.activityDateText} · {i.statusText}</div>
                  </div>
                  <div>
                    {i.canEdit && <button className="btn" onClick={() => onEditItem(i)} >编辑</button>}
                    {i.canEdit && <button className="btn" style={{ marginLeft: 8, background: '#ef4444' }} disabled={String(deletingId) === String(i._id || i.id)} onClick={() => onDeleteCadreItem(i._id || i.id)}>{String(deletingId) === String(i._id || i.id) ? '删除中...' : '删除'}</button>}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>{i.summary}</div>
                <div style={{ marginTop: 8 }}>{(i.photoUrls || []).map((u) => <img key={u} src={u} alt="p" style={{ maxWidth: 120, marginLeft: 8 }} />)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>待审核活动</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {pendingItems.map((i) => (
              <li key={i._id || i.id} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.title}</div>
                    <div style={{ color: '#6b7280' }}>{i.activityDateText} · 提交人：{i.createdBy || '-'} · {i.status}</div>
                  </div>
                  <div>
                    <button className="btn btn-secondary" onClick={() => openPreview(i)}>预览</button>
                    <button className="btn" onClick={() => onApprove(i._id || i.id)}>通过</button>
                    <button className="btn" style={{ marginLeft: 8, background: '#ef4444' }} onClick={() => onReject(i._id || i.id)}>驳回</button>
                  </div>
                </div>
                <div style={{ marginTop: 8, color: '#334155' }}>{i.summary || '暂无活动摘要'}</div>
                {!!(i.photoUrls || []).length && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                    {(i.photoUrls || []).slice(0, 3).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => openPreview(i)}
                        style={{
                          padding: 0,
                          border: '1px solid #dbe4ee',
                          borderRadius: 12,
                          background: '#fff',
                          width: 104,
                          height: 104,
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                      >
                        <img src={u} alt="活动图片缩略图" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                )}
                {i.rejectReason && <div style={{ marginTop: 8, color: '#ef4444' }}>驳回原因：{i.rejectReason}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && previewItem && (
        <div
          onClick={closePreview}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(1040px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              overflow: 'auto',
              padding: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{previewItem.title || '未命名活动'}</div>
                <div style={{ marginTop: 6, color: '#64748b' }}>
                  {previewItem.activityDateText || '未填写日期'} · 提交人：{previewItem.createdBy || '-'} · 状态：{previewItem.status || '-'}
                </div>
              </div>
              <button className="btn btn-secondary" type="button" onClick={closePreview}>关闭</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 0 }}>
              <div style={{ padding: 24, borderRight: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>活动摘要</div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#0f172a' }}>{previewItem.summary || '暂无活动摘要'}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
                  <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>目标标签</div>
                    <div>{previewItem.targetTag || '未填写'}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>图片数量</div>
                    <div>{(previewItem.photoUrls || []).length} 张</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>组织者</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{participantText(previewItem, 'organizers')}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>参与者</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{participantText(previewItem, 'participants')}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>协助者</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{participantText(previewItem, 'helpers')}</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 24, background: '#f8fbff' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>活动图片预览</div>
                {previewPhotoUrl ? (
                  <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #dbe4ee', background: '#fff', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}>
                    <img src={previewPhotoUrl} alt="活动图片预览" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block', background: '#e2e8f0' }} />
                  </div>
                ) : (
                  <div style={{ padding: '48px 20px', borderRadius: 16, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', background: '#fff' }}>暂无活动图片</div>
                )}

                {!!(previewItem.photoUrls || []).length && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 10, marginTop: 14 }}>
                    {(previewItem.photoUrls || []).map((u, idx) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setPreviewPhotoUrl(u)}
                        style={{
                          padding: 0,
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: previewPhotoUrl === u ? '2px solid #1d4ed8' : '1px solid #dbe4ee',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <img src={u} alt={`活动图片 ${idx + 1}`} style={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button className="btn" type="button" onClick={() => onApprove(previewItem._id || previewItem.id)}>通过</button>
                  <button className="btn" type="button" style={{ background: '#ef4444' }} onClick={() => onReject(previewItem._id || previewItem.id)}>驳回</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>学生列表（可切换班团骨干）</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {students.map((s) => (
              <li key={s.accountId} style={{ padding: 8, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name || s.accountId}</div>
                  <div style={{ color: '#6b7280' }}>{s.tagsText}</div>
                </div>
                <div>
                  <button className="btn" onClick={() => onToggleCadre(s.accountId)}>{s.isCadre ? '移除骨干' : '设为骨干'}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isAdmin && <div className="card" style={{ marginTop: 12 }}>
        <h3>{editingId ? '编辑活动' : '新建活动'}</h3>
        <div style={{ marginBottom: 8 }}>
          <input className="input" placeholder="活动标题" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <input className="input" placeholder="活动日期 YYYY-MM-DD" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <textarea className="input" placeholder="活动摘要" value={formSummary} onChange={(e) => setFormSummary(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <input className="input" placeholder="目标标签" value={formTargetTag} onChange={(e) => setFormTargetTag(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="input" placeholder="组织者（逗号或换行分隔）" value={formOrganizers} onChange={(e) => setFormOrganizers(e.target.value)} />
          <input className="input" placeholder="参与者（逗号或换行分隔）" value={formParticipants} onChange={(e) => setFormParticipants(e.target.value)} />
          <input className="input" placeholder="协助者（逗号或换行分隔）" value={formHelpers} onChange={(e) => setFormHelpers(e.target.value)} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label className="btn">选择照片<input type="file" style={{ display: 'none' }} multiple onChange={(e) => { uploadPhotos(e.target.files); e.target.value = '' }} /></label>
          <button className="btn" style={{ marginLeft: 8 }} onClick={onClearPhotos}>清除照片</button>
        </div>
        <div style={{ marginTop: 8 }}>{formPhotos.map((u) => <img key={u} src={u} alt="p" style={{ maxWidth: 120, marginLeft: 8 }} />)}</div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={onSubmit}>{saving ? '保存中...' : '保存'}</button>
          <button className="btn" style={{ marginLeft: 8, background: '#6b7280' }} onClick={() => {
            setEditingId(''); setFormTitle(''); setFormDate(''); setFormSummary(''); setFormTargetTag(''); setFormOrganizers(''); setFormParticipants(''); setFormHelpers(''); setFormPhotoPaths([]); setFormPhotos([])
          }}>重置</button>
        </div>
      </div>}
    </div>
  )
}
