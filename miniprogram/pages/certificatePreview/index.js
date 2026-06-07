Page({
  data: {
    title: "模板预览",
    html: "",
  },

  onLoad(query) {
    let titleRaw = String(query?.title || "模板预览");
    let title = "模板预览";
    try {
      title = decodeURIComponent(titleRaw);
    } catch {
      title = titleRaw;
    }

    const cached = wx.getStorageSync("certificate_template_preview") || {};
    this.setData({
      title,
      html: String(cached.html || ""),
    });
    wx.setNavigationBarTitle({ title });
  },
});
