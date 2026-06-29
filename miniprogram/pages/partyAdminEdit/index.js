function normalizeYmd(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return "";
  return s;
}

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function enrollmentDateMin(accountId) {
  const s = String(accountId || "").trim();
  const match = s.match(/^(\d{4})/);
  const year = Number(match?.[1] || 0);
  const currentYear = Number(localTodayYmd().slice(0, 4));
  if (year >= 1900 && year <= currentYear) return `${year}-01-01`;
  return "1900-01-01";
}

function validatePartyDateOrder(profile) {
  const pairs = [
    ["入党申请时间", normalizeYmd(profile?.applicationDate)],
    ["确定为入党积极分子时间", normalizeYmd(profile?.activistDate)],
    ["确定为发展对象时间", normalizeYmd(profile?.devObjectDate)],
    ["接收为预备党员时间", normalizeYmd(profile?.probationaryDate)],
    ["预备期满一年时间", normalizeYmd(profile?.probationaryFullYearDate)],
    ["转为正式党员时间", normalizeYmd(profile?.fullMemberDate)],
  ].filter(([, value]) => !!value);
  for (let i = 1; i < pairs.length; i += 1) {
    const [prevLabel, prevValue] = pairs[i - 1];
    const [currLabel, currValue] = pairs[i];
    if (prevValue > currValue) return `${currLabel}不能早于${prevLabel}`;
  }
  return "";
}

function stageIndex(stages, value) {
  const idx = (stages || []).findIndex((x) => x.value === value);
  return idx >= 0 ? idx : 0;
}

function stageFromDates(profile) {
  const fullMember = normalizeYmd(profile?.fullMemberDate);
  const probationaryFull = normalizeYmd(profile?.probationaryFullYearDate);
  const probationary = normalizeYmd(profile?.probationaryDate);
  const devObject = normalizeYmd(profile?.devObjectDate);
  const activist = normalizeYmd(profile?.activistDate);
  if (fullMember) return "full_member";
  if (probationaryFull) return "probationary_full_year";
  if (probationary) return "probationary";
  if (devObject) return "dev_object";
  if (activist) return "activist";
  return "group_assessment";
}

function stageStatus(stages, value) {
  return (stages || []).find((x) => x.value === value)?.status || "";
}

