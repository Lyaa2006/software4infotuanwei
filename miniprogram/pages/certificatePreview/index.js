Page({
  data: {
    title: "模板预览",
    html: "",
  },

  onLoad(query) {
    const title = decodeURIComponent(String(query?.title || "模板预览"));
    const cached = wx.getStorageSync("certificate_template_preview") || {};
    this.setData({
      title,
      html: String(cached.html || ""),
    });
    wx.setNavigationBarTitle({ title });
  },
});
