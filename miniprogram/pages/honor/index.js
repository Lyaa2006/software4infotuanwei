Page({
  data: {
    isStudent: false,
    users: [],
    loading: false,
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    this.setData({ isStudent: session.role === "student" });
    this.loadUsers();
  },

  async loadUsers() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.honorUsers();
      const users = Array.isArray(resp.items) ? resp.items : [];
      const mapped = users.map((u) => ({
        ...u,
        nameText: (u.name || "").trim() ? `${u.name}` : `${u.accountId}`,
      }));
      this.setData({ users: mapped });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  onTapUser(e) {
    const accountId = String(e.currentTarget.dataset.accountId || "");
    if (!accountId) return;
    wx.navigateTo({ url: `/pages/honorProfile/index?accountId=${encodeURIComponent(accountId)}` });
  },

  onGoMyProfile() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const accountId = session?.accountId || "";
    if (!accountId) return;
    wx.navigateTo({ url: `/pages/honorProfile/index?accountId=${encodeURIComponent(accountId)}` });
  },
});
