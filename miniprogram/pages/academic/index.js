function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateTime(ts) {
  const n = Number(ts || 0);
  if (!n) return "";
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function defaultSemesterFromNow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m <= 7 ? `${y}-春` : `${y}-秋`;
}

function tryParseJson(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
}

function splitCsvLine(line) {
  const s = String(line ?? "");
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '"') {
      if (inQuote && s[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (!inQuote && ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => String(x ?? "").trim());
}

function parseSemesterCoursesCsv(text) {
  const lines = String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => String(x).trim())
    .filter(Boolean);
  const out = [];
  for (const line of lines) {
    const cols = splitCsvLine(line);
    const courseCode = String(cols[0] ?? "").trim();
    const courseName = String(cols[1] ?? "").trim();
    const credits = Number(String(cols[2] ?? "").trim() || 0);
    const moduleName = String(cols[3] ?? "").trim();
    if (!courseCode && !courseName) continue;
    out.push({ courseCode, courseName, credits, moduleName });
  }
  return out;
}

function buildAuthHeader(session) {
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

Page({
  data: {
    isAdmin: false,
    isStudent: false,
    semester: "",
    planNames: [],
    planIndex: 0,
    selectedPlanName: "",
    loading: false,
    uploading: false,
    reportLoaded: false,
    report: {
      hasTranscript: false,
      planName: "",
      transcriptCreatedAtText: "",
      modules: [],
      missingCourses: [],
      recommendations: [],
    },
    plans: [],
    planEditingId: "",
    planFormName: "",
    planFormModulesJson: "",
    savingPlan: false,
    importingPlan: false,
    adminSemester: "",
    semesterCoursesCsv: "",
    savingSemesterCourses: false,
    semesterCoursesLoadedCount: 0,
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    const semester = this.data.semester || defaultSemesterFromNow();
    this.setData({ isAdmin: session.role === "admin", isStudent: session.role === "student", semester });
    this.reloadAll();
  },

  async reloadAll() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      if (this.data.isStudent) {
        await this.loadPlanOptions();
        await this.loadReport();
      }
      if (this.data.isAdmin) {
        await this.loadPlans();
      }
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  onSemesterInput(e) {
    this.setData({ semester: e.detail.value });
  },

  onPlanPickerChange(e) {
    const idx = Number(e.detail.value || 0);
    const names = Array.isArray(this.data.planNames) ? this.data.planNames : [];
    const selected = String(names[idx] ?? "");
    this.setData({ planIndex: idx, selectedPlanName: selected });
    this.loadReport();
  },

  onAdminSemesterInput(e) {
    this.setData({ adminSemester: e.detail.value });
  },

  onPlanNameInput(e) {
    this.setData({ planFormName: e.detail.value });
  },

  onPlanModulesInput(e) {
    this.setData({ planFormModulesJson: e.detail.value });
  },

  onSemesterCoursesInput(e) {
    this.setData({ semesterCoursesCsv: e.detail.value });
  },

  onReload() {
    this.reloadAll();
  },

  async loadPlanOptions() {
    const api = require("../../services/api");
    const resp = await api.featureApi.academicPlans();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const names = items.map((x) => String(x.name ?? "")).filter(Boolean);

    let selected = String(this.data.selectedPlanName || "").trim();
    if (!selected && names.length === 1) selected = names[0];
    let idx = names.findIndex((x) => x === selected);
    if (idx < 0) idx = 0;
    const finalSelected = selected && names.includes(selected) ? selected : names[idx] || "";
    this.setData({ planNames: names, planIndex: idx, selectedPlanName: finalSelected });
  },

  async loadReport() {
    const api = require("../../services/api");
    const resp = await api.featureApi.academicStudentReport({
      semester: this.data.semester,
      planName: this.data.selectedPlanName,
    });
    const report = {
      hasTranscript: !!resp.hasTranscript,
      planName: String(resp.planName ?? ""),
      transcriptCreatedAtText: resp.transcript?.createdAt ? formatDateTime(resp.transcript.createdAt) : "",
      modules: Array.isArray(resp.modules) ? resp.modules : [],
      missingCourses: Array.isArray(resp.missingCourses) ? resp.missingCourses : [],
      recommendations: Array.isArray(resp.recommendations) ? resp.recommendations : [],
    };
    this.setData({ reportLoaded: true, report });
  },

  onChooseTranscript() {
    if (this.data.uploading) return;
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const baseUrl = api.getBaseUrl();
    const semester = String(this.data.semester || "").trim();
    const planName = String(this.data.selectedPlanName || "").trim();
    const parts = [];
    if (semester) parts.push(`semester=${encodeURIComponent(semester)}`);
    if (planName) parts.push(`planName=${encodeURIComponent(planName)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    const url = `${baseUrl}/api/academic/student/transcript/upload${qs}`;

    wx.chooseMessageFile({
      count: 1,
      type: "file",
      success: async (res) => {
        const file = (res?.tempFiles || [])[0] || null;
        if (!file?.path) return;
        this.setData({ uploading: true });
        wx.showLoading({ title: "解析中..." });
        try {
          const r = await new Promise((resolve) => {
            wx.uploadFile({
              url,
              filePath: file.path,
              name: "file",
              formData: {
                originalName: String(file.name || ""),
                originalMime: String(file.type || ""),
              },
              header: buildAuthHeader(session),
              success: (resp) => resolve(resp),
              fail: (err) => resolve({ err }),
            });
          });
          if (r?.err) throw new Error(r.err?.errMsg || "上传失败");
          const obj = tryParseJson(r.data);
          if (!obj?.success) throw new Error(obj?.message || "解析失败");
          wx.showToast({ title: "已解析", icon: "success" });
          await this.loadReport();
        } catch (e) {
          wx.showToast({ title: e?.message || "上传失败", icon: "none" });
        } finally {
          wx.hideLoading();
          this.setData({ uploading: false });
        }
      },
      fail: () => {},
    });
  },

  async loadPlans() {
    const api = require("../../services/api");
    const resp = await api.featureApi.academicAdminPlans();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => ({
      ...x,
      updatedAtText: formatDateTime(x.updatedAt),
    }));
    this.setData({ plans: mapped });
  },

  onResetPlanForm() {
    this.setData({ planEditingId: "", planFormName: "", planFormModulesJson: "" });
  },

  onImportPlanFile() {
    if (this.data.importingPlan) return;
    const name = String(this.data.planFormName || "").trim();
    if (!name) {
      wx.showToast({ title: "请先填写方案名称", icon: "none" });
      return;
    }

    const api = require("../../services/api");
    const session = api.auth.getSession();
    const baseUrl = api.getBaseUrl();
    const url = `${baseUrl}/api/academic/admin/plans/import`;

    wx.chooseMessageFile({
      count: 1,
      type: "file",
      success: async (res) => {
        const file = (res?.tempFiles || [])[0] || null;
        if (!file?.path) return;
        this.setData({ importingPlan: true });
        wx.showLoading({ title: "导入中..." });
        try {
          const r = await new Promise((resolve) => {
            wx.uploadFile({
              url,
              filePath: file.path,
              name: "file",
              formData: {
                name,
                originalName: String(file.name || ""),
                originalMime: String(file.type || ""),
              },
              header: buildAuthHeader(session),
              success: (resp) => resolve(resp),
              fail: (err) => resolve({ err }),
            });
          });
          if (r?.err) throw new Error(r.err?.errMsg || "上传失败");
          const obj = tryParseJson(r.data);
          if (!obj?.success) throw new Error(obj?.message || "导入失败");
          const modules = obj?.data?.modules || [];
          const id = obj?.data?.id || "";
          this.setData({
            planEditingId: String(id || ""),
            planFormModulesJson: JSON.stringify(modules, null, 2),
          });
          wx.showToast({ title: "已导入", icon: "success" });
          await this.loadPlans();
        } catch (e) {
          wx.showToast({ title: e?.message || "导入失败", icon: "none" });
        } finally {
          wx.hideLoading();
          this.setData({ importingPlan: false });
        }
      },
      fail: () => {},
    });
  },

  onEditPlan(e) {
    const id = String(e.currentTarget.dataset.id || "");
    const found = (this.data.plans || []).find((x) => String(x._id) === id);
    if (!found) return;
    this.setData({
      planEditingId: found._id,
      planFormName: found.name || "",
      planFormModulesJson: JSON.stringify(found.modules || [], null, 2),
    });
  },

  async onDeletePlan(e) {
    const id = String(e.currentTarget.dataset.id || "");
    if (!id) return;
    wx.showModal({
      title: "确认删除",
      content: "确认删除该培养方案？",
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: "删除中..." });
        try {
          const api = require("../../services/api");
          await api.featureApi.academicAdminPlanDelete({ id });
          wx.showToast({ title: "已删除", icon: "success" });
          await this.loadPlans();
          this.onResetPlanForm();
        } catch (e2) {
          wx.showToast({ title: e2?.message || "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  async onSavePlan() {
    if (this.data.savingPlan) return;
    const name = String(this.data.planFormName || "").trim();
    if (!name) {
      wx.showToast({ title: "请填写方案名称", icon: "none" });
      return;
    }
    let modules;
    try {
      modules = JSON.parse(String(this.data.planFormModulesJson || "").trim() || "[]");
    } catch {
      wx.showToast({ title: "modules JSON 不合法", icon: "none" });
      return;
    }
    if (!Array.isArray(modules)) {
      wx.showToast({ title: "modules 必须是数组", icon: "none" });
      return;
    }

    this.setData({ savingPlan: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      if (this.data.planEditingId) {
        await api.featureApi.academicAdminPlanUpdate({ id: this.data.planEditingId, name, modules });
      } else {
        await api.featureApi.academicAdminPlanCreate({ name, modules });
      }
      wx.showToast({ title: "已保存", icon: "success" });
      await this.loadPlans();
      this.onResetPlanForm();
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ savingPlan: false });
    }
  },

  async onLoadSemesterCourses() {
    const semester = String(this.data.adminSemester || "").trim() || defaultSemesterFromNow();
    wx.showLoading({ title: "加载中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.academicAdminSemesterCourses({ semester });
      const items = Array.isArray(resp.items) ? resp.items : [];
      const csv = items
        .map((x) => `${x.courseCode || ""},${x.courseName || ""},${x.credits || 0},${x.moduleName || ""}`)
        .join("\n");
      this.setData({ adminSemester: semester, semesterCoursesCsv: csv, semesterCoursesLoadedCount: items.length });
      wx.showToast({ title: "已加载", icon: "success" });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async onSaveSemesterCourses() {
    if (this.data.savingSemesterCourses) return;
    const semester = String(this.data.adminSemester || "").trim() || defaultSemesterFromNow();
    const items = parseSemesterCoursesCsv(this.data.semesterCoursesCsv);
    if (!items.length) {
      wx.showToast({ title: "课程列表为空", icon: "none" });
      return;
    }
    this.setData({ savingSemesterCourses: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      await api.featureApi.academicAdminSemesterCoursesSave({ semester, items });
      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({ adminSemester: semester });
      await this.onLoadSemesterCourses();
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ savingSemesterCourses: false });
    }
  },
});
