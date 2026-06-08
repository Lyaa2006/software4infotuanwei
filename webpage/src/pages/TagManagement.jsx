import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { collectAvailableTags, mapStudentTags, normalizeTagList, tagsToText } from '../utils/studentTags'
import { filterStudentAccountRecords, isStudentAccountRecord } from '../utils/studentAccounts'

export default function TagManagement() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [editingTagsText, setEditingTagsText] = useState('')

  const availableTags = collectAvailableTags(students)
  const previewTags = normalizeTagList(editingTagsText)

  useEffect(() => {
    const session = api.auth.getSession()
    const admin = session?.role === 'admin'
    setIsAdmin(admin)
    setCheckedSession(true)
    if (admin) loadStudents()
  }, [])

  async function loadStudents() {
    if (loading) return
    setLoading(true)
    try {
      const r = await api.featureApi.reminderAdminStudents()
      const list = filterStudentAccountRecords(r.items)
      setStudents(list.map(mapStudentTags))
    } catch (e) {
      alert(e?.message || '加载学生标签失败')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  function onEdit(student) {
    if (!isStudentAccountRecord(student)) return alert('目标账号不是学生账号，不能编辑学生标签')
    const normalized = mapStudentTags(student)
    setEditingStudent(normalized)
    setEditingTagsText(normalized.tags.join(', '))
  }

  function onCancelEdit() {
    setEditingStudent(null)
    setEditingTagsText('')
  }

  async function onSaveTags() {
    if (saving || !editingStudent?.accountId) return
    if (!isStudentAccountRecord(editingStudent)) return alert('目标账号不是学生账号，不能编辑学生标签')
    const accountId = String(editingStudent.accountId || '').trim()
    const tags = normalizeTagList(editingTagsText)
    setSaving(true)
    try {
      await api.featureApi.reminderAdminStudentTagsSave({ accountId, tags })
      setStudents(prev => prev.map(student => String(student.accountId) === accountId ? mapStudentTags({ ...student, tags }) : student))
      alert('已保存')
      onCancelEdit()
      await loadStudents()
    } catch (e) {
      alert(e?.message || '保存标签失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='container'>
      <div className='page-toolbar'>
        <h2>学生标签管理</h2>
        <button className='btn btn-secondary back-home-btn' type='button' onClick={() => navigate('/')}>返回首页</button>
      </div>

      {!checkedSession ? <p className='empty-state'>正在检查登录状态...</p> : null}
      {checkedSession && !isAdmin ? <p className='empty-state'>当前账号无学生标签管理权限，请使用管理员账号登录。</p> : null}

      {isAdmin && <>
        <div className='card'>
          <div className='section-heading'>
            <div>
              <h3 className='section-title'>学生列表</h3>
              <p className='section-note'>集中维护学生标签，通知页面会读取这些标签用于精准发送。</p>
            </div>
            <button className='btn btn-secondary' type='button' onClick={loadStudents} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
          </div>

          <div className='tag-summary'>
            <span className='section-note'>当前可用标签：</span>
            {availableTags.length ? availableTags.map(tag => <span className='tag-chip' key={tag}>{tag}</span>) : <span className='section-note'>暂无标签</span>}
          </div>

          <div className='student-tag-list'>
            {students.map(student => (
              <div className='student-tag-row' key={student.accountId}>
                <div className='student-tag-main'>
                  <div className='student-tag-name'>{student.name || student.accountId}</div>
                  <div className='section-note'>学号：{student.accountId}</div>
                  <div className='tag-chip-list row-tags'>
                    {student.tags.length ? student.tags.map(tag => <span className='tag-chip' key={tag}>{tag}</span>) : <span className='section-note'>暂无标签</span>}
                  </div>
                </div>
                <button className='btn' type='button' onClick={() => onEdit(student)}>编辑标签</button>
              </div>
            ))}
          </div>

          {!loading && !students.length ? <p className='empty-state'>暂无学生数据。</p> : null}
        </div>

        {editingStudent ? <div className='tag-edit-backdrop' role='dialog' aria-modal='true' aria-labelledby='tag-edit-title' onClick={onCancelEdit}>
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
            <textarea rows={4} value={editingTagsText} onChange={e => setEditingTagsText(e.target.value)} placeholder='输入标签，支持逗号、中文逗号、顿号、空格或换行分隔；清空后保存表示无标签' />
            <p className='section-note' style={{ marginTop: 8 }}>重复标签会自动合并。</p>
            <div className='tag-edit-actions'>
              <button className='btn' type='button' onClick={onSaveTags} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
              <button className='btn btn-secondary' type='button' onClick={onCancelEdit} disabled={saving}>取消</button>
            </div>
          </div>
        </div> : null}
      </>}
    </div>
  )
}
