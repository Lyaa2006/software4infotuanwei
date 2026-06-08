import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { collectAvailableTags, mapStudentTags, normalizeTagList, tagsToText } from '../utils/studentTags'
import {
  formatStudentDisplayName,
  isStudentRecord,
  logFilteredNonStudentRecords,
  normalizeStudentRecords,
} from '../utils/studentAccounts'

const TAG_INPUT_HELP = '支持逗号、中文逗号、顿号、空格或换行分隔；重复标签会自动合并。'
const NON_STUDENT_TAG_MESSAGE = '目标账号不是学生账号，不能编辑学生标签'

function buildStatus(type, text) {
  return { type, text: String(text || '') }
}

function renderStatus(status) {
  if (!status?.text) return null
  const color = status.type === 'error' ? '#dc2626' : status.type === 'success' ? '#16a34a' : '#64748b'
  return <p className='section-note' style={{ color }}>{status.text}</p>
}

function renderTagChips(tags, emptyText = '暂无标签') {
  const list = normalizeTagList(tags)
  if (!list.length) return <span className='section-note'>{emptyText}</span>
  return list.map(tag => <span className='tag-chip' key={tag}>{tag}</span>)
}

function mapLoadedStudents(items) {
  const normalized = normalizeStudentRecords(items).map(mapStudentTags)
  return normalized.sort((a, b) => String(a.accountId || '').localeCompare(String(b.accountId || '')))
}

export default function TagManagement() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editingTagsText, setEditingTagsText] = useState('')

  const availableTags = useMemo(() => collectAvailableTags(students), [students])
  const previewTags = useMemo(() => normalizeTagList(editingTagsText), [editingTagsText])
  const studentCountText = loading ? '正在加载学生列表...' : `共 ${students.length} 位学生`

  useEffect(() => {
    const session = api.auth.getSession()
    const admin = session?.role === 'admin'
    setIsAdmin(admin)
    setCheckedSession(true)
    if (admin) loadStudents({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadStudents(options = {}) {
    if (loading) return
    setLoading(true)
    if (!options.silent) setStatus(null)
    try {
      const r = await api.featureApi.reminderAdminStudents()
      logFilteredNonStudentRecords('tag-management', r.items)
      const nextStudents = mapLoadedStudents(r.items)
      setStudents(nextStudents)
      if (!options.silent) setStatus(buildStatus('success', '学生标签列表已刷新'))
    } catch (e) {
      setStudents([])
      setStatus(buildStatus('error', e?.message || '加载学生标签失败'))
    } finally {
      setLoading(false)
    }
  }

  function openEditor(student) {
    if (!isStudentRecord(student)) {
      setStatus(buildStatus('error', NON_STUDENT_TAG_MESSAGE))
      return
    }
    const normalized = mapStudentTags(student)
    setEditingStudent(normalized)
    setEditingTagsText(normalized.tags.join(', '))
    setStatus(null)
  }

  function closeEditor() {
    if (saving) return
    setEditingStudent(null)
    setEditingTagsText('')
  }

  function patchStudentTags(accountId, tags) {
    setStudents(prev => prev.map(student => {
      if (String(student.accountId) !== String(accountId)) return student
      return mapStudentTags({ ...student, tags })
    }))
  }

  async function saveTags() {
    if (saving || !editingStudent?.accountId) return
    if (!isStudentRecord(editingStudent)) {
      setStatus(buildStatus('error', NON_STUDENT_TAG_MESSAGE))
      return
    }

    const accountId = String(editingStudent.accountId || '').trim()
    const tags = normalizeTagList(editingTagsText)
    setSaving(true)
    setStatus(null)
    try {
      await api.featureApi.reminderAdminStudentTagsSave({ accountId, tags })
      patchStudentTags(accountId, tags)
      setStatus(buildStatus('success', `已保存 ${formatStudentDisplayName(editingStudent)} 的标签`))
      setEditingStudent(null)
      setEditingTagsText('')
      await loadStudents({ silent: true })
    } catch (e) {
      setStatus(buildStatus('error', e?.message || '保存标签失败'))
    } finally {
      setSaving(false)
    }
  }

  function renderSessionNotice() {
    if (!checkedSession) return <p className='empty-state'>正在检查登录状态...</p>
    if (!isAdmin) return <p className='empty-state'>当前账号无学生标签管理权限，请使用管理员账号登录。</p>
    return null
  }

  function renderAvailableTags() {
    return (
      <div className='tag-summary'>
        <span className='section-note'>当前可用标签：</span>
        {renderTagChips(availableTags)}
      </div>
    )
  }

  function renderStudentRow(student) {
    const tags = normalizeTagList(student.tags)
    return (
      <div className='student-tag-row' key={student.accountId}>
        <div className='student-tag-main'>
          <div className='student-tag-name'>{student.name || student.accountId}</div>
          <div className='section-note'>学号：{student.accountId}</div>
          <div className='tag-chip-list row-tags'>
            {renderTagChips(tags)}
          </div>
        </div>
        <button className='btn' type='button' onClick={() => openEditor(student)}>编辑标签</button>
      </div>
    )
  }

  function renderStudentList() {
    if (!students.length && loading) return <p className='empty-state'>正在加载学生数据...</p>
    if (!students.length) return <p className='empty-state'>暂无学生数据。请先确认学生账号已在权限清单中启用。</p>
    return <div className='student-tag-list'>{students.map(renderStudentRow)}</div>
  }

  function renderEditor() {
    if (!editingStudent) return null
    return (
      <div className='tag-edit-backdrop' role='dialog' aria-modal='true' aria-labelledby='tag-edit-title' onClick={closeEditor}>
        <div className='tag-edit-dialog' onClick={e => e.stopPropagation()}>
          <h3 id='tag-edit-title'>编辑学生标签</h3>
          <div className='tag-edit-meta'>
            <div>学号：{editingStudent.accountId}</div>
            <div>姓名：{editingStudent.name || '-'}</div>
            <div>当前标签：{tagsToText(editingStudent.tags)}</div>
          </div>
          <div className='tag-chip-list'>
            {previewTags.length ? previewTags.map(tag => <span className='tag-chip' key={tag}>{tag}</span>) : <span className='tag-chip muted'>保存后将清空标签</span>}
          </div>
          <textarea
            rows={4}
            value={editingTagsText}
            onChange={e => setEditingTagsText(e.target.value)}
            placeholder='输入标签，支持逗号、中文逗号、顿号、空格或换行分隔；清空后保存表示无标签'
          />
          <p className='section-note' style={{ marginTop: 8 }}>{TAG_INPUT_HELP}</p>
          <div className='tag-edit-actions'>
            <button className='btn' type='button' onClick={saveTags} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            <button className='btn btn-secondary' type='button' onClick={closeEditor} disabled={saving}>取消</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='container'>
      <div className='page-toolbar'>
        <h2>学生标签管理</h2>
        <button className='btn btn-secondary back-home-btn' type='button' onClick={() => navigate('/')}>返回首页</button>
      </div>

      {renderSessionNotice()}

      {isAdmin && <>
        <div className='card'>
          <div className='section-heading'>
            <div>
              <h3 className='section-title'>学生列表</h3>
              <p className='section-note'>集中维护学生标签，通知页面会读取这些标签用于精准发送。{studentCountText}</p>
            </div>
            <button className='btn btn-secondary' type='button' onClick={() => loadStudents()} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
          </div>

          {renderStatus(status)}
          {renderAvailableTags()}
          {renderStudentList()}
        </div>

        {renderEditor()}
      </>}
    </div>
  )
}
