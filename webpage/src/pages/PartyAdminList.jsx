import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { formatStudentDisplayName, logFilteredNonStudentRecords, normalizeStudentRecords } from '../utils/studentAccounts'

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.map((tag) => String(tag || '').trim()).filter(Boolean) : []
}

function formatDateText(value) {
  const clean = String(value || '').trim()
  return clean || '暂无'
}

function formatStudentName(item) {
  const clean = String(item?.name || '').trim()
  return clean || '未填写'
}

function renderTags(tags) {
  const normalized = normalizeTags(tags)
  if (!normalized.length) return <span className='tag-pill tag-pill-muted'>暂无标签</span>
  return normalized.map((tag) => <span className='tag-pill' key={tag}>{tag}</span>)
}

function renderStageBadge(item) {
  const label = String(item?.currentStageLabel || item?.currentStage || '').trim()
  if (!label) return <span className='badge amber'>未设置阶段</span>
  return <span className='badge green'>{label}</span>
}

export default function PartyAdminList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const nav = useNavigate()
  const studentCountText = useMemo(() => '共 ' + items.length + ' 位学生', [items.length])

  useEffect(() => { load() }, [])

  async function load() {
    if (loading) return
    setLoading(true)
    setErrorText('')
    try {
      const r = await api.featureApi.partyAdminStudents()
      // The backend is the authority for student scope; this page keeps a
      // defensive frontend guard so historical dirty rows never become visible.
      logFilteredNonStudentRecords('party-admin-list', r.items)
      setItems(normalizeStudentRecords(r.items))
    } catch (e) {
      setItems([])
      setErrorText(e?.message || '加载党团学生列表失败')
    } finally {
      setLoading(false)
    }
  }

  function openStudentEditor(accountId) {
    const clean = String(accountId || '').trim()
    if (!clean) return
    nav('/party/admin/edit/' + encodeURIComponent(clean))
  }

  function promptAndOpenEditor() {
    const v = prompt('请输入学生学号')
    if (!v) return
    openStudentEditor(v)
  }

  function renderLoadingState() {
    if (!loading) return null
    return (
      <div className='empty-state party-admin-list-state' role='status'>
        正在加载学生列表，请稍候...
      </div>
    )
  }

  function renderErrorState() {
    if (!errorText) return null
    return (
      <div className='empty-state party-admin-list-state party-admin-list-error' role='alert'>
        {errorText}
      </div>
    )
  }

  function renderEmptyState() {
    if (loading || errorText || items.length) return null
    return (
      <div className='empty-state party-admin-list-state'>
        暂无学生数据。请确认学生账号已在权限清单中启用。
      </div>
    )
  }

  function renderStudentRow(item) {
    const accountId = String(item.accountId || '').trim()
    const displayName = formatStudentDisplayName(item)

    return (
      <article className='student-list-row' key={accountId || displayName}>
        <div className='student-list-cell student-list-identity'>
          <span className='student-list-label'>学号</span>
          <button
            className='student-list-account'
            type='button'
            onClick={() => openStudentEditor(accountId)}
            title={'编辑 ' + displayName}
          >
            {accountId || '未填写'}
          </button>
        </div>

        <div className='student-list-cell'>
          <span className='student-list-label'>姓名</span>
          <span className='student-list-value strong'>{formatStudentName(item)}</span>
        </div>

        <div className='student-list-cell'>
          <span className='student-list-label'>党团阶段</span>
          <span className='student-list-stage'>{renderStageBadge(item)}</span>
        </div>

        <div className='student-list-cell student-list-tags-cell'>
          <span className='student-list-label'>标签</span>
          <div className='student-list-tags'>{renderTags(item.tags)}</div>
        </div>

        <div className='student-list-cell student-list-dates'>
          <span className='student-list-label'>提醒节点</span>
          <span>思想汇报：{formatDateText(item.nextReportDue)}</span>
          <span>谈话：{formatDateText(item.nextTalkDue)}</span>
        </div>

        <div className='student-list-actions'>
          <button className='btn btn-secondary' type='button' onClick={() => openStudentEditor(accountId)}>
            编辑进度
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className='container party-admin-list-page'>
      <div className='page-toolbar party-admin-list-header'>
        <div>
          <h2>学生列表（管理员）</h2>
          <p className='party-admin-list-subtitle'>集中查看真实学生账号的党团阶段、标签和提醒节点。</p>
        </div>
        <button className='btn btn-secondary back-home-btn' type='button' onClick={() => nav('/')}>返回首页</button>
      </div>

      <section className='card party-admin-list-card'>
        <div className='admin-list-toolbar'>
          <div>
            <p className='admin-list-eyebrow'>党团管理对象</p>
            <strong>{loading ? '正在加载学生数据...' : studentCountText}</strong>
          </div>
          <div className='admin-list-actions'>
            <button className='btn btn-secondary' type='button' onClick={load} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
            <button className='btn' type='button' onClick={promptAndOpenEditor}>添加/编辑学生</button>
          </div>
        </div>

        {renderLoadingState()}
        {renderErrorState()}
        {renderEmptyState()}

        {!loading && !errorText && items.length ? (
          <div className='student-list-table' aria-label='党团管理员学生列表'>
            <div className='student-list-head' aria-hidden='true'>
              <span>学号</span>
              <span>姓名</span>
              <span>党团阶段</span>
              <span>标签</span>
              <span>提醒节点</span>
              <span>操作</span>
            </div>
            <div className='student-list-body'>
              {items.map(renderStudentRow)}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