Page({
  data: {
    loading: false,
    saving: false,

    accountId: "",
    stages: [],
    stagePickerIndex: 0,
    today: "",
    dateMin: "1900-01-01",
    statusTouched: false,
    nextReportTouched: false,
    nextTalkTouched: false,

    profile: {
      name: "",
      applicationDate: "",
      activistDate: "",
      devObjectDate: "",
      probationaryDate: "",
      probationaryFullYearDate: "",
      fullMemberDate: "",
      currentStage: "group_assessment",
      currentStatus: "",
      nextReportDue: "",
      nextTalkDue: "",
    },
  },

  onLoad(query) {
    this.setData({ accountId: String(query?.accountId || "") });
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
    if (!this.data.accountId) {
      wx.showToast({ title: "缺少学号参数", icon: "none" });
      wx.navigateBack({ delta: 1 });
      return;
    }
    const today = localTodayYmd();
    this.setData({ today, dateMin: enrollmentDateMin(this.data.accountId) });
    this.loadDetail();
  },

  async loadDetail() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.partyAdminStudentDetail({ accountId: this.data.accountId });
      const stages = resp.stages || [];
      const profile = resp.profile || {};
      const nextProfile = {
        name: String(profile.name || ""),
        applicationDate: String(profile.applicationDate || ""),
        activistDate: String(profile.activistDate || ""),
        devObjectDate: String(profile.devObjectDate || ""),
        probationaryDate: String(profile.probationaryDate || ""),
        probationaryFullYearDate: String(profile.probationaryFullYearDate || ""),
        fullMemberDate: String(profile.fullMemberDate || ""),
        currentStage: String(profile.currentStage || "group_assessment"),
        currentStatus: String(profile.currentStatus || ""),
        nextReportDue: String(profile.nextReportDue || ""),
        nextTalkDue: String(profile.nextTalkDue || ""),
      };
      this.setData({
        stages,
        profile: nextProfile,
        statusTouched: false,
        nextReportTouched: false,
        nextTalkTouched: false,
        stagePickerIndex: stageIndex(stages, nextProfile.currentStage),
      });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  setProfileField(field, value) {
    this.setData({ [`profile.${field}`]: value });
  },

  onNameInput(e) {
    this.setProfileField("name", e.detail.value);
  },

  onStatusInput(e) {
    this.setData({ statusTouched: true });
    this.setProfileField("currentStatus", e.detail.value);
  },

  onDatePick(e) {
    const field = String(e.currentTarget.dataset.field || "");
    const value = String(e.detail.value || "");
    this.setProfileField(field, value);
    this.onAfterDateChanged(field);
  },

  onClearDate(e) {
    const field = String(e.currentTarget.dataset.field || "");
    this.setProfileField(field, "");
    this.onAfterDateChanged(field);
  },

  onAfterDateChanged() {
    const computed = stageFromDates(this.data.profile);
    this.setProfileField("currentStage", computed);
    this.setData({ stagePickerIndex: stageIndex(this.data.stages, computed) });
    if (!this.data.statusTouched) {
      const s = stageStatus(this.data.stages, computed);
      if (s) this.setProfileField("currentStatus", s);
    }
  },

  onStageChange(e) {
    const idx = Number(e.detail.value || 0);
    const stage = this.data.stages?.[idx]?.value || "group_assessment";
    this.setProfileField("currentStage", stage);
    this.setData({ stagePickerIndex: idx });
    if (!this.data.statusTouched) {
      const s = stageStatus(this.data.stages, stage);
      if (s) this.setProfileField("currentStatus", s);
    }
  },

  onNextDueInput(e) {
    const field = String(e.currentTarget.dataset.field || "");
    this.setProfileField(field, e.detail.value);
  },

  onNextDuePick(e) {
    const field = String(e.currentTarget.dataset.field || "");
    if (field === "nextReportDue") this.setData({ nextReportTouched: true });
    if (field === "nextTalkDue") this.setData({ nextTalkTouched: true });
    this.setProfileField(field, e.detail.value);
  },

  onClearNextDue(e) {
    const field = String(e.currentTarget.dataset.field || "");
    if (field === "nextReportDue") this.setData({ nextReportTouched: true });
    if (field === "nextTalkDue") this.setData({ nextTalkTouched: true });
    this.setProfileField(field, "");
  },

  async onSave() {
    if (this.data.saving) return;
    const invalidPartyDate = [
      ["入党申请时间", this.data.profile.applicationDate],
      ["确定为入党积极分子时间", this.data.profile.activistDate],
      ["确定为发展对象时间", this.data.profile.devObjectDate],
      ["接收为预备党员时间", this.data.profile.probationaryDate],
      ["预备期满一年时间", this.data.profile.probationaryFullYearDate],
      ["转为正式党员时间", this.data.profile.fullMemberDate],
      ["思想汇报截止日期", this.data.profile.nextReportDue],
      ["谈话截止日期", this.data.profile.nextTalkDue],
    ].find(([, value]) => String(value || "").trim() && !normalizeYmd(value));
    if (invalidPartyDate) {
      wx.showModal({
        title: "保存失败",
        content: `${invalidPartyDate[0]}格式错误或日期无效，应为真实的 YYYY-MM-DD`,
        showCancel: false,
      });
      return;
    }
    const rangeError = [
      ["入党申请时间", this.data.profile.applicationDate],
      ["确定为入党积极分子时间", this.data.profile.activistDate],
      ["确定为发展对象时间", this.data.profile.devObjectDate],
      ["接收为预备党员时间", this.data.profile.probationaryDate],
      ["预备期满一年时间", this.data.profile.probationaryFullYearDate],
      ["转为正式党员时间", this.data.profile.fullMemberDate],
      ["思想汇报截止日期", this.data.profile.nextReportDue],
      ["谈话截止日期", this.data.profile.nextTalkDue],
    ].map(([label, value]) => validateDateRange(label, value, this.data.dateMin, this.data.today)).find(Boolean);
    if (rangeError) {
      wx.showModal({ title: "保存失败", content: rangeError, showCancel: false });
      return;
    }
    const dateOrderError = validatePartyDateOrder(this.data.profile);
    if (dateOrderError) {
      wx.showModal({ title: "保存失败", content: dateOrderError, showCancel: false });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: "保存中..." });
    try {
      const api = require("../../services/api");
      const payload = {
        ...this.data.profile,
        applicationDate: normalizeYmd(this.data.profile.applicationDate) || "",
        activistDate: normalizeYmd(this.data.profile.activistDate) || "",
        devObjectDate: normalizeYmd(this.data.profile.devObjectDate) || "",
        probationaryDate: normalizeYmd(this.data.profile.probationaryDate) || "",
        probationaryFullYearDate: normalizeYmd(this.data.profile.probationaryFullYearDate) || "",
        fullMemberDate: normalizeYmd(this.data.profile.fullMemberDate) || "",
        nextReportDue: normalizeYmd(this.data.profile.nextReportDue) || "",
        nextTalkDue: normalizeYmd(this.data.profile.nextTalkDue) || "",
      };
      if (!this.data.nextReportTouched && !payload.nextReportDue) delete payload.nextReportDue;
      if (!this.data.nextTalkTouched && !payload.nextTalkDue) delete payload.nextTalkDue;
      const resp = await api.featureApi.partyAdminStudentSave({
        accountId: this.data.accountId,
        profile: payload,
      });
      const next = resp.profile || null;
      if (next) {
        this.setData({
          profile: {
            name: String(next.name || ""),
            applicationDate: String(next.applicationDate || ""),
            activistDate: String(next.activistDate || ""),
            devObjectDate: String(next.devObjectDate || ""),
            probationaryDate: String(next.probationaryDate || ""),
            probationaryFullYearDate: String(next.probationaryFullYearDate || ""),
            fullMemberDate: String(next.fullMemberDate || ""),
            currentStage: String(next.currentStage || "group_assessment"),
            currentStatus: String(next.currentStatus || ""),
            nextReportDue: String(next.nextReportDue || ""),
            nextTalkDue: String(next.nextTalkDue || ""),
          },
          stagePickerIndex: stageIndex(this.data.stages, String(next.currentStage || "group_assessment")),
        });
      }
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (e) {
      wx.showToast({ title: e?.message || "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },

  onBackToList() {
    wx.navigateBack({ delta: 1 });
  },
});
