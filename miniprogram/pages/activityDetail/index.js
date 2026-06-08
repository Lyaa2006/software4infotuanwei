function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYmd(ymd) {
  const s = String(ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
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

function getDetailPayload(token) {
  const app = getApp();
  const store = app?.globalData?.activityDetailStore;
  if (!store || typeof store !== "object") return null;
  return store[String(token || "")] || null;
}

function clearDetailPayload(token) {
  const app = getApp();
  const store = app?.globalData?.activityDetailStore;
  if (!store || typeof store !== "object") return;
  delete store[String(token || "")];
}

function normalizeItem(raw) {
  const item = raw && typeof raw === "object" ? { ...raw } : {};
  const participants = item.participants && typeof item.participants === "object" ? item.participants : {};
  const organizers = Array.isArray(participants.organizers) ? participants.organizers : [];
  const participantList = Array.isArray(participants.participants) ? participants.participants : [];
  const helpers = Array.isArray(participants.helpers) ? participants.helpers : [];
  const photoUrls = Array.isArray(item.photoUrls) ? item.photoUrls.filter(Boolean) : [];
  return {
    ...item,
    photoUrls,
    participants: {
      organizers,
      participants: participantList,
      helpers,
    },
    organizerText: organizers.length ? organizers.join("、") : "无",
    participantText: participantList.length ? participantList.join("、") : "无",
    helperText: helpers.length ? helpers.join("、") : "无",
    createdAtText: String(item.createdAtText || formatDateTime(item.createdAt) || ""),
    reviewedAtText: String(item.reviewedAtText || formatDateTime(item.reviewedAt) || ""),
    statusText: String(item.statusText || ""),
  };
}

Page({
  data: {
    token: "",
    mode: "",
    item: null,
    canEdit: false,
    canDelete: false,
    canApprove: false,
    canReject: false,
  },

  onLoad(query) {
    const token = String(query?.token || "");
    const payload = getDetailPayload(token);
    const item = normalizeItem(payload?.item || null);
    const mode = String(payload?.mode || "");
    if (!item) {
      wx.showToast({ title: "活动数据无效", icon: "none" });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 400);
      return;
    }
    const canEdit = mode === "cadre" && item.canEdit;
    const canDelete = mode === "cadre" && item.status !== "approved";
    const canApprove = mode === "pending";
    const canReject = mode === "pending";
    this.setData({ token, mode, item, canEdit, canDelete, canApprove, canReject });
    wx.setNavigationBarTitle({ title: item.title || "活动详情" });
  },

  onUnload() {
    clearDetailPayload(this.data.token);
  },

  onPreviewPhoto(e) {
    const url = String(e.currentTarget.dataset.url || "");
    const urls = Array.isArray(this.data.item?.photoUrls) ? this.data.item.photoUrls : [];
    if (!url) return;
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  },

  onEdit() {
    const item = this.data.item;
    if (!item) return;
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage && typeof prevPage.fillEditForm === "function") {
      prevPage.fillEditForm(item);
    }
    wx.navigateBack({ delta: 1 });
  },

  onDelete() {
    const item = this.data.item;
    const id = String(item?._id || item?.id || "");
    if (!id) return;
    wx.showModal({
      title: "删除活动",
      content: "确认删除这条我提交的活动吗？删除后不可恢复。",
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: "删除中..." });
        try {
          const api = require("../../services/api");
          await api.featureApi.activityCadreDelete({ id });
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && typeof prevPage.tryLoadCadreMine === "function") {
            await prevPage.tryLoadCadreMine();
          }
          wx.hideLoading();
          wx.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
          }, 300);
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e?.message || "删除失败", icon: "none" });
        }
      },
    });
  },

  onApprove() {
    const item = this.data.item;
    const id = String(item?._id || item?.id || "");
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
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && typeof prevPage.loadPending === "function") {
            await prevPage.loadPending();
          }
          wx.hideLoading();
          wx.showToast({ title: "已通过", icon: "success" });
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
          }, 300);
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e?.message || "操作失败", icon: "none" });
        }
      },
    });
  },

  onReject() {
    const item = this.data.item;
    const id = String(item?._id || item?.id || "");
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
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage && typeof prevPage.loadPending === "function") {
            await prevPage.loadPending();
          }
          wx.hideLoading();
          wx.showToast({ title: "已驳回", icon: "success" });
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
          }, 300);
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e?.message || "操作失败", icon: "none" });
        }
      },
    });
  },

});
