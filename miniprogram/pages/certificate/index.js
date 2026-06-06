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

function fieldLabel(key) {
  const k = String(key ?? "").trim();
  const map = {
    college: "学院",
    platoon: "连排",
    reason: "事由",
    proof: "证明",
    phone: "联系电话",
    teacher: "老师",
    place: "地点",
  };
  return map[k] || k || "字段";
}

function fieldPlaceholder(key) {
  const k = String(key ?? "").trim();
  const map = {
    college: "例如：信息工程学院",
    platoon: "例如：三连二排",
    reason: "例如：上课冲突/生病/比赛等",
    proof: "例如：附门诊证明/比赛通知等",
    phone: "例如：13800000000",
    teacher: "例如：张老师",
    place: "例如：教一-101",
  };
  return map[k] || `请输入${fieldLabel(k)}`;
}

function isMultilineField(key) {
  const k = String(key ?? "").trim();
  return k === "reason" || k === "proof" || k.endsWith("Text") || k.endsWith("Desc") || k.endsWith("Note");
}

Page({
  data: {
    isAdmin: false,
    templates: [],
    templateTitles: [],
    templateIndex: 0,
    selectedTemplateId: "",
    selectedTemplateTitle: "",
    selectedTemplateMeta: "",
    manualFields: [],
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
      const templateTitles = templates.map((t) => String(t?.title ?? "") || `模板${String(t?._id ?? "")}`);
      this.setData({ templates, templateTitles });
      if (!this.data.isAdmin && templates.length) {
        const currentId = String(this.data.selectedTemplateId || "");
        if (!currentId) {
          const first = templates[0] || null;
          const id = String(first?._id ?? "");
          const title = String(first?.title ?? "");
          const meta = `${String(first?.format ?? "").toUpperCase()}${first?.category ? ` · ${String(first.category)}` : ""}`;
          this.setData({ templateIndex: 0, selectedTemplateId: id, selectedTemplateTitle: title, selectedTemplateMeta: meta });
          await this.loadTemplateFields(id);
        }
      }
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  async onTemplatePickerChange(e) {
    const idx = Number(e.detail.value || 0);
    const t = this.data.templates[idx] || null;
    const id = String(t?._id ?? "");
    const title = String(t?.title ?? "");
    const meta = `${String(t?.format ?? "").toUpperCase()}${t?.category ? ` · ${String(t.category)}` : ""}`;
    this.setData({
      templateIndex: idx,
      selectedTemplateId: id,
      selectedTemplateTitle: title,
      selectedTemplateMeta: meta,
      manualFields: [],
    });
    if (id) await this.loadTemplateFields(id);
  },

  async loadTemplateFields(id) {
    const tplId = String(id ?? "").trim();
    if (!tplId) return;
    wx.showLoading({ title: "读取模板..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.certTemplateFields({ id: tplId });
      const keys = Array.isArray(resp.manualFields) ? resp.manualFields : [];
      const manualFields = keys.map((k) => ({
        key: String(k),
        label: fieldLabel(k),
        placeholder: fieldPlaceholder(k),
        multiline: isMultilineField(k),
        value: "",
      }));
      this.setData({ manualFields });
    } catch (e) {
      wx.showToast({ title: e?.message || "读取字段失败", icon: "none" });
      this.setData({ manualFields: [] });
    } finally {
      wx.hideLoading();
    }
  },

  onManualFieldInput(e) {
    const key = String(e.currentTarget?.dataset?.key || "");
    const v = String(e.detail?.value ?? "");
    const next = (this.data.manualFields || []).map((f) => (f.key === key ? { ...f, value: v } : f));
    this.setData({ manualFields: next });
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
    this.downloadTemplateById(id);
  },

  onDownloadSelectedTemplate() {
    const id = String(this.data.selectedTemplateId || "");
    if (!id) return;
    this.downloadTemplateById(id);
  },

  downloadTemplateById(id) {
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

  onPreviewPdf() {
    this.downloadAndOpenPdf({ showMenu: false });
  },

  onDownloadPdf() {
    this.downloadAndOpenPdf({ showMenu: true });
  },

  downloadAndOpenPdf({ showMenu }) {
    const id = String(this.data.selectedTemplateId || "");
    if (!id) return;
    const api = require("../../services/api");
    const session = api.auth.getSession();
    const params = {};
    for (const f of this.data.manualFields || []) {
      const k = String(f?.key ?? "").trim();
      if (!k) continue;
      params[k] = String(f?.value ?? "");
    }
    const query = encodeQuery(params);
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
          showMenu: !!showMenu,
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
