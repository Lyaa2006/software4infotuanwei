const STORAGE_KEYS = {
  session: "session_v1",
  apiBaseUrl: "api_base_url_v1",
};

const DEFAULT_BASE_URL = "http://10.10.0.5:3001";

function getBaseUrl() {
  const app = typeof getApp === "function" ? getApp() : null;
  const globalBaseUrl = String(app?.globalData?.apiBaseUrl || "").trim();
  if (globalBaseUrl) return globalBaseUrl.replace(/\/+$/, "");

  const storedBaseUrl = String(wx.getStorageSync(STORAGE_KEYS.apiBaseUrl) || "").trim();
  if (storedBaseUrl) return storedBaseUrl.replace(/\/+$/, "");

  return DEFAULT_BASE_URL;
}

function setBaseUrl(baseUrl) {
  const normalized = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    wx.removeStorageSync(STORAGE_KEYS.apiBaseUrl);
    return;
  }
  wx.setStorageSync(STORAGE_KEYS.apiBaseUrl, normalized);
}

function normalizeAccountId(accountId) {
  return String(accountId ?? "").trim();
}

function request({ method, path, data, auth }) {
  return new Promise((resolve, reject) => {
    const session = getSession();
    const headers = {};
    if (auth && session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    wx.request({
      url: `${getBaseUrl()}${path}`,
      method,
      data,
      header: headers,
      success: (res) => {
        const payload = res?.data;
        if (!payload?.success) {
          const err = new Error(payload?.message || "请求失败");
          err.code = payload?.code || "REQUEST_FAILED";
          err.status = Number(res?.statusCode || 0) || 0;
          err.debug = payload?.debug;
          reject(err);
          return;
        }
        resolve(payload.data);
      },
      fail: (e) => {
        const err = new Error(e?.errMsg || "网络请求失败");
        err.code = "NETWORK_ERROR";
        reject(err);
      },
    });
  });
}

async function loginWithAccount({ role, accountId, password }) {
  const normalizedRole = role === "admin" ? "admin" : "student";
  const normalizedAccountId = normalizeAccountId(accountId);
  const normalizedPassword = String(password ?? "");

  if (!normalizedAccountId) {
    const err = new Error("请输入学工号");
    err.code = "EMPTY_ACCOUNT";
    throw err;
  }
  if (!normalizedPassword) {
    const err = new Error("请输入密码");
    err.code = "EMPTY_PASSWORD";
    throw err;
  }

  const result = await request({
    method: "POST",
    path: "/api/auth/login",
    data: {
      role: normalizedRole,
      accountId: normalizedAccountId,
      password: normalizedPassword,
    },
    auth: false,
  });

  wx.setStorageSync(STORAGE_KEYS.session, {
    token: result.token,
    role: result.user.role,
    accountId: result.user.accountId,
    loginAt: result.loginAt,
  });

  return { user: result.user, isNew: result.isNew };
}

function getSession() {
  return wx.getStorageSync(STORAGE_KEYS.session) || null;
}

function logout() {
  wx.removeStorageSync(STORAGE_KEYS.session);
}

const featureApi = {
  async intelligentPolicyQA({ question }) {
    return await request({
      method: "POST",
      path: "/api/qa/ask",
      data: { question: String(question ?? "") },
      auth: true,
    });
  },
  async knowledgeQaList() {
    return await request({
      method: "GET",
      path: "/api/qa",
      data: {},
      auth: true,
    });
  },
  async knowledgeQaUpsert({ id, question, answer, keywords }) {
    const normalizedKeywords = Array.isArray(keywords) ? keywords : [];
    if (id) {
      return await request({
        method: "PUT",
        path: `/api/qa/${encodeURIComponent(id)}`,
        data: {
          question: String(question ?? ""),
          answer: String(answer ?? ""),
          keywords: normalizedKeywords,
        },
        auth: true,
      });
    }
    return await request({
      method: "POST",
      path: "/api/qa",
      data: {
        question: String(question ?? ""),
        answer: String(answer ?? ""),
        keywords: normalizedKeywords,
      },
      auth: true,
    });
  },
  async knowledgeQaDelete({ id }) {
    return await request({
      method: "DELETE",
      path: `/api/qa/${encodeURIComponent(String(id ?? ""))}`,
      data: {},
      auth: true,
    });
  },
  async partyStudentMe() {
    return await request({
      method: "GET",
      path: "/api/party/student/me",
      data: {},
      auth: true,
    });
  },
  async partyAdminStudents() {
    return await request({
      method: "GET",
      path: "/api/party/admin/students",
      data: {},
      auth: true,
    });
  },
  async partyAdminStudentDetail({ accountId }) {
    const normalized = normalizeAccountId(accountId);
    return await request({
      method: "GET",
      path: `/api/party/admin/students/${encodeURIComponent(normalized)}`,
      data: {},
      auth: true,
    });
  },
  async partyAdminStudentSave({ accountId, profile }) {
    const normalized = normalizeAccountId(accountId);
    return await request({
      method: "PUT",
      path: `/api/party/admin/students/${encodeURIComponent(normalized)}`,
      data: profile || {},
      auth: true,
    });
  },
  async partyLeagueProcess({ payload }) {
    const session = getSession();
    const normalized = normalizeAccountId(payload?.accountId);
    if (session?.role === "admin" && normalized) {
      return await request({
        method: "GET",
        path: `/api/party/admin/students/${encodeURIComponent(normalized)}`,
        data: {},
        auth: true,
      });
    }
    return await request({
      method: "GET",
      path: "/api/party/student/me",
      data: {},
      auth: true,
    });
  },
  async reminderMyList() {
    return await request({
      method: "GET",
      path: "/api/reminder/my",
      data: {},
      auth: true,
    });
  },
  async reminderMyMarkRead({ id }) {
    const normalizedId = String(id ?? "").trim();
    return await request({
      method: "POST",
      path: `/api/reminder/my/${encodeURIComponent(normalizedId)}/read`,
      data: {},
      auth: true,
    });
  },
  async reminderAdminMessages() {
    return await request({
      method: "GET",
      path: "/api/reminder/admin/messages",
      data: {},
      auth: true,
    });
  },
  async reminderAdminSend({ title, content, targetType, targetTags }) {
    const normalizedType = targetType === "tags" ? "tags" : "all";
    const normalizedTags = Array.isArray(targetTags) ? targetTags : [];
    return await request({
      method: "POST",
      path: "/api/reminder/admin/messages",
      data: {
        title: String(title ?? ""),
        content: String(content ?? ""),
        targetType: normalizedType,
        targetTags: normalizedTags,
      },
      auth: true,
    });
  },
  async reminderAdminStudents() {
    return await request({
      method: "GET",
      path: "/api/reminder/admin/students",
      data: {},
      auth: true,
    });
  },
  async reminderAdminStudentTagsSave({ accountId, tags }) {
    const normalized = normalizeAccountId(accountId);
    const normalizedTags = Array.isArray(tags) ? tags : [];
    return await request({
      method: "PUT",
      path: `/api/reminder/admin/students/${encodeURIComponent(normalized)}/tags`,
      data: { tags: normalizedTags },
      auth: true,
    });
  },
  async certTemplateList() {
    return await request({
      method: "GET",
      path: "/api/cert/templates",
      data: {},
      auth: true,
    });
  },
  async certAdminTemplateList() {
    return await request({
      method: "GET",
      path: "/api/cert/admin/templates",
      data: {},
      auth: true,
    });
  },
  async certAdminTemplateUpload({ title, category, format, fileName, fileBase64 }) {
    const normalizedFormat = format === "xlsx" ? "xlsx" : format === "txt" ? "txt" : "html";
    return await request({
      method: "POST",
      path: "/api/cert/admin/templates",
      data: {
        title: String(title ?? ""),
        category: String(category ?? ""),
        format: normalizedFormat,
        fileName: String(fileName ?? ""),
        fileBase64: String(fileBase64 ?? ""),
      },
      auth: true,
    });
  },
  async certAdminTemplateDelete({ id }) {
    return await request({
      method: "DELETE",
      path: `/api/cert/admin/templates/${encodeURIComponent(String(id ?? ""))}`,
      data: {},
      auth: true,
    });
  },
  async academicPlans() {
    return await request({
      method: "GET",
      path: "/api/academic/plans",
      data: {},
      auth: true,
    });
  },
  async academicStudentReport({ semester, planName }) {
    const q = String(semester ?? "").trim();
    const p = String(planName ?? "").trim();
    const parts = [];
    if (q) parts.push(`semester=${encodeURIComponent(q)}`);
    if (p) parts.push(`planName=${encodeURIComponent(p)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    return await request({
      method: "GET",
      path: `/api/academic/student/report${qs}`,
      data: {},
      auth: true,
    });
  },
  async academicAdminPlans() {
    return await request({
      method: "GET",
      path: "/api/academic/admin/plans",
      data: {},
      auth: true,
    });
  },
  async academicAdminPlanCreate({ name, modules }) {
    return await request({
      method: "POST",
      path: "/api/academic/admin/plans",
      data: { name: String(name ?? ""), modules: modules ?? [] },
      auth: true,
    });
  },
  async academicAdminPlanUpdate({ id, name, modules }) {
    const normalizedId = String(id ?? "").trim();
    return await request({
      method: "PUT",
      path: `/api/academic/admin/plans/${encodeURIComponent(normalizedId)}`,
      data: { name: String(name ?? ""), modules: modules ?? [] },
      auth: true,
    });
  },
  async academicAdminPlanDelete({ id }) {
    const normalizedId = String(id ?? "").trim();
    return await request({
      method: "DELETE",
      path: `/api/academic/admin/plans/${encodeURIComponent(normalizedId)}`,
      data: {},
      auth: true,
    });
  },
  async academicAdminSemesterCourses({ semester }) {
    const q = String(semester ?? "").trim();
    const qs = q ? `?semester=${encodeURIComponent(q)}` : "";
    return await request({
      method: "GET",
      path: `/api/academic/admin/semester-courses${qs}`,
      data: {},
      auth: true,
    });
  },
  async academicAdminSemesterCoursesSave({ semester, items }) {
    return await request({
      method: "POST",
      path: "/api/academic/admin/semester-courses",
      data: { semester: String(semester ?? ""), items: Array.isArray(items) ? items : [] },
      auth: true,
    });
  },
  async honorUsers() {
    return await request({
      method: "GET",
      path: "/api/honor/users",
      data: {},
      auth: true,
    });
  },
  async honorUserDetail({ accountId }) {
    const normalized = normalizeAccountId(accountId);
    return await request({
      method: "GET",
      path: `/api/honor/users/${encodeURIComponent(normalized)}`,
      data: {},
      auth: true,
    });
  },
  async honorMyList() {
    return await request({
      method: "GET",
      path: "/api/honor/me",
      data: {},
      auth: true,
    });
  },
  async honorMyCreate({ title, description, issuer, honorDate, imagePath, isPublic }) {
    return await request({
      method: "POST",
      path: "/api/honor/me",
      data: {
        title: String(title ?? ""),
        description: String(description ?? ""),
        issuer: String(issuer ?? ""),
        honorDate: String(honorDate ?? ""),
        imagePath: String(imagePath ?? ""),
        isPublic: isPublic !== false,
      },
      auth: true,
    });
  },
  async honorMyUpdate({ id, title, description, issuer, honorDate, imagePath, isPublic }) {
    const normalizedId = String(id ?? "").trim();
    return await request({
      method: "PUT",
      path: `/api/honor/me/${encodeURIComponent(normalizedId)}`,
      data: {
        title: String(title ?? ""),
        description: String(description ?? ""),
        issuer: String(issuer ?? ""),
        honorDate: String(honorDate ?? ""),
        imagePath: String(imagePath ?? ""),
        isPublic: isPublic !== false,
      },
      auth: true,
    });
  },
  async honorMyDelete({ id }) {
    const normalizedId = String(id ?? "").trim();
    return await request({
      method: "DELETE",
      path: `/api/honor/me/${encodeURIComponent(normalizedId)}`,
      data: {},
      auth: true,
    });
  },
  async activityMyList() {
    return await request({
      method: "GET",
      path: "/api/activity/me",
      data: {},
      auth: true,
    });
  },
  async activityCadreMine() {
    return await request({
      method: "GET",
      path: "/api/activity/cadre/mine",
      data: {},
      auth: true,
    });
  },
  async activityCadreCreate({ title, summary, activityDate, targetTag, photoPaths, participants }) {
    return await request({
      method: "POST",
      path: "/api/activity/cadre",
      data: {
        title: String(title ?? ""),
        summary: String(summary ?? ""),
        activityDate: String(activityDate ?? ""),
        targetTag: String(targetTag ?? ""),
        photoPaths: Array.isArray(photoPaths) ? photoPaths : [],
        participants: participants || {},
      },
      auth: true,
    });
  },
  async activityCadreUpdate({ id, title, summary, activityDate, targetTag, photoPaths, participants }) {
    const normalizedId = String(id ?? "").trim();
    return await request({
      method: "PUT",
      path: `/api/activity/cadre/${encodeURIComponent(normalizedId)}`,
      data: {
        title: String(title ?? ""),
        summary: String(summary ?? ""),
        activityDate: String(activityDate ?? ""),
        targetTag: String(targetTag ?? ""),
        photoPaths: Array.isArray(photoPaths) ? photoPaths : [],
        participants: participants || {},
      },
      auth: true,
    });
  },
  async activityAdminPending() {
    return await request({
      method: "GET",
      path: "/api/activity/admin/pending",
      data: {},
      auth: true,
    });
  },
  async activityAdminApprove({ id }) {
    const normalizedId = String(id ?? "").trim();
    const session = getSession();
    const reviewedBy = normalizeAccountId(session?.accountId);
    return await request({
      method: "POST",
      path: `/api/activity/admin/${encodeURIComponent(normalizedId)}/approve`,
      data: reviewedBy ? { reviewed_by: reviewedBy } : {},
      auth: true,
    });
  },
  async activityAdminReject({ id, reason, reviewed_by }) {
    const normalizedId = String(id ?? "").trim();
    const session = getSession();
    const reviewedBy = normalizeAccountId(reviewed_by) || normalizeAccountId(session?.accountId);
    return await request({
      method: "POST",
      path: `/api/activity/admin/${encodeURIComponent(normalizedId)}/reject`,
      data: reviewedBy ? { reason: String(reason ?? ""), reviewed_by: reviewedBy } : { reason: String(reason ?? "") },
      auth: true,
    });
  },
};

module.exports = {
  getBaseUrl,
  setBaseUrl,
  auth: {
    loginWithAccount,
    getSession,
    logout,
  },
  featureApi,
};
