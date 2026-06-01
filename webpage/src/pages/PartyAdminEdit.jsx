import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

function normalizeYmd(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return ''
  return s
}

function validatePartyDateOrder(profile) {
  const pairs = [
    ['入党申请时间', normalizeYmd(profile?.applicationDate)],
    ['确定为入党积极分子时间', normalizeYmd(profile?.activistDate)],
    ['确定为发展对象时间', normalizeYmd(profile?.devObjectDate)],
    ['接收为预备党员时间', normalizeYmd(profile?.probationaryDate)],
    ['预备期满一年时间', normalizeYmd(profile?.probationaryFullYearDate)],
    ['转为正式党员时间', normalizeYmd(profile?.fullMemberDate)],
  ].filter(([, value]) => !!value)
  for (let i = 1; i < pairs.length; i += 1) {
    const [prevLabel, prevValue] = pairs[i - 1]
    const [currLabel, currValue] = pairs[i]
    if (prevValue > currValue) return `${currLabel}不能早于${prevLabel}`
  }
  return ''
}

function stageIndex(stages, value) {
  const idx = (stages || []).findIndex(x => x.value === value)
  return idx >= 0 ? idx : 0
}

function stageFromDates(profile) {
  const fullMember = normalizeYmd(profile?.fullMemberDate)
  const probationaryFull = normalizeYmd(profile?.probationaryFullYearDate)
  const probationary = normalizeYmd(profile?.probationaryDate)
  const devObject = normalizeYmd(profile?.devObjectDate)
  const activist = normalizeYmd(profile?.activistDate)
  if (fullMember) return 'full_member'
  if (probationaryFull) return 'probationary_full_year'
  if (probationary) return 'probationary'
  if (devObject) return 'dev_object'
  if (activist) return 'activist'
  return 'group_assessment'
}

function stageStatus(stages, value) {
  return (stages || []).find(x => x.value === value)?.status || ''
}

