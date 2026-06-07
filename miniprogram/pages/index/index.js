Page({
  data: {
    role: "student",
    accountId: "",
    password: "",
    submitting: false,
    envOptions: [],
    envIndex: 0,
    envName: "",
    envBaseUrl: "",
    envNote: "",
    envSupportsRealDevice: false,
  },
  onLoad() {
    this.refreshEnvConfig();
  },
  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    this.refreshEnvConfig();
    if (session?.accountId) {
      wx.reLaunch({ url: "/pages/example/index" });
    }
  },
  refreshEnvConfig() {
    const api = require("../../services/api");
    const envOptions = api.getTestingEnvOptions();
    const runtimeConfig = api.getRuntimeConfig();
    const matchedIndex = envOptions.findIndex((item) => item.key === runtimeConfig.envKey);

    this.setData({
      envOptions,
      envIndex: matchedIndex >= 0 ? matchedIndex : 0,
      envName: runtimeConfig.envName,
      envBaseUrl: runtimeConfig.baseUrl,
      envNote: runtimeConfig.note,
      envSupportsRealDevice: runtimeConfig.supportsRealDevice,
    });
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
  onEnvChange(e) {
    const index = Number(e.detail.value || 0);
    const target = this.data.envOptions[index];
    if (!target) return;

    const api = require("../../services/api");
    api.setTestingEnv(target.key);
    this.refreshEnvConfig();
    wx.showToast({
      title: "测试环境已切换",
      icon: "none",
    });
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
