Page({
  data: {
    isAdmin: false,

    question: "",
    asking: false,
    answer: "",
    matchedQuestion: "",

    items: [],
    loadingList: false,

    editingId: "",
    formQuestion: "",
    formAnswer: "",
    formKeywords: "",
    saving: false,
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    const isAdmin = session.role === "admin";
    this.setData({ isAdmin });
    if (isAdmin) {
      this.loadList();
    }
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value });
  },

  async onAsk() {
    if (this.data.asking) return;
    const q = String(this.data.question || "").trim();
    if (!q) {
      wx.showToast({ title: "请输入问题", icon: "none" });
      return;
    }

    this.setData({ asking: true, answer: "", matchedQuestion: "" });
    wx.showLoading({ title: "查询中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.intelligentPolicyQA({ question: q });
      this.setData({
        answer: resp.answer || "未找到匹配答案",
        matchedQuestion: resp.matchedQuestion || "",
      });
    } catch (e) {
      wx.showToast({ title: e?.message || "查询失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ asking: false });
    }
  },

  async loadList() {
    if (this.data.loadingList) return;
    this.setData({ loadingList: true });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.knowledgeQaList();
      this.setData({ items: resp.items || [] });
    } catch (e) {
      wx.showToast({ title: e?.message || "获取失败", icon: "none" });
    } finally {
      this.setData({ loadingList: false });
    }
  },

  onFormQuestionInput(e) {
    this.setData({ formQuestion: e.detail.value });
  },

  onFormAnswerInput(e) {
    this.setData({ formAnswer: e.detail.value });
  },

  onFormKeywordsInput(e) {
    this.setData({ formKeywords: e.detail.value });
  },

  onResetForm() {
    this.setData({
      editingId: "",
      formQuestion: "",
      formAnswer: "",
      formKeywords: "",
    });
  },

  async onSave() {
    if (this.data.saving) return;
    const question = String(this.data.formQuestion || "").trim();
    const answer = String(this.data.formAnswer || "").trim();
    const keywords = String(this.data.formKeywords || "")
      .split(/[，,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!question) {
      wx.showToast({ title: "请填写标准问题", icon: "none" });
      return;
    }
    if (!answer) {
      wx.showToast({ title: "请填写标准答案", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      await api.featureApi.knowledgeQaUpsert({
        id: this.data.editingId,
        question,
        answer,
        keywords,
      });
      this.onResetForm();
      await this.loadList();
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.items || []).find((x) => x._id === id);
    if (!item) return;
    this.setData({
      editingId: item._id,
      formQuestion: item.question || "",
      formAnswer: item.answer || "",
      formKeywords: Array.isArray(item.keywords) ? item.keywords.join(",") : "",
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "确认删除",
      content: "删除后无法恢复，是否继续？",
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: "删除中..." });
        try {
          const api = require("../../services/api");
          await api.featureApi.knowledgeQaDelete({ id });
          await this.loadList();
          if (this.data.editingId === id) {
            this.onResetForm();
          }
          wx.showToast({ title: "已删除", icon: "success" });
        } catch (err) {
          wx.showToast({ title: err?.message || "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
});

