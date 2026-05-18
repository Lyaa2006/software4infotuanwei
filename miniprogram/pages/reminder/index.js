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

function buildPreview(content) {
  const s = String(content ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s.length > 80 ? `${s.slice(0, 80)}...` : s;
}

function parseTagsText(text) {
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

Page({
  data: {
    isAdmin: false,
    loading: false,
    items: [],
    adminMessages: [],
    adminStudents: [],
    availableTagsText: "",
    formTitle: "",
    formContent: "",
    formTargetType: "all",
    formTagsText: "",
    sending: false,
    editingAccountId: "",
    editingNameText: "",
    editingTagsText: "",
    savingTags: false,
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    this.setData({ isAdmin: session.role === "admin" });
    this.reloadAll();
  },

  async reloadAll() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      await this.loadMyItems();
      if (this.data.isAdmin) {
        await this.loadAdminMessages();
        await this.loadAdminStudents();
      }
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  async loadMyItems() {
    const api = require("../../services/api");
    const resp = await api.featureApi.reminderMyList();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => ({
      ...x,
      createdAtText: formatDateTime(x.createdAt),
      preview: buildPreview(x.content),
    }));
    this.setData({ items: mapped });
  },

  async loadAdminMessages() {
    const api = require("../../services/api");
    const resp = await api.featureApi.reminderAdminMessages();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => ({
      ...x,
      createdAtText: formatDateTime(x.createdAt),
      preview: buildPreview(x.content),
      targetTypeText: x.targetType === "tags" ? `标签：${(x.targetTags || []).join("、") || "-"}` : "全部学生",
    }));
    this.setData({ adminMessages: mapped });
  },

  async loadAdminStudents() {
    const api = require("../../services/api");
    const resp = await api.featureApi.reminderAdminStudents();
    const items = Array.isArray(resp.items) ? resp.items : [];
    const mapped = items.map((x) => {
      const tags = Array.isArray(x.tags) ? x.tags : [];
      return {
        ...x,
        tagsText: tags.length ? `标签：${tags.join("、")}` : "标签：-",
        tagsTextRaw: tags.join(","),
      };
    });

    const tagSet = new Set();
    for (const s of mapped) {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      for (const t of tags) tagSet.add(String(t));
    }
    const availableTagsText = Array.from(tagSet).slice(0, 30).join("、");
    this.setData({ adminStudents: mapped, availableTagsText });
  },

  async onTapItem(e) {
    const id = String(e.currentTarget.dataset.id || "");
    const found = (this.data.items || []).find((x) => String(x._id) === id);
    if (!found) return;

    wx.showModal({
      title: found.title || "通知",
      content: `${found.createdAtText || ""}\n\n${found.content || ""}`,
      showCancel: false,
    });

    if (!found.readAt) {
      try {
        const api = require("../../services/api");
        await api.featureApi.reminderMyMarkRead({ id: found._id });
        const next = (this.data.items || []).map((x) => {
          if (String(x._id) !== String(found._id)) return x;
          return { ...x, readAt: Date.now() };
        });
        this.setData({ items: next });
      } catch {}
    }
  },

  onFormTitleInput(e) {
    this.setData({ formTitle: e.detail.value });
  },

  onFormContentInput(e) {
    this.setData({ formContent: e.detail.value });
  },

  onFormTargetTypeChange(e) {
    this.setData({ formTargetType: e.detail.value });
  },

  onFormTagsInput(e) {
    this.setData({ formTagsText: e.detail.value });
  },

  onFormReset() {
    this.setData({
      formTitle: "",
      formContent: "",
      formTargetType: "all",
      formTagsText: "",
    });
  },

  async onSend() {
    if (this.data.sending) return;
    this.setData({ sending: true });
    wx.showLoading({ title: "发送中..." });
    try {
      const api = require("../../services/api");
      const targetTags = this.data.formTargetType === "tags" ? parseTagsText(this.data.formTagsText) : [];
      await api.featureApi.reminderAdminSend({
        title: this.data.formTitle,
        content: this.data.formContent,
        targetType: this.data.formTargetType,
        targetTags,
      });
      wx.showToast({ title: "已发送", icon: "success" });
      this.onFormReset();
      await this.loadAdminMessages();
      await this.loadMyItems();
    } catch (e) {
      wx.showToast({ title: e?.message || "发送失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ sending: false });
    }
  },

  onEditTags(e) {
    const accountId = String(e.currentTarget.dataset.accountId || "");
    const name = String(e.currentTarget.dataset.name || "");
    const tagsText = String(e.currentTarget.dataset.tagsText || "");
    this.setData({
      editingAccountId: accountId,
      editingNameText: name ? `${accountId}（${name}）` : accountId,
      editingTagsText: tagsText,
    });
  },

  onEditingTagsInput(e) {
    this.setData({ editingTagsText: e.detail.value });
  },

  onCancelEditTags() {
    this.setData({ editingAccountId: "", editingNameText: "", editingTagsText: "" });
  },

  async onSaveEditTags() {
    if (this.data.savingTags) return;
    const accountId = String(this.data.editingAccountId || "");
    if (!accountId) return;
    this.setData({ savingTags: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const tags = parseTagsText(this.data.editingTagsText);
      const api = require("../../services/api");
      await api.featureApi.reminderAdminStudentTagsSave({ accountId, tags });
      wx.showToast({ title: "已保存", icon: "success" });
      this.onCancelEditTags();
      await this.loadAdminStudents();
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ savingTags: false });
    }
  },
});
