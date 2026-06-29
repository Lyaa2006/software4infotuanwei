const STORAGE_KEY = 'mp_web_session'

function normalizeApiBaseUrl(input) {
  let base = String(input || '').trim()
  if (!base) return ''
  base = base.replace(/\/+$/, '')
  if (/\/api$/i.test(base)) base = base.replace(/\/api$/i, '')
  return base.replace(/\/+$/, '')
}

function getBaseUrl() {
  // In development use relative paths so Vite dev-server proxy (configured for '/api') will forward requests
  // to the backend and avoid CORS issues. In production use VITE_API_BASE or default to http://localhost:3001
  if (import.meta.env && import.meta.env.DEV) {
    return ''
  }
  return normalizeApiBaseUrl(import.meta.env.VITE_API_BASE || '')
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

function setSession(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || null))
}

function logout() {
  localStorage.removeItem(STORAGE_KEY)
}

async function request({ method = 'GET', path = '/', data = null, auth = true }) {
  const url = `${getBaseUrl()}${path}`
  const opts = { method, headers: {} }
  if (data && !(data instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(data)
  } else if (data instanceof FormData) {
    opts.body = data
  }
  if (auth) {
    const s = getSession()
    if (s?.token) opts.headers['Authorization'] = `Bearer ${s.token}`
  }
  const res = await fetch(url, opts)
  const text = await res.text()
  try {
    const obj = JSON.parse(text)
    if (!obj?.success) {
      const err = new Error(obj?.message || '请求失败')
      err.code = obj?.code || 'REQUEST_FAILED'
      err.status = res.status
      err.debug = obj?.debug
      Object.assign(err, obj || {})
      throw err
    }
    return obj.data
  } catch (e) {
    // if not json or parse error
      if (!res.ok) {
        // include response text to aid debugging (may contain validation messages)
        const err = new Error(`HTTP ${res.status}: ${text}`)
        err.code = 'HTTP_ERROR'
        err.status = res.status
        err.body = text
        throw err
      }
      // response was ok but not JSON-parsable, return raw text
      return text
  }
}

async function j({ method = 'GET', path = '/', data = null, auth = true }) {
  return await request({ method, path, data, auth })
}

async function loginWithAccount({ role, accountId, password }) {
  const data = await request({ method: 'POST', path: '/api/auth/login', data: { role, accountId, password }, auth: false })
  const session = { token: data.token, role: data.user?.role, accountId: data.user?.accountId, loginAt: data.loginAt }
  setSession(session)
  return { user: data.user, isNew: data.isNew }
}

async function resetPassword({ role, accountId, newPassword, confirmPassword }) {
  return await request({
    method: 'POST',
    path: '/api/auth/reset-password',
    data: { role, accountId, newPassword, confirmPassword },
    auth: false,
  })
}

async function sendResetPasswordCode({ role = 'student', accountId }) {
  return await request({
    method: 'POST',
    path: '/api/auth/reset-password/send-code',
    data: { role, accountId },
    auth: false,
  })
}

async function resetPasswordByCode({ role = 'student', accountId, code, newPassword, confirmPassword }) {
  return await request({
    method: 'POST',
    path: '/api/auth/reset-password/by-code',
    data: { role, accountId, code, newPassword, confirmPassword },
    auth: false,
  })
}

function buildQuery(params) {
  const parts = []
  for (const [k, v] of Object.entries(params || {})) {
    const s = String(v ?? '').trim()
    if (!s) continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

async function uploadFile(path, file, fieldName = 'file', extra = {}) {
  const form = new FormData()
  form.append(fieldName, file)
  for (const [k, v] of Object.entries(extra || {})) {
    form.append(k, v)
  }
  return await request({ method: 'POST', path, data: form, auth: true })
}

const featureApi = {
  async authMe() { return await request({ method: 'GET', path: '/api/auth/me', auth: true }) },
  async intelligentPolicyQA({ question }) { return await request({ method: 'POST', path: '/api/qa/ask', data: { question: String(question ?? '') }, auth: true }) },
  async knowledgeQaList() { return await request({ method: 'GET', path: '/api/qa', auth: true }) },
  async knowledgeQaUpsert({ id, question, answer, keywords }) {
    const normalized = Array.isArray(keywords) ? keywords : []
    if (id) return await request({ method: 'PUT', path: `/api/qa/${encodeURIComponent(id)}`, data: { question: String(question ?? ''), answer: String(answer ?? ''), keywords: normalized }, auth: true })
    return await request({ method: 'POST', path: '/api/qa', data: { question: String(question ?? ''), answer: String(answer ?? ''), keywords: normalized }, auth: true })
  },
  async knowledgeQaDelete({ id }) { return await request({ method: 'DELETE', path: `/api/qa/${encodeURIComponent(String(id ?? ''))}`, auth: true }) },

  async partyStudentMe() { return await request({ method: 'GET', path: '/api/party/student/me', auth: true }) },
  async partyAdminStudents() { return await request({ method: 'GET', path: '/api/party/admin/students', auth: true }) },
  async partyAdminStudentDetail({ accountId }) { const a = String(accountId ?? '').trim(); return await request({ method: 'GET', path: `/api/party/admin/students/${encodeURIComponent(a)}`, auth: true }) },
  async partyAdminStudentSave({ accountId, profile }) { const a = String(accountId ?? '').trim(); return await request({ method: 'PUT', path: `/api/party/admin/students/${encodeURIComponent(a)}`, data: profile || {}, auth: true }) },

  async reminderMyList() { return await request({ method: 'GET', path: '/api/reminder/my', auth: true }) },
  async reminderMyMarkRead({ id }) { const i = String(id ?? '').trim(); return await request({ method: 'POST', path: `/api/reminder/my/${encodeURIComponent(i)}/read`, auth: true }) },
  async reminderAdminMessages() { return await request({ method: 'GET', path: '/api/reminder/admin/messages', auth: true }) },
  async reminderAdminSend({ title, content, targetType, targetTags }) { const tt = targetType === 'tags' ? 'tags' : 'all'; const tags = Array.isArray(targetTags) ? targetTags : []; return await request({ method: 'POST', path: '/api/reminder/admin/messages', data: { title: String(title ?? ''), content: String(content ?? ''), targetType: tt, targetTags: tags }, auth: true }) },
  async reminderAdminSendEmail({ title, content, targetType, targetTags, targetAccounts }) { const tt = targetType === 'tags' || targetType === 'batch' ? targetType : 'all'; const tags = Array.isArray(targetTags) ? targetTags : []; const accounts = Array.isArray(targetAccounts) ? targetAccounts : []; return await request({ method: 'POST', path: '/api/reminder/admin/email', data: { title: String(title ?? ''), content: String(content ?? ''), targetType: tt, targetTags: tags, targetAccounts: accounts }, auth: true }) },
  async reminderAdminStudents() { return await request({ method: 'GET', path: '/api/reminder/admin/students', auth: true }) },
  async reminderAdminStudentTagsSave({ accountId, tags }) { const a = String(accountId ?? '').trim(); const t = Array.isArray(tags) ? tags : []; return await request({ method: 'PUT', path: `/api/reminder/admin/students/${encodeURIComponent(a)}/tags`, data: { tags: t }, auth: true }) },

  async certTemplateList() { return await request({ method: 'GET', path: '/api/cert/templates', auth: true }) },
  async certAdminTemplateList() { return await request({ method: 'GET', path: '/api/cert/admin/templates', auth: true }) },
  // supports base64 upload (as in mini program)
  async certAdminTemplateUpload({ title, category, format, fileName, fileBase64 }) { const fmt = format === 'xlsx' ? 'xlsx' : format === 'txt' ? 'txt' : 'html'; return await request({ method: 'POST', path: '/api/cert/admin/templates', data: { title: String(title ?? ''), category: String(category ?? ''), format: fmt, fileName: String(fileName ?? ''), fileBase64: String(fileBase64 ?? '') }, auth: true }) },
  async certAdminTemplateDelete({ id }) { const i = String(id ?? '').trim(); return await request({ method: 'DELETE', path: `/api/cert/admin/templates/${encodeURIComponent(i)}`, auth: true }) },
  async certTemplateFields({ id }) { const i = String(id ?? '').trim(); return await request({ method: 'GET', path: `/api/cert/templates/${encodeURIComponent(i)}/fields`, auth: true }) },
  certTemplateFileDownloadUrl(id) { return `/api/cert/templates/${encodeURIComponent(id)}/file` },
  certTemplatePdfUrl(id, params) { const q = buildQuery(params); return `/api/cert/templates/${encodeURIComponent(id)}/pdf${q}` },

  async academicPlans() { return await request({ method: 'GET', path: '/api/academic/plans', auth: true }) },
  async academicStudentReport({ semester, planName }) { const q = buildQuery({ semester, planName }); return await request({ method: 'GET', path: `/api/academic/student/report${q}`, auth: true }) },
  async academicAdminPlans() { return await request({ method: 'GET', path: '/api/academic/admin/plans', auth: true }) },
  async academicAdminPlanCreate({ name, modules }) { return await request({ method: 'POST', path: '/api/academic/admin/plans', data: { name: String(name ?? ''), modules: modules ?? [] }, auth: true }) },
  async academicAdminPlanUpdate({ id, name, modules }) { const i = String(id ?? '').trim(); return await request({ method: 'PUT', path: `/api/academic/admin/plans/${encodeURIComponent(i)}`, data: { name: String(name ?? ''), modules: modules ?? [] }, auth: true }) },
  async academicAdminPlanDelete({ id }) { const i = String(id ?? '').trim(); return await request({ method: 'DELETE', path: `/api/academic/admin/plans/${encodeURIComponent(i)}`, auth: true }) },
  async academicAdminSemesterCourses({ semester }) { const q = buildQuery({ semester }); return await request({ method: 'GET', path: `/api/academic/admin/semester-courses${q}`, auth: true }) },
  async academicAdminSemesterCoursesSave({ semester, items }) { return await request({ method: 'POST', path: '/api/academic/admin/semester-courses', data: { semester: String(semester ?? ''), items: Array.isArray(items) ? items : [] }, auth: true }) },

  async honorUsers() { return await request({ method: 'GET', path: '/api/honor/users', auth: true }) },
  async honorUserDetail({ accountId }) { const a = String(accountId ?? '').trim(); return await request({ method: 'GET', path: `/api/honor/users/${encodeURIComponent(a)}`, auth: true }) },
  async honorMyList() { return await request({ method: 'GET', path: '/api/honor/me', auth: true }) },
  async honorMyCreate({ title, description, issuer, honorDate, imagePath, isPublic }) { return await request({ method: 'POST', path: '/api/honor/me', data: { title: String(title ?? ''), description: String(description ?? ''), issuer: String(issuer ?? ''), honorDate: String(honorDate ?? ''), imagePath: String(imagePath ?? ''), isPublic: isPublic !== false }, auth: true }) },
  async honorMyUpdate({ id, title, description, issuer, honorDate, imagePath, isPublic }) { const i = String(id ?? '').trim(); return await request({ method: 'PUT', path: `/api/honor/me/${encodeURIComponent(i)}`, data: { title: String(title ?? ''), description: String(description ?? ''), issuer: String(issuer ?? ''), honorDate: String(honorDate ?? ''), imagePath: String(imagePath ?? ''), isPublic: isPublic !== false }, auth: true }) },
  async honorMyDelete({ id }) { const i = String(id ?? '').trim(); return await request({ method: 'DELETE', path: `/api/honor/me/${encodeURIComponent(i)}`, auth: true }) },
  async honorMyUpload(file) { return await uploadFile('/api/honor/me/upload', file, 'file') },

  async activityMyList() { return await request({ method: 'GET', path: '/api/activity/me', auth: true }) },
  async activityCadreMine() { return await request({ method: 'GET', path: '/api/activity/cadre/mine', auth: true }) },
  async activityCadreCreate({ title, summary, activityDate, targetTag, photoPaths, participants }) { return await request({ method: 'POST', path: '/api/activity/cadre', data: { title: String(title ?? ''), summary: String(summary ?? ''), activityDate: String(activityDate ?? ''), targetTag: String(targetTag ?? ''), photoPaths: Array.isArray(photoPaths) ? photoPaths : [], participants: participants || {} }, auth: true }) },
  async activityCadreUpdate({ id, title, summary, activityDate, targetTag, photoPaths, participants }) { const i = String(id ?? '').trim(); return await request({ method: 'PUT', path: `/api/activity/cadre/${encodeURIComponent(i)}`, data: { title: String(title ?? ''), summary: String(summary ?? ''), activityDate: String(activityDate ?? ''), targetTag: String(targetTag ?? ''), photoPaths: Array.isArray(photoPaths) ? photoPaths : [], participants: participants || {} }, auth: true }) },
  async activityCadreDelete({ id }) { const i = String(id ?? '').trim(); return await request({ method: 'DELETE', path: `/api/activity/cadre/${encodeURIComponent(i)}`, auth: true }) },
  async activityAdminPending() { return await request({ method: 'GET', path: '/api/activity/admin/pending', auth: true }) },
  async activityAdminApprove({ id, reviewed_by }) { const i = String(id ?? '').trim(); const s = getSession(); const by = String(reviewed_by ?? '').trim() || String(s?.accountId ?? '').trim(); return await request({ method: 'POST', path: `/api/activity/admin/${encodeURIComponent(i)}/approve`, data: by ? { reviewed_by: by } : null, auth: true }) },
  async activityAdminReject({ id, reason, reviewed_by }) { const i = String(id ?? '').trim(); const s = getSession(); const by = String(reviewed_by ?? '').trim() || String(s?.accountId ?? '').trim(); return await request({ method: 'POST', path: `/api/activity/admin/${encodeURIComponent(i)}/reject`, data: by ? { reason: String(reason ?? ''), reviewed_by: by } : { reason: String(reason ?? '') }, auth: true }) },
  async activityCadreUpload(file) { return await uploadFile('/api/activity/cadre/upload', file, 'file') },
}

export default { getBaseUrl, j, auth: { loginWithAccount, resetPassword, sendResetPasswordCode, resetPasswordByCode, getSession, logout, setSession }, featureApi }
export { getSession, logout }