export default function PartyAdminEdit() {
  const { accountId } = useParams()
  const nav = useNavigate()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stages, setStages] = useState([])
  const [stagePickerIndex, setStagePickerIndex] = useState(0)
  const [today, setToday] = useState('')
  const [statusTouched, setStatusTouched] = useState(false)
  const [nextReportTouched, setNextReportTouched] = useState(false)
  const [nextTalkTouched, setNextTalkTouched] = useState(false)

  const [profile, setProfile] = useState({
    name: '',
    applicationDate: '',
    activistDate: '',
    devObjectDate: '',
    probationaryDate: '',
    probationaryFullYearDate: '',
    fullMemberDate: '',
    currentStage: 'group_assessment',
    currentStatus: '',
    nextReportDue: '',
    nextTalkDue: '',
  })

  useEffect(() => {
    const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); setToday(`${y}-${m}-${day}`)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  async function load() {
    if (loading) return
    setLoading(true)
    try {
      const r = await api.featureApi.partyAdminStudentDetail({ accountId })
      const s = r.stages || []
      const p = r.profile || {}
      const nextProfile = {
        name: String(p.name || ''),
        applicationDate: String(p.applicationDate || ''),
        activistDate: String(p.activistDate || ''),
        devObjectDate: String(p.devObjectDate || ''),
        probationaryDate: String(p.probationaryDate || ''),
        probationaryFullYearDate: String(p.probationaryFullYearDate || ''),
        fullMemberDate: String(p.fullMemberDate || ''),
        currentStage: String(p.currentStage || 'group_assessment'),
        currentStatus: String(p.currentStatus || ''),
        nextReportDue: String(p.nextReportDue || ''),
        nextTalkDue: String(p.nextTalkDue || ''),
      }
      setStages(s)
      setProfile(nextProfile)
      setStatusTouched(false)
      setNextReportTouched(false)
      setNextTalkTouched(false)
      setStagePickerIndex(stageIndex(s, nextProfile.currentStage))
    } catch (e) {
      alert(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  function setProfileField(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  function onNameInput(e) { setProfileField('name', e.target.value) }
  function onStatusInput(e) { setStatusTouched(true); setProfileField('currentStatus', e.target.value) }

  function onDateChange(field, value) { setProfileField(field, value); onAfterDateChanged() }

  function onAfterDateChanged() {
    const computed = stageFromDates(profile)
    setProfileField('currentStage', computed)
    setStagePickerIndex(stageIndex(stages, computed))
    if (!statusTouched) {
      const s = stageStatus(stages, computed)
      if (s) setProfileField('currentStatus', s)
    }
  }

  function onStageChange(e) {
    const idx = Number(e.target.value || 0)
    const stage = stages?.[idx]?.value || 'group_assessment'
    setProfileField('currentStage', stage)
    setStagePickerIndex(idx)
    if (!statusTouched) {
      const s = stageStatus(stages, stage)
      if (s) setProfileField('currentStatus', s)
    }
  }

  function onNextDueChange(field, value) {
    if (field === 'nextReportDue') setNextReportTouched(true)
    if (field === 'nextTalkDue') setNextTalkTouched(true)
    setProfileField(field, value)
  }

  async function onSave() {
    if (saving) return
    const invalidPartyDate = [
      ['入党申请时间', profile.applicationDate],
      ['确定为入党积极分子时间', profile.activistDate],
      ['确定为发展对象时间', profile.devObjectDate],
      ['接收为预备党员时间', profile.probationaryDate],
      ['预备期满一年时间', profile.probationaryFullYearDate],
      ['转为正式党员时间', profile.fullMemberDate],
      ['思想汇报截止日期', profile.nextReportDue],
      ['谈话截止日期', profile.nextTalkDue],
    ].find(([, value]) => String(value || '').trim() && !normalizeYmd(value))
    if (invalidPartyDate) return alert(`${invalidPartyDate[0]}格式错误或日期无效，应为真实的 YYYY-MM-DD`)
    const dateOrderError = validatePartyDateOrder(profile)
    if (dateOrderError) return alert(dateOrderError)
    setSaving(true)
    try {
      const payload = {
        ...profile,
        applicationDate: normalizeYmd(profile.applicationDate) || '',
        activistDate: normalizeYmd(profile.activistDate) || '',
        devObjectDate: normalizeYmd(profile.devObjectDate) || '',
        probationaryDate: normalizeYmd(profile.probationaryDate) || '',
        probationaryFullYearDate: normalizeYmd(profile.probationaryFullYearDate) || '',
        fullMemberDate: normalizeYmd(profile.fullMemberDate) || '',
        nextReportDue: normalizeYmd(profile.nextReportDue) || '',
        nextTalkDue: normalizeYmd(profile.nextTalkDue) || '',
      }
      if (!nextReportTouched && !payload.nextReportDue) delete payload.nextReportDue
      if (!nextTalkTouched && !payload.nextTalkDue) delete payload.nextTalkDue
      const resp = await api.featureApi.partyAdminStudentSave({ accountId, profile: payload })
      const next = resp.profile || null
      if (next) {
        const np = {
          name: String(next.name || ''),
          applicationDate: String(next.applicationDate || ''),
          activistDate: String(next.activistDate || ''),
          devObjectDate: String(next.devObjectDate || ''),
          probationaryDate: String(next.probationaryDate || ''),
          probationaryFullYearDate: String(next.probationaryFullYearDate || ''),
          fullMemberDate: String(next.fullMemberDate || ''),
          currentStage: String(next.currentStage || 'group_assessment'),
          currentStatus: String(next.currentStatus || ''),
          nextReportDue: String(next.nextReportDue || ''),
          nextTalkDue: String(next.nextTalkDue || ''),
        }
        setProfile(np)
        setStagePickerIndex(stageIndex(stages, String(next.currentStage || 'group_assessment')))
      }
      alert('已保存')
    } catch (e) {
      alert(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  function onBackToList() { nav(-1) }

  return (
    <div className="container">
      <h2>编辑学生：{accountId}</h2>
      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <label>姓名: <input value={profile.name} onChange={onNameInput} /></label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div>入党申请日期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.applicationDate || ''} onChange={e => onDateChange('applicationDate', e.target.value)} />
          </div>
          <div>
            <div>入党积极分子日期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.activistDate || ''} onChange={e => onDateChange('activistDate', e.target.value)} />
          </div>
          <div>
            <div>发展对象日期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.devObjectDate || ''} onChange={e => onDateChange('devObjectDate', e.target.value)} />
          </div>
          <div>
            <div>预备党员日期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.probationaryDate || ''} onChange={e => onDateChange('probationaryDate', e.target.value)} />
          </div>
          <div>
            <div>预备期满转正日期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.probationaryFullYearDate || ''} onChange={e => onDateChange('probationaryFullYearDate', e.target.value)} />
          </div>
          <div>
            <div>正式党员日期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.fullMemberDate || ''} onChange={e => onDateChange('fullMemberDate', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>当前阶段: <select value={stagePickerIndex} onChange={onStageChange}>{stages.map((s, i) => <option key={s.value || i} value={i}>{s.title || s.value}</option>)}</select></label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>当前状态: <input value={profile.currentStatus} onChange={onStatusInput} /></label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <div>下次述职到期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.nextReportDue || ''} onChange={e => onNextDueChange('nextReportDue', e.target.value)} />
          </div>
          <div>
            <div>下次谈话到期</div>
            <input className="input" placeholder="YYYY-MM-DD" value={profile.nextTalkDue || ''} onChange={e => onNextDueChange('nextTalkDue', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={onSave}>{saving ? '保存中...' : '保存'}</button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={onBackToList}>返回</button>
        </div>
      </div>
    </div>
  )
}
