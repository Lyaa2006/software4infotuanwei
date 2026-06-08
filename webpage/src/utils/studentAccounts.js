// Student-account helpers used by Web pages that render student-only lists.
//
// Important boundary:
// - These helpers are defensive UI guards only.
// - The backend remains the authority for student identity.
// - A real student account is defined server-side by permitted_accounts where
//   role='student' and enabled=TRUE.
//
// Why this file exists:
// Several pages consume records that are joined from party_students, reminder
// tag data, or activity participant data. Those tables can contain historical
// dirty rows, so every page that renders a student management list should use a
// shared guard instead of open-coding role checks.

const STUDENT_ROLE_VALUES = new Set(['student'])
const NON_STUDENT_ROLE_VALUES = new Set(['admin', 'administrator', 'teacher', 'staff'])

function cleanString(value) {
  return String(value ?? '').trim()
}

function cleanLower(value) {
  return cleanString(value).toLowerCase()
}

function firstNonEmpty(values) {
  for (const value of values || []) {
    const clean = cleanString(value)
    if (clean) return clean
  }
  return ''
}

function readRole(record) {
  return firstNonEmpty([
    record?.role,
    record?.accountRole,
    record?.type,
    record?.accountType,
  ])
}

function readBooleanStudentFlag(record) {
  if (record?.isStudent === true) return true
  if (record?.isStudent === false) return false
  if (record?.student === true) return true
  if (record?.student === false) return false
  return null
}

function readBooleanAdminFlag(record) {
  if (record?.isAdmin === true) return true
  if (record?.admin === true) return true
  return false
}

export function getStudentAccountId(record) {
  return firstNonEmpty([
    record?.accountId,
    record?.studentId,
    record?.id,
  ])
}

export function getStudentName(record) {
  return firstNonEmpty([
    record?.name,
    record?.studentName,
    record?.displayName,
    record?.nickname,
  ])
}

export function formatStudentDisplayName(record) {
  const accountId = getStudentAccountId(record)
  const name = getStudentName(record)
  if (name && accountId) return `${name}（${accountId}）`
  return name || accountId || '未命名学生'
}

export function getStudentRecordRole(record) {
  return readRole(record)
}

export function isExplicitStudentRecord(record) {
  const flag = readBooleanStudentFlag(record)
  if (flag === true) return true

  const role = cleanLower(readRole(record))
  return STUDENT_ROLE_VALUES.has(role)
}

export function isExplicitNonStudentRecord(record) {
  const flag = readBooleanStudentFlag(record)
  if (flag === false) return true
  if (readBooleanAdminFlag(record)) return true

  const role = cleanLower(readRole(record))
  return NON_STUDENT_ROLE_VALUES.has(role)
}

export function isStudentRecord(record) {
  if (!record || typeof record !== 'object') return false
  if (!getStudentAccountId(record)) return false
  if (isExplicitNonStudentRecord(record)) return false
  if (isExplicitStudentRecord(record)) return true

  // Backward compatibility for older endpoints that returned only accountId,
  // name and tags. Newer backend responses include role/isStudent, but keeping
  // this fallback prevents existing clean student rows from disappearing during
  // staged deployment. Non-student rows with explicit role/admin markers are
  // still filtered above.
  return true
}

export function filterStudentRecords(records) {
  return (Array.isArray(records) ? records : []).filter(isStudentRecord)
}

export function splitStudentRecords(records) {
  const students = []
  const filtered = []
  for (const record of Array.isArray(records) ? records : []) {
    if (isStudentRecord(record)) students.push(record)
    else filtered.push(record)
  }
  return { students, filtered }
}

export function countFilteredNonStudentRecords(records) {
  return splitStudentRecords(records).filtered.length
}

export function explainFilteredNonStudentRecord(record) {
  if (!record || typeof record !== 'object') return '记录为空或格式无效'
  const accountId = getStudentAccountId(record) || '(缺少账号)'
  const role = readRole(record)
  if (!getStudentAccountId(record)) return `账号 ${accountId} 缺少 accountId/studentId 字段`
  if (readBooleanAdminFlag(record)) return `账号 ${accountId} 标记为管理员，不展示为学生`
  if (readBooleanStudentFlag(record) === false) return `账号 ${accountId} 明确标记为非学生`
  if (role) return `账号 ${accountId} 的角色为 ${role}，不是学生角色`
  return `账号 ${accountId} 未通过学生账号展示规则`
}

export function explainFilteredNonStudentRecords(records) {
  return splitStudentRecords(records).filtered.map(explainFilteredNonStudentRecord)
}

export function logFilteredNonStudentRecords(scope, records) {
  const messages = explainFilteredNonStudentRecords(records)
  if (!messages.length) return
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug(`[student-scope:${scope}] filtered ${messages.length} non-student record(s)`, messages)
  }
}

export function normalizeStudentRecord(record) {
  const accountId = getStudentAccountId(record)
  return {
    ...record,
    accountId,
    role: cleanString(record?.role || 'student'),
    isStudent: true,
    displayName: formatStudentDisplayName({ ...record, accountId }),
  }
}

export function normalizeStudentRecords(records) {
  return filterStudentRecords(records).map(normalizeStudentRecord)
}

// Backward-compatible names used by the previous round of changes.
export const isStudentAccountRecord = isStudentRecord
export const filterStudentAccountRecords = filterStudentRecords
