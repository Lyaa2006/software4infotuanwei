function normalizeAccountId(accountId) {
  return String(accountId ?? "").trim();
}

Page({
  data: {
    loading: false,
    items: [],
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    if (session.role !== "admin") {
      wx.reLaunch({ url: "/pages/partyStudent/index" });
      return;
    }
    this.loadList();
  },

  async loadList() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.partyAdminStudents();
      this.setData({ items: resp.items || [] });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  onTapStudent(e) {
    const accountId = e.currentTarget.dataset.accountId;
    wx.navigateTo({ url: `/pages/partyAdminEdit/index?accountId=${encodeURIComponent(String(accountId || ""))}` });
  },

  onAddStudent() {
    wx.showModal({
      title: "新增/编辑学生",
      editable: true,
      placeholderText: "请输入学生学号",
      success: (res) => {
        if (!res.confirm) return;
        const accountId = normalizeAccountId(res.content);
        if (!accountId) {
          wx.showToast({ title: "请输入学号", icon: "none" });
          return;
        }
        wx.navigateTo({ url: `/pages/partyAdminEdit/index?accountId=${encodeURIComponent(accountId)}` });
      },
    });
  },
});

