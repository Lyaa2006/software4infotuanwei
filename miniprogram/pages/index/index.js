Page({
  data: {
    role: "student",
    accountId: "",
    password: "",
    submitting: false,
  },
  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (session?.accountId) {
      wx.reLaunch({ url: "/pages/example/index" });
    }
  },

  onRoleChange(e) {
    this.setData({ role: e.detail.value });
  },

  onAccountInput(e) {
    this.setData({ accountId: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    wx.showLoading({ title: "登录中..." });

    try {
      const api = require("../../services/api");
      const resp = await api.auth.loginWithAccount({
        role: this.data.role,
        accountId: this.data.accountId,
        password: this.data.password,
      });

      wx.hideLoading();
      wx.showToast({
        title: resp.isNew ? "注册成功" : "登录成功",
        icon: "success",
      });
      wx.reLaunch({ url: "/pages/example/index" });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({
        title: e?.message || "登录失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
