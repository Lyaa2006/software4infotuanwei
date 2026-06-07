function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYmd(ymd) {
  const s = String(ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
}

function isValidYmd(ymd) {
  const s = formatYmd(ymd);
  if (!s) return false;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
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

function parseIds(text) {
  const raw = String(text ?? "");
  const parts = raw.split(/[,，\n\r\t ]+/).map((x) => String(x).trim());
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    if (!p) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function buildAuthHeader(session) {
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

function joinUrl(baseUrl, p) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const path = String(p || "");
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function parseUploadResponseText(text) {
  try {
    const obj = JSON.parse(String(text || ""));
    if (obj?.success && obj?.data?.path) return { path: String(obj.data.path) };
    if (obj?.message) return { error: String(obj.message) };
    return { error: "上传失败" };
  } catch {
    return { error: "上传失败" };
  }
}

Page({
  data: {
    isAdmin: false,
    isStudent: false,
    isCadre: false,
    myItems: [],
    cadreItems: [],
    pendingItems: [],
    students: [],
    loading: false,
    saving: false,
    uploading: false,
    editingId: "",
    editingRejectReason: "",
    formTitle: "",
    formDate: "",
    formSummary: "",
    formTargetTag: "",
    formOrganizers: "",
    formParticipants: "",
    formHelpers: "",
    formPhotoPaths: [],
    formPhotos: [],
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    this.setData({ isAdmin: session.role === "admin", isStudent: session.role === "student" });
    this.reloadAll();
  },

  async reloadAll() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      await this.loadMyActivities();
      if (this.data.isStudent) {
        await this.tryLoadCadreMine();
      }
      if (this.data.isAdmin) {
        await this.loadPending();
        await this.loadStudents();
      }
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  async loadMyActivities() {
    const api = require("../../services/api");
    const resp = await api.featureApi.activityMyList();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => ({
      ...x,
      activityDateText: formatYmd(x.activityDate) || formatDateTime(x.updatedAt) || "",
      myRoleText: x.myRole === "organizer" ? "组织" : x.myRole === "helper" ? "协助" : "参与",
    }));
    this.setData({ myItems: mapped });
  },

  async tryLoadCadreMine() {
    const api = require("../../services/api");
    try {
      const resp = await api.featureApi.activityCadreMine();
      const items = Array.isArray(resp.items) ? resp.items : [];
      const mapped = items.map((x) => ({
        ...x,
        activityDateText: formatYmd(x.activityDate) || formatDateTime(x.updatedAt) || "",
        statusText: x.status === "approved" ? "已通过" : x.status === "rejected" ? "已驳回" : "待审核",
        canEdit: x.status !== "approved",
      }));
      this.setData({ isCadre: true, cadreItems: mapped });
    } catch (e) {
      this.setData({ isCadre: false, cadreItems: [] });
    }
  },

  async loadPending() {
    const api = require("../../services/api");
    const resp = await api.featureApi.activityAdminPending();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const baseUrl = api.getBaseUrl();
    const mapped = items.map((x) => ({
      ...x,
      activityDateText: formatYmd(x.activityDate) || formatDateTime(x.updatedAt) || "",
      photoUrls: (x.photoPaths || []).map((p) => joinUrl(baseUrl, p)).filter(Boolean),
    }));
    this.setData({ pendingItems: mapped });
  },

  async loadStudents() {
    const api = require("../../services/api");
    const resp = await api.featureApi.reminderAdminStudents();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => {
      const tags = Array.isArray(x.tags) ? x.tags : [];
      const isCadre = tags.includes("班团骨干");
      return {
        ...x,
        isCadre,
        tagsText: tags.length ? `标签：${tags.join("、")}` : "标签：-",
      };
    });
    this.setData({ students: mapped });
  },

  onTapItem(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    wx.showModal({
      title: item.title || "活动",
      content: `${item.activityDateText || ""}\n角色：${item.myRoleText || ""}\n\n${item.summary || ""}`,
      showCancel: false,
    });
  },

  onFormTitleInput(e) {
    this.setData({ formTitle: e.detail.value });
  },

  onFormDateInput(e) {
    this.setData({ formDate: e.detail.value });
  },

  onFormSummaryInput(e) {
    this.setData({ formSummary: e.detail.value });
  },

  onFormTargetTagInput(e) {
    this.setData({ formTargetTag: e.detail.value });
  },

  onFormOrganizersInput(e) {
    this.setData({ formOrganizers: e.detail.value });
  },

  onFormParticipantsInput(e) {
    this.setData({ formParticipants: e.detail.value });
  },

  onFormHelpersInput(e) {
    this.setData({ formHelpers: e.detail.value });
  },

  onResetForm() {
    this.setData({
      editingId: "",
      editingRejectReason: "",
      formTitle: "",
      formDate: "",
      formSummary: "",
      formTargetTag: "",
      formOrganizers: "",
      formParticipants: "",
      formHelpers: "",
      formPhotoPaths: [],
      formPhotos: [],
    });
  },

  onEditItem(e) {
    const id = String(e.currentTarget.dataset.id || "");
    const found = (this.data.cadreItems || []).find((x) => String(x._id) === id);
    if (!found) return;
    const api = require("../../services/api");
    const baseUrl = api.getBaseUrl();
    const photoPaths = Array.isArray(found.photoPaths) ? found.photoPaths : [];
    this.setData({
      editingId: found._id,
      editingRejectReason: found.rejectReason || "",
      formTitle: found.title || "",
      formDate: found.activityDate || "",
      formSummary: found.summary || "",
      formTargetTag: found.targetTag || "",
      formOrganizers: "",
      formParticipants: "",
      formHelpers: "",
      formPhotoPaths: photoPaths,
      formPhotos: photoPaths.map((p) => joinUrl(baseUrl, p)).filter(Boolean),
    });
  },

  onPreviewPhoto(e) {
    const url = String(e.currentTarget.dataset.url || "");
    if (!url) return;
    wx.previewImage({ urls: [url] });
  },

  onClearPhotos() {
    this.setData({ formPhotoPaths: [], formPhotos: [] });
  },

  onChoosePhotos() {
    if (this.data.uploading) return;
    wx.chooseImage({
      count: 6,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const list = res?.tempFilePaths || [];
        if (!list.length) return;
        await this.uploadPhotos(list.slice(0, 6));
      },
      fail: () => {},
    });
  },

  async uploadPhotos(paths) {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const url = `${api.getBaseUrl()}/api/activity/cadre/upload`;
    const outPaths = [];
    const outUrls = [];

    this.setData({ uploading: true });
    wx.showLoading({ title: "上传中..." });
    try {
      for (const p of paths) {
        const r = await new Promise((resolve) => {
          wx.uploadFile({
            url,
            filePath: p,
            name: "file",
            header: buildAuthHeader(session),
            success: (resp) => resolve(resp),
            fail: (err) => resolve({ err }),
          });
        });
        if (r?.err) {
          wx.showToast({ title: r.err?.errMsg || "上传失败", icon: "none" });
          continue;
        }
        const parsed = parseUploadResponseText(r.data);
        if (parsed.error) {
          wx.showToast({ title: parsed.error, icon: "none" });
          continue;
        }
        outPaths.push(parsed.path);
        outUrls.push(joinUrl(api.getBaseUrl(), parsed.path));
      }
      const mergedPaths = (this.data.formPhotoPaths || []).concat(outPaths).slice(0, 6);
      const mergedUrls = (this.data.formPhotos || []).concat(outUrls).slice(0, 6);
      this.setData({ formPhotoPaths: mergedPaths, formPhotos: mergedUrls });
      if (outPaths.length) wx.showToast({ title: "上传成功", icon: "success" });
    } finally {
      wx.hideLoading();
      this.setData({ uploading: false });
    }
  },

  async onSubmit() {
    if (this.data.saving) return;
    const title = String(this.data.formTitle || "").trim();
    if (!title) {
      wx.showToast({ title: "请填写标题", icon: "none" });
      return;
    }
    const date = String(this.data.formDate || "").trim();
    if (date && !isValidYmd(date)) {
      wx.showToast({ title: "日期无效", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: "提交中..." });
    try {
      const api = require("../../services/api");
      const participants = {
        organizers: parseIds(this.data.formOrganizers),
        participants: parseIds(this.data.formParticipants),
        helpers: parseIds(this.data.formHelpers),
      };
      if (this.data.editingId) {
        await api.featureApi.activityCadreUpdate({
          id: this.data.editingId,
          title,
          summary: this.data.formSummary,
          activityDate: date,
          targetTag: this.data.formTargetTag,
          photoPaths: this.data.formPhotoPaths,
          participants,
        });
      } else {
        await api.featureApi.activityCadreCreate({
          title,
          summary: this.data.formSummary,
          activityDate: date,
          targetTag: this.data.formTargetTag,
          photoPaths: this.data.formPhotoPaths,
          participants,
        });
      }
      wx.showToast({ title: "已提交", icon: "success" });
      this.onResetForm();
      await this.tryLoadCadreMine();
    } catch (e) {
      wx.showToast({ title: e?.message || "提交失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },

  onApprove(e) {
    const id = String(e.currentTarget.dataset.id || "");
    if (!id) return;
    wx.showModal({
      title: "确认通过",
      content: "确认通过该活动申请？",
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: "处理中..." });
        try {
          const api = require("../../services/api");
          await api.featureApi.activityAdminApprove({ id });
          wx.showToast({ title: "已通过", icon: "success" });
          await this.loadPending();
        } catch (e2) {
          wx.showToast({ title: e2?.message || "操作失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  onReject(e) {
    const id = String(e.currentTarget.dataset.id || "");
    if (!id) return;
    wx.showModal({
      title: "驳回原因",
      editable: true,
      placeholderText: "可选：填写驳回原因",
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: "处理中..." });
        try {
          const api = require("../../services/api");
          const session = api.auth.getSession();
          const reviewedBy = String(session?.accountId || "").trim();
          await api.featureApi.activityAdminReject({ id, reason: r.content || "", reviewed_by: reviewedBy });
          wx.showToast({ title: "已驳回", icon: "success" });
          await this.loadPending();
        } catch (e2) {
          const code = String(e2?.code || "");
          const status = Number(e2?.status || 0) || 0;
          const debugText = e2?.debug ? JSON.stringify(e2.debug, null, 2) : "";
          const msg = [e2?.message || "操作失败", code ? `code=${code}` : "", status ? `status=${status}` : "", debugText ? `debug=${debugText}` : ""]
            .filter(Boolean)
            .join("\n");
          wx.showModal({ title: "驳回失败", content: msg.slice(0, 1600), showCancel: false });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  async onToggleCadre(e) {
    const accountId = String(e.currentTarget.dataset.accountId || "");
    if (!accountId) return;
    const found = (this.data.students || []).find((x) => String(x.accountId) === accountId);
    if (!found) return;
    const nextTags = (Array.isArray(found.tags) ? found.tags : []).slice();
    const idx = nextTags.indexOf("班团骨干");
    if (idx >= 0) nextTags.splice(idx, 1);
    else nextTags.push("班团骨干");
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      await api.featureApi.reminderAdminStudentTagsSave({ accountId, tags: nextTags });
      wx.showToast({ title: "已保存", icon: "success" });
      await this.loadStudents();
    } catch (e2) {
      wx.showToast({ title: e2?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
