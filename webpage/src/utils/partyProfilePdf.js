function pad2(value) {
  return String(value).padStart(2, '0')
}

function toIsoDate(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''

  const normalized = text
    .replace(/[./]/g, '-')
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, '')

  const match = normalized.match(/(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})/)
  if (!match) return ''
  const [, year, month, day] = match
  const mm = Number(month)
  const dd = Number(day)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  return `${year}-${pad2(mm)}-${pad2(dd)}`
}

function sanitizeText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectDateMatches(text, labels) {
  const labelPattern = `(?:${labels.map(escapeRegex).join('|')})`
  const datePattern = '((?:19|20)\\d{2}[年./-]\\d{1,2}[月./-]\\d{1,2}日?)'
  const regex = new RegExp(`${labelPattern}[：: ]{0,3}[^\\n]{0,20}?${datePattern}`, 'g')
  const values = []
  for (const match of text.matchAll(regex)) {
    const value = toIsoDate(match[1])
    if (value) values.push(value)
  }
  return [...new Set(values)]
}

function firstUniqueDate(text, labels) {
  const candidates = collectDateMatches(text, labels)
  return {
    value: candidates[0] || '',
    candidates,
  }
}

function extractName(text) {
  const match = text.match(/姓名[：: ]{0,3}([^\n ，,。；;]{2,12})/)
  return String(match?.[1] || '').trim()
}

export function extractPartyProfileFromPdfText(text) {
  const normalized = sanitizeText(text)
  const config = {
    applicationDate: ['入党申请时间', '申请入党时间', '提交入党申请书时间', '入党申请日期'],
    activistDate: ['确定为入党积极分子时间', '入党积极分子时间', '积极分子时间', '列为入党积极分子时间'],
    devObjectDate: ['确定为发展对象时间', '发展对象时间', '列为发展对象时间'],
    probationaryDate: ['接收为预备党员时间', '成为预备党员时间', '预备党员时间', '接收预备党员时间'],
    probationaryFullYearDate: ['预备期满时间', '预备期满转正时间', '预备期满日期', '预备党员转正时间'],
    fullMemberDate: ['转为正式党员时间', '按期转正时间', '正式党员时间', '转正时间'],
  }

  const fields = { name: extractName(normalized) }
  const evidence = {}

  for (const [field, labels] of Object.entries(config)) {
    const matched = firstUniqueDate(normalized, labels)
    fields[field] = matched.value
    evidence[field] = matched.candidates
  }

  const warnings = []
  const filledFieldCount = Object.entries(fields).filter(([, value]) => value).length
  if (!filledFieldCount) warnings.push('未识别到可直接回填的字段，可能是扫描件或文档表述方式不同。')
  if (!fields.name) warnings.push('未识别出姓名，建议人工确认。')

  return {
    fields,
    evidence,
    warnings,
    normalizedText: normalized,
  }
}
