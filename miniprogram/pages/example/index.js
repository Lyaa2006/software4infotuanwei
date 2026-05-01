Page({
  data: {
    user: null,
    features: [
      { key: "policyQA", title: "智能政策问答" },
      { key: "partyLeague", title: "党团事务流程管理" },
      { key: "reminder", title: "信息提醒" },
      { key: "certificate", title: "电子证明模板填充" },
      { key: "academic", title: "学业情况分析" },
      { key: "honor", title: "学生荣誉展示" },
      { key: "activity", title: "班团活动管理" },
    ],
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    this.setData({
      user: {
        role: session.role,
        accountId: session.accountId,
      },
    });
  },

  onTapFeature(e) {
    const { key, title } = e.currentTarget.dataset;
    if (key === "policyQA") {
      wx.navigateTo({ url: "/pages/policyQA/index" });
      return;
    }
    if (key === "partyLeague") {
      const api = require("../../services/api");
      const session = api.auth.getSession();
      if (session?.role === "admin") {
        wx.navigateTo({ url: "/pages/partyAdminList/index" });
        return;
      }
      wx.navigateTo({ url: "/pages/partyStudent/index" });
      return;
    }
    if (key === "reminder") {
      wx.navigateTo({ url: "/pages/reminder/index" });
      return;
    }
    if (key === "certificate") {
      wx.navigateTo({ url: "/pages/certificate/index" });
      return;
    }
    if (key === "honor") {
      wx.navigateTo({ url: "/pages/honor/index" });
      return;
    }
    if (key === "activity") {
      wx.navigateTo({ url: "/pages/activity/index" });
      return;
    }
    if (key === "academic") {
      wx.navigateTo({ url: "/pages/academic/index" });
      return;
    }
    wx.showToast({
      title: `${title} 开发中`,
      icon: "none",
    });
  },

  onLogout() {
    const api = require("../../services/api");
    api.auth.logout();
    wx.reLaunch({ url: "/pages/index/index" });
  },
});
