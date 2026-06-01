function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDate(ymd) {
  const s = String(ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
}

function isValidYmd(ymd) {
  const s = formatDate(ymd);
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
    accountId: "",
    userTitle: "个人荣誉主页",
    isEditable: false,
    items: [],
    loading: false,
    editingId: "",
    formTitle: "",
    formDescription: "",
    formIssuer: "",
    formHonorDate: "",
    formIsPublic: true,
    formImagePath: "",
    imageUrl: "",
    uploading: false,
    saving: false,
  },

  onLoad(query) {
    const accountId = String(query?.accountId || "");
    this.setData({ accountId });
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    const isEditable = session.role === "student" && String(session.accountId) === String(this.data.accountId);
    this.setData({ isEditable });
    this.reload();
  },

  async reload() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      if (this.data.isEditable) {
        await this.loadMy();
        const api = require("../../services/api");
        const session = api.auth.getSession();
        const title = session?.accountId ? `${session.accountId} 的荣誉主页` : "我的荣誉主页";
        this.setData({ userTitle: title });
      } else {
        await this.loadUser();
      }
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  async loadMy() {
    const api = require("../../services/api");
    const resp = await api.featureApi.honorMyList();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const baseUrl = api.getBaseUrl();
    const mapped = items.map((x) => ({
      ...x,
      honorDateText: formatDate(x.honorDate) || formatDateTime(x.updatedAt) || "",
      imageUrl: x.imagePath ? joinUrl(baseUrl, x.imagePath) : "",
    }));
    this.setData({ items: mapped });
  },

  async loadUser() {
    const api = require("../../services/api");
    const resp = await api.featureApi.honorUserDetail({ accountId: this.data.accountId });
    const baseUrl = api.getBaseUrl();
    const user = resp.user || {};
    const nameText = String(user.name || "").trim() ? `${user.name}` : `${user.accountId || this.data.accountId}`;
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => ({
      ...x,
      honorDateText: formatDate(x.honorDate) || formatDateTime(x.updatedAt) || "",
      imageUrl: x.imagePath ? joinUrl(baseUrl, x.imagePath) : "",
    }));
    this.setData({ userTitle: `${nameText} 的荣誉主页`, items: mapped });
  },

  onFormTitleInput(e) {
    this.setData({ formTitle: e.detail.value });
  },

  onFormDescriptionInput(e) {
    this.setData({ formDescription: e.detail.value });
  },

  onFormIssuerInput(e) {
    this.setData({ formIssuer: e.detail.value });
  },

  onFormHonorDateInput(e) {
    this.setData({ formHonorDate: e.detail.value });
  },

  onFormPublicChange(e) {
    this.setData({ formIsPublic: e.detail.value === "true" });
  },

  onResetForm() {
    this.setData({
      editingId: "",
      formTitle: "",
      formDescription: "",
      formIssuer: "",
      formHonorDate: "",
      formIsPublic: true,
      formImagePath: "",
      imageUrl: "",
    });
  },

  onEdit(e) {
    const id = String(e.currentTarget.dataset.id || "");
    const found = (this.data.items || []).find((x) => String(x._id) === id);
    if (!found) return;
    this.setData({
      editingId: found._id,
      formTitle: found.title || "",
      formDescription: found.description || "",
      formIssuer: found.issuer || "",
      formHonorDate: found.honorDate || "",
      formIsPublic: !!found.isPublic,
      formImagePath: found.imagePath || "",
      imageUrl: found.imageUrl || "",
    });
  },

  async onDelete(e) {
    const id = String(e.currentTarget.dataset.id || "");
    if (!id) return;
    wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，确定继续吗？",
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: "删除中..." });
        try {
          const api = require("../../services/api");
          await api.featureApi.honorMyDelete({ id });
          wx.showToast({ title: "已删除", icon: "success" });
          if (String(this.data.editingId) === id) this.onResetForm();
          await this.loadMy();
        } catch (e2) {
          wx.showToast({ title: e2?.message || "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  onClearImage() {
    this.setData({ formImagePath: "", imageUrl: "" });
  },

  onChooseImage() {
    if (this.data.uploading) return;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res?.tempFilePaths?.[0] || "";
        if (!tempFilePath) return;
        this.uploadImage(tempFilePath);
      },
      fail: () => {},
    });
  },

  uploadImage(tempFilePath) {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const url = `${api.getBaseUrl()}/api/honor/me/upload`;
    this.setData({ uploading: true });
    wx.showLoading({ title: "上传中..." });
    wx.uploadFile({
      url,
      filePath: tempFilePath,
      name: "file",
      header: buildAuthHeader(session),
      success: (r) => {
        const parsed = parseUploadResponseText(r.data);
        if (parsed.error) {
          wx.showToast({ title: parsed.error, icon: "none" });
          return;
        }
        const imageUrl = joinUrl(api.getBaseUrl(), parsed.path);
        this.setData({ formImagePath: parsed.path, imageUrl });
        wx.showToast({ title: "上传成功", icon: "success" });
      },
      fail: (err) => {
        wx.showToast({ title: err?.errMsg || "上传失败", icon: "none" });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ uploading: false });
      },
    });
  },

  async onSave() {
    if (this.data.saving) return;
    const title = String(this.data.formTitle || "").trim();
    if (!title) {
      wx.showToast({ title: "请填写荣誉名称", icon: "none" });
      return;
    }
    const honorDate = String(this.data.formHonorDate || "").trim();
    if (honorDate && !isValidYmd(honorDate)) {
      wx.showToast({ title: "日期无效", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      if (this.data.editingId) {
        await api.featureApi.honorMyUpdate({
          id: this.data.editingId,
          title,
          description: this.data.formDescription,
          issuer: this.data.formIssuer,
          honorDate,
          imagePath: this.data.formImagePath,
          isPublic: this.data.formIsPublic,
        });
      } else {
        await api.featureApi.honorMyCreate({
          title,
          description: this.data.formDescription,
          issuer: this.data.formIssuer,
          honorDate,
          imagePath: this.data.formImagePath,
          isPublic: this.data.formIsPublic,
        });
      }
      wx.showToast({ title: "已保存", icon: "success" });
      this.onResetForm();
      await this.loadMy();
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },

  onPreviewImage(e) {
    const url = String(e.currentTarget.dataset.url || "");
    if (!url) return;
    wx.previewImage({ urls: [url] });
  },
});
