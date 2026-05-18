function guessFormat(fileName) {
  const name = String(fileName ?? "").toLowerCase();
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".txt")) return "txt";
  return "html";
}

function buildAuthHeader(session) {
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

function encodeQuery(params) {
  const pairs = [];
  for (const [k, v] of Object.entries(params || {})) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
  }
  return pairs.length ? `?${pairs.join("&")}` : "";
}

function isPdfFile(tempFilePath) {
  try {
    const fs = wx.getFileSystemManager();
    const buf = fs.readFileSync(tempFilePath);
    if (!buf || !buf.byteLength) return false;
    const head = String.fromCharCode.apply(null, Array.prototype.slice.call(new Uint8Array(buf.slice(0, 5))));
    return head === "%PDF-";
  } catch {
    return false;
  }
}

function tryReadServerError(tempFilePath) {
  try {
    const fs = wx.getFileSystemManager();
    const text = fs.readFileSync(tempFilePath, "utf8");
    const s = String(text || "").trim();
    if (!s) return "";
    const obj = JSON.parse(s);
    if (obj?.message) return String(obj.message);
    if (obj?.error) return String(obj.error);
    return "";
  } catch {
    return "";
  }
}

Page({
  data: {
    isAdmin: false,
    templates: [],
    college: "",
    platoon: "",
    reason: "",
    proof: "",
    nameHint: "姓名、学号、日期",
    uploadTitle: "",
    uploadCategory: "",
    uploadFileName: "",
    uploadFileBase64: "",
    uploading: false,
    loading: false,
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    this.setData({ isAdmin: session.role === "admin" });
    this.loadTemplates();
  },

  async loadTemplates() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.certTemplateList();
      const templates = Array.isArray(resp.items) ? resp.items : [];
      this.setData({ templates });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  onCollegeInput(e) {
    this.setData({ college: e.detail.value });
  },

  onPlatoonInput(e) {
    this.setData({ platoon: e.detail.value });
  },

  onReasonInput(e) {
    this.setData({ reason: e.detail.value });
  },

  onProofInput(e) {
    this.setData({ proof: e.detail.value });
  },

  onUploadTitleInput(e) {
    this.setData({ uploadTitle: e.detail.value });
  },

  onUploadCategoryInput(e) {
    this.setData({ uploadCategory: e.detail.value });
  },

  onChooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      success: (res) => {
        const file = res?.tempFiles?.[0] || null;
        if (!file?.path) return;
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: file.path,
          encoding: "base64",
          success: (r) => {
            this.setData({
              uploadFileName: file.name || "template",
              uploadFileBase64: r.data || "",
            });
          },
          fail: () => {
            wx.showToast({ title: "读取文件失败", icon: "none" });
          },
        });
      },
      fail: () => {},
    });
  },

  async onUpload() {
    if (!this.data.isAdmin) return;
    if (this.data.uploading) return;
    this.setData({ uploading: true });
    wx.showLoading({ title: "上传中..." });
    try {
      const api = require("../../services/api");
      const format = guessFormat(this.data.uploadFileName);
      await api.featureApi.certAdminTemplateUpload({
        title: this.data.uploadTitle,
        category: this.data.uploadCategory,
        format,
        fileName: this.data.uploadFileName,
        fileBase64: this.data.uploadFileBase64,
      });
      wx.showToast({ title: "上传成功", icon: "success" });
      this.setData({ uploadTitle: "", uploadCategory: "", uploadFileName: "", uploadFileBase64: "" });
      await this.loadTemplates();
    } catch (e) {
      wx.showToast({ title: e?.message || "上传失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ uploading: false });
    }
  },

  onDownloadTemplate(e) {
    const id = String(e.currentTarget.dataset.id || "");
    if (!id) return;
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const url = `${api.getBaseUrl()}/api/cert/templates/${encodeURIComponent(id)}/file`;
    wx.downloadFile({
      url,
      header: buildAuthHeader(session),
      success: (r) => {
        if (Number(r.statusCode || 0) !== 200) {
          const msg = tryReadServerError(r.tempFilePath) || `下载失败（${r.statusCode}）`;
          wx.showToast({ title: msg, icon: "none" });
          return;
        }
        wx.openDocument({
          filePath: r.tempFilePath,
          showMenu: true,
          fail: () => {
            wx.showToast({ title: "已下载", icon: "none" });
          },
        });
      },
      fail: (err) => {
        wx.showToast({ title: err?.errMsg || "下载失败", icon: "none" });
      },
    });
  },

  onGeneratePdf(e) {
    const id = String(e.currentTarget.dataset.id || "");
    if (!id) return;
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const query = encodeQuery({
      college: this.data.college,
      platoon: this.data.platoon,
      reason: this.data.reason,
      proof: this.data.proof,
    });
    const url = `${api.getBaseUrl()}/api/cert/templates/${encodeURIComponent(id)}/pdf${query}`;
    wx.downloadFile({
      url,
      header: buildAuthHeader(session),
      success: (r) => {
        if (Number(r.statusCode || 0) !== 200) {
          const msg = tryReadServerError(r.tempFilePath) || `生成失败（${r.statusCode}）`;
          wx.showToast({ title: msg, icon: "none" });
          return;
        }
        if (!isPdfFile(r.tempFilePath)) {
          const msg = tryReadServerError(r.tempFilePath) || "生成失败（返回内容不是PDF）";
          wx.showToast({ title: msg, icon: "none" });
          return;
        }
        wx.openDocument({
          filePath: r.tempFilePath,
          fileType: "pdf",
          showMenu: true,
          fail: (err) => {
            wx.showToast({ title: err?.errMsg || "打开失败", icon: "none" });
          },
        });
      },
      fail: (err) => {
        wx.showToast({ title: err?.errMsg || "生成失败", icon: "none" });
      },
    });
  },
});
