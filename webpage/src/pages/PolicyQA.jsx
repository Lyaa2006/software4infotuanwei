import React, { useEffect, useState } from 'react'
import api from '../services/api'

export default function PolicyQA() {
  const [answer, setAnswer] = useState('')
  const [question, setQuestion] = useState('')

  // admin states
  const [isAdmin, setIsAdmin] = useState(false)
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [formQuestion, setFormQuestion] = useState('')
  const [formAnswer, setFormAnswer] = useState('')
  const [formKeywords, setFormKeywords] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = api.auth.getSession()
    const role = s?.role
    setIsAdmin(role === 'admin')
    if (role === 'admin') loadList()
  }, [])

  async function ask() {
    try {
      const r = await api.featureApi.intelligentPolicyQA({ question })
      setAnswer(r.answer || JSON.stringify(r))
    } catch (e) { setAnswer('错误') }
  }

  async function loadList() {
    if (loadingList) return
    setLoadingList(true)
    try {
      const r = await api.featureApi.knowledgeQaList()
      const arr = Array.isArray(r.items) ? r.items : []
      setItems(arr)
    } catch (e) {
      alert(e?.message || '获取失败')
    } finally {
      setLoadingList(false)
    }
  }

  function onFormQuestionInput(e) { setFormQuestion(e.target.value) }
  function onFormAnswerInput(e) { setFormAnswer(e.target.value) }
  function onFormKeywordsInput(e) { setFormKeywords(e.target.value) }

  function onResetForm() {
    setEditingId('')
    setFormQuestion('')
    setFormAnswer('')
    setFormKeywords('')
  }

  async function onSave() {
    if (saving) return
    const q = String(formQuestion || '').trim()
    const a = String(formAnswer || '').trim()
    const keywords = String(formKeywords || '').split(/[，,]/).map(s => s.trim()).filter(Boolean)
    if (!q) { alert('请填写标准问题'); return }
    if (!a) { alert('请填写标准答案'); return }
    setSaving(true)
    try {
      await api.featureApi.knowledgeQaUpsert({ id: editingId, question: q, answer: a, keywords })
      onResetForm()
      await loadList()
      alert('已保存')
    } catch (e) { alert(e?.message || '保存失败') }
    finally { setSaving(false) }
  }

  function onEdit(item) {
    setEditingId(item._id || item.id || '')
    setFormQuestion(item.question || '')
    setFormAnswer(item.answer || '')
    setFormKeywords(Array.isArray(item.keywords) ? item.keywords.join(',') : '')
  }

  async function onDelete(id) {
    if (!id) return
    if (!confirm('确认删除，无法恢复？')) return
    try {
      await api.featureApi.knowledgeQaDelete({ id })
      await loadList()
      if (editingId === id) onResetForm()
      alert('已删除')
    } catch (e) { alert(e?.message || '删除失败') }
  }

  return (
    <div className="container">
      <h2>智能问答</h2>
      <div className="card">
        <input className="input" value={question} onChange={e => setQuestion(e.target.value)} placeholder="输入问题" />
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={ask}>提问</button>
        </div>
        <pre style={{ marginTop: 12 }}>{answer}</pre>
      </div>

      {isAdmin && <div className="card" style={{ marginTop: 12 }}>
        <h3>管理员：知识问答管理</h3>
        <div>
          <div><button className="btn" onClick={loadList}>{loadingList ? '加载中...' : '刷新列表'}</button></div>
          <ul style={{ marginTop: 8 }}>{items.map(it => (
            <li key={it._id || it.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ fontWeight: 600 }}>{it.question}</div>
              <div style={{ color: '#666', marginTop: 6 }}>{it.answer}</div>
              <div style={{ marginTop: 6 }}>
                <button className="btn" onClick={() => onEdit(it)}>编辑</button>
                <button className="btn" style={{ marginLeft: 8 }} onClick={() => onDelete(it._id || it.id)}>删除</button>
              </div>
            </li>
          ))}</ul>
        </div>

        <div style={{ marginTop: 8 }}>
          <div><input placeholder="标准问题" value={formQuestion} onChange={onFormQuestionInput} style={{ width: '100%' }} /></div>
          <div style={{ marginTop: 8 }}><textarea rows={6} style={{ width: '100%' }} placeholder='标准答案' value={formAnswer} onChange={onFormAnswerInput} /></div>
          <div style={{ marginTop: 8 }}><input placeholder='关键词，用逗号分隔' value={formKeywords} onChange={onFormKeywordsInput} style={{ width: '100%' }} /></div>
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={onSave}>{saving ? '保存中...' : '保存'}</button>
            <button className="btn" style={{ marginLeft: 8 }} onClick={onResetForm}>重置</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
