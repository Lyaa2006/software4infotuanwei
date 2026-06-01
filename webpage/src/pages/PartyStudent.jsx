import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function ymdToCn(ymd) {
  const s = String(ymd ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const [y, m, d] = s.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function buildTopLines(profile) {
  const name = String(profile?.name || '').trim() || `${profile?.accountId || ''}`
  const a1 = ymdToCn(profile?.applicationDate)
  const a2 = ymdToCn(profile?.activistDate)
  const a3 = ymdToCn(profile?.devObjectDate)
  const status = String(profile?.currentStatus || '').trim()

  const parts = []
  if (a1) parts.push(`你于${a1}提交入党申请书`)
  if (a2) parts.push(`${a2}成为入党积极分子`)
  if (a3) parts.push(`${a3}成为发展对象`)

  const head = `${name}同学，${parts.length ? parts.join('，') : '请完善入党发展信息'}${status ? `，目前${status}。` : '。'}`

  const extras = []
  if (profile?.activistDate) {
    const reportDue = ymdToCn(profile?.nextReportDue)
    const talkDue = ymdToCn(profile?.nextTalkDue)
    extras.push(`自成为入党积极分子后，每三个月需要提交一次思想汇报，下次提交时间不晚于${reportDue || '未设置'}；`)
    extras.push(`每半年需进行一次谈话，下次谈话时间不晚于${talkDue || '未设置'}。`)
  }
  return { head, extras }
}

function buildNodes(stages, currentStageIndex) {
  const list = Array.isArray(stages) ? stages : []
  return list.map((s, idx) => {
    let state = 'todo'
    if (idx < currentStageIndex) state = 'done'
    else if (idx === currentStageIndex) state = 'current'
    return { ...s, index: idx, state }
  })
}

function nodeDetail(node, profile) {
  const defs = {
    group_assessment: {
      title: '通过党课学习小组考核阶段任务',
      lines: ['参加党课学习小组学习', '完成规定内容学习', '通过学习小组考核'],
    },
    activist: { title: '入党积极分子阶段任务', lines: ['参加培养教育', '每三个月提交一次思想汇报', '每半年进行一次谈话'] },
    dev_object: { title: '发展对象阶段任务', lines: ['参加校党校学习', '完成规定课时', '通过结业考试'] },
    probationary: { title: '预备党员阶段任务', lines: ['参加组织生活', '持续提交思想汇报', '按期参加谈话与考察'] },
    full_member: { title: '正式入党说明', lines: ['已完成转正流程', '继续参加组织生活'] },
  }
  const d = defs[node.value] || defs.group_assessment
  const todo = node.index === (profile?.currentStageIndex || 0) ? [`待办：下次提交不晚于 ${profile?.nextReportDue || '未设置'}`, `待办：下次谈话不晚于 ${profile?.nextTalkDue || '未设置'}`] : []
  return { title: d.title, content: d.lines.concat(todo).join('\n') }
}

export default function PartyStudent() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [nodes, setNodes] = useState([])
  const [topHead, setTopHead] = useState('')
  const [topExtras, setTopExtras] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await api.featureApi.partyStudentMe()
      const p = r.profile || null
      const stages = r.stages || []
      const currentStageIndex = Number(p?.currentStageIndex || 0)
      setProfile(p)
      setNodes(buildNodes(stages, currentStageIndex))
      const top = buildTopLines(p)
      setTopHead(top.head)
      setTopExtras(top.extras)
    } catch (e) {
      // silent
    }
  }

  function onTapNode(node) {
    const detail = nodeDetail(node, profile || {})
    alert(`${node.label}\n\n${detail.title}\n${detail.content}`)
  }

  return (
    <div className="container">
      <div className="page-toolbar">
      <h2>党团进度</h2>
        <button className="btn btn-secondary back-home-btn" type="button" onClick={() => navigate('/')}>返回首页</button>
      </div>
      <div className="card">
        <p>{topHead}</p>
        {topExtras.map((x, i) => <p key={i} style={{ color: '#6b7280' }}>{x}</p>)}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>发展流程</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {nodes.map(n => (
            <div key={n.index} onClick={() => onTapNode(n)} style={{ padding: 12, borderRadius: 8, background: n.state === 'done' ? '#ecfdf5' : n.state === 'current' ? '#fff7ed' : '#f8fafc', cursor: 'pointer', minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{n.label}</div>
              <div style={{ color: '#6b7280', marginTop: 6 }}>{n.value}</div>
              <div style={{ marginTop: 8, color: '#111827' }}>{n.state === 'current' ? '当前阶段' : n.state === 'done' ? '已完成' : '待办理'}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 12, color: '#6b7280' }}>提示：点击阶段查看任务与待办</p>
      </div>
    </div>
  )
}
