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

function buildAuthHeader(session) {
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

function buildLocalId(prefix, extra) {
  return `${prefix}-${Date.now()}-${extra || ""}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyCourse() {
  return {
    localId: buildLocalId("course"),
    code: "",
    name: "",
    credits: "",
  };
}

function createEmptyModule() {
  return {
    localId: buildLocalId("module"),
    name: "",
    requiredCredits: "",
    courses: [createEmptyCourse()],
  };
}

function normalizePlanModules(modules) {
  const list = Array.isArray(modules) ? modules : [];
  return list.map((module, moduleIndex) => ({
    localId: buildLocalId("module", moduleIndex),
    name: String(module?.name ?? "").trim(),
    requiredCredits: String(module?.requiredCredits ?? ""),
    courses: (Array.isArray(module?.courses) ? module.courses : []).map((course, courseIndex) => ({
      localId: buildLocalId("course", `${moduleIndex}-${courseIndex}`),
      code: String(course?.code ?? "").trim(),
      name: String(course?.name ?? "").trim(),
      credits: String(course?.credits ?? ""),
    })),
  }));
}

function serializePlanModules(modules) {
  return (Array.isArray(modules) ? modules : [])
    .map((module) => ({
      name: String(module?.name ?? "").trim(),
      requiredCredits: Number(String(module?.requiredCredits ?? "").trim() || 0),
      courses: (Array.isArray(module?.courses) ? module.courses : [])
        .map((course) => ({
          code: String(course?.code ?? "").trim(),
          name: String(course?.name ?? "").trim(),
          credits: Number(String(course?.credits ?? "").trim() || 0),
        }))
        .filter((course) => course.code || course.name),
    }))
    .filter((module) => module.name || module.courses.length);
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
    showPlanEditor: false,
    planEditingId: "",
    planFormName: "",
    planFormModules: [createEmptyModule()],
    savingPlan: false,
    importingPlan: false,
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    const semester = this.data.semester || defaultSemesterFromNow();
    this.setData({
      isAdmin: session.role === "admin",
      isStudent: session.role === "student",
      semester,
    });
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
    this.setData({ planIndex: idx, selectedPlanName: selected }, () => {
      this.loadReport();
    });
  },

  onPlanNameInput(e) {
    this.setData({ planFormName: e.detail.value });
  },

  onModuleNameInput(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    this.updateModuleField(moduleIndex, "name", e.detail.value);
  },

  onModuleCreditsInput(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    this.updateModuleField(moduleIndex, "requiredCredits", e.detail.value);
  },

  onCourseCodeInput(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    const courseIndex = Number(e.currentTarget.dataset.courseIndex);
    this.updateCourseField(moduleIndex, courseIndex, "code", e.detail.value);
  },

  onCourseNameInput(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    const courseIndex = Number(e.currentTarget.dataset.courseIndex);
    this.updateCourseField(moduleIndex, courseIndex, "name", e.detail.value);
  },

  onCourseCreditsInput(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    const courseIndex = Number(e.currentTarget.dataset.courseIndex);
    this.updateCourseField(moduleIndex, courseIndex, "credits", e.detail.value);
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

  async loadPlans(editingId) {
    const api = require("../../services/api");
    const resp = await api.featureApi.academicAdminPlans();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const currentEditingId =
      editingId === undefined ? String(this.data.planEditingId || "") : String(editingId || "");
    const mapped = items.map((x) => ({
      ...x,
      planKey: String(x._id || x.id || ""),
      isEditing: currentEditingId && currentEditingId === String(x._id || x.id || ""),
      updatedAtText: formatDateTime(x.updatedAt),
    }));
    this.setData({ plans: mapped });
  },

  applyPlanToEditor({ id = "", name = "", modules = [] }) {
    const normalized = normalizePlanModules(modules);
    this.setData({
      showPlanEditor: true,
      planEditingId: String(id || ""),
      planFormName: String(name || ""),
      planFormModules: normalized.length ? normalized : [createEmptyModule()],
    });
  },

  onCreatePlan() {
    this.setData({
      showPlanEditor: true,
      planEditingId: "",
      planFormName: "",
      planFormModules: [createEmptyModule()],
    });
  },

  onResetPlanForm() {
    this.setData({
      showPlanEditor: false,
      planEditingId: "",
      planFormName: "",
      planFormModules: [createEmptyModule()],
    });
  },

  onImportPlanFile() {
    if (this.data.importingPlan) return;
    const draftName = String(this.data.planFormName || "").trim();
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
        const importName = draftName || String(file.name || "").replace(/\.[^.]+$/, "") || "imported";
        this.setData({ importingPlan: true });
        wx.showLoading({ title: "导入中..." });
        try {
          const r = await new Promise((resolve) => {
            wx.uploadFile({
              url,
              filePath: file.path,
              name: "file",
              formData: {
                name: importName,
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
          const data = obj?.data || {};
          this.applyPlanToEditor({
            id: data.id,
            name: data.name || importName,
            modules: data.modules || [],
          });
          wx.showToast({ title: "已导入", icon: "success" });
          await this.loadPlans(String(data.id || ""));
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
    if (String(this.data.planEditingId || "") === id) {
      this.onResetPlanForm();
      this.loadPlans("");
      return;
    }
    const found = (this.data.plans || []).find((x) => String(x.planKey || "") === id);
    if (!found) return;
    this.applyPlanToEditor({
      id: found.planKey || "",
      name: found.name || "",
      modules: found.modules || [],
    });
    this.loadPlans(found.planKey || "");
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
          if (String(this.data.planEditingId) === String(id)) {
            this.onResetPlanForm();
          }
        } catch (e2) {
          wx.showToast({ title: e2?.message || "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  updateModuleField(moduleIndex, field, value) {
    const list = (this.data.planFormModules || []).map((module, index) => {
      if (index !== moduleIndex) return module;
      return { ...module, [field]: value };
    });
    this.setData({ planFormModules: list });
  },

  updateCourseField(moduleIndex, courseIndex, field, value) {
    const list = (this.data.planFormModules || []).map((module, mIndex) => {
      if (mIndex !== moduleIndex) return module;
      const courses = (module.courses || []).map((course, cIndex) => {
        if (cIndex !== courseIndex) return course;
        return { ...course, [field]: value };
      });
      return { ...module, courses };
    });
    this.setData({ planFormModules: list });
  },

  onAddModule() {
    this.setData({
      planFormModules: [...(this.data.planFormModules || []), createEmptyModule()],
    });
  },

  onRemoveModule(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    const current = Array.isArray(this.data.planFormModules) ? this.data.planFormModules : [];
    const next = current.filter((_, index) => index !== moduleIndex);
    this.setData({ planFormModules: next.length ? next : [createEmptyModule()] });
  },

  onAddCourse(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    const list = (this.data.planFormModules || []).map((module, index) => {
      if (index !== moduleIndex) return module;
      return {
        ...module,
        courses: [...(Array.isArray(module.courses) ? module.courses : []), createEmptyCourse()],
      };
    });
    this.setData({ planFormModules: list });
  },

  onRemoveCourse(e) {
    const moduleIndex = Number(e.currentTarget.dataset.moduleIndex);
    const courseIndex = Number(e.currentTarget.dataset.courseIndex);
    const list = (this.data.planFormModules || []).map((module, mIndex) => {
      if (mIndex !== moduleIndex) return module;
      const currentCourses = Array.isArray(module.courses) ? module.courses : [];
      const nextCourses = currentCourses.filter((_, index) => index !== courseIndex);
      return {
        ...module,
        courses: nextCourses.length ? nextCourses : [createEmptyCourse()],
      };
    });
    this.setData({ planFormModules: list });
  },

  async onSavePlan() {
    if (this.data.savingPlan) return;
    const name = String(this.data.planFormName || "").trim();
    if (!name) {
      wx.showToast({ title: "请填写方案名称", icon: "none" });
      return;
    }

    const modules = serializePlanModules(this.data.planFormModules);
    if (!modules.length) {
      wx.showToast({ title: "请至少填写一个模块或课程", icon: "none" });
      return;
    }
    if (modules.some((module) => !module.name)) {
      wx.showToast({ title: "请填写每个模块的名称", icon: "none" });
      return;
    }
    if (modules.some((module) => module.courses.some((course) => !course.name))) {
      wx.showToast({ title: "请填写课程名称后再保存", icon: "none" });
      return;
    }

    this.setData({ savingPlan: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      let finalId = this.data.planEditingId;
      if (this.data.planEditingId) {
        await api.featureApi.academicAdminPlanUpdate({
          id: this.data.planEditingId,
          name,
          modules,
        });
      } else {
        const resp = await api.featureApi.academicAdminPlanCreate({ name, modules });
        finalId = resp?.id ? String(resp.id) : "";
      }
      wx.showToast({ title: "已保存", icon: "success" });
      this.applyPlanToEditor({ id: finalId, name, modules });
      await this.loadPlans(finalId);
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ savingPlan: false });
    }
  },
});
