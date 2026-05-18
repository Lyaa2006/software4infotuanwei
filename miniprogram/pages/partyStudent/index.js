function ymdToCn(ymd) {
  const s = String(ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function buildNodes({ stages, currentStageIndex }) {
  const list = Array.isArray(stages) && stages.length ? stages : [];
  return list.map((s, idx) => {
    let state = "todo";
    if (idx < currentStageIndex) state = "done";
    else if (idx === currentStageIndex) state = "current";
    const lineState = idx < currentStageIndex ? "done" : idx === currentStageIndex ? "current" : "todo";
    return {
      value: s.value,
      label: s.label,
      status: s.status,
      state,
      lineState,
      index: idx,
    };
  });
}

function nodeDetail({ nodeValue, nextReportDue, nextTalkDue, isCurrent }) {
  const todoLines = [];
  if (isCurrent) {
    if (nextReportDue) todoLines.push(`待办：下一次思想汇报不晚于 ${nextReportDue}`);
    if (nextTalkDue) todoLines.push(`待办：下一次谈话不晚于 ${nextTalkDue}`);
  }

  const defs = {
    group_assessment: {
      title: "通过党课学习小组考核阶段任务",
      lines: ["参加党课学习小组学习", "完成规定内容学习", "通过学习小组考核"],
    },
    activist: {
      title: "入党积极分子阶段任务",
      lines: ["按要求参加培养教育", "每三个月提交一次思想汇报", "每半年进行一次谈话"],
    },
    dev_object: {
      title: "发展对象阶段任务",
      lines: ["参加校党校学习", "完成规定课时", "通过结业考试"],
    },
    probationary: {
      title: "预备党员阶段任务",
      lines: ["按要求参加组织生活", "持续提交思想汇报", "按期参加谈话与考察"],
    },
    probationary_full_year: {
      title: "预备期满一年阶段任务",
      lines: ["完成预备期满一年考察材料", "准备转正相关材料", "等待组织审议"],
    },
    full_member: {
      title: "正式入党阶段说明",
      lines: ["已完成转正流程", "继续按要求参加组织生活"],
    },
  };

  const def = defs[nodeValue] || defs.group_assessment;
  const content = []
    .concat(def.lines.map((x) => `- ${x}`))
    .concat(todoLines.length ? ["", ...todoLines.map((x) => x)] : [])
    .join("\n");
  return { title: def.title, content };
}

function buildTopLines(profile) {
  const name = String(profile?.name || "").trim() || `${profile?.accountId || ""}`;
  const a1 = ymdToCn(profile?.applicationDate);
  const a2 = ymdToCn(profile?.activistDate);
  const a3 = ymdToCn(profile?.devObjectDate);
  const status = String(profile?.currentStatus || "").trim();

  const parts = [];
  if (a1) parts.push(`你于${a1}提交入党申请书`);
  if (a2) parts.push(`${a2}成为入党积极分子`);
  if (a3) parts.push(`${a3}成为发展对象`);

  const head = `${name}同学，${parts.length ? parts.join("，") : "请完善入党发展信息"}${status ? `，目前${status}。` : "。"}`;

  const extras = [];
  if (profile?.activistDate) {
    const reportDue = ymdToCn(profile?.nextReportDue);
    const talkDue = ymdToCn(profile?.nextTalkDue);
    extras.push(`自成为入党积极分子后，每三个月需要提交一次思想汇报，下一次提交时间应不晚于${reportDue || "未设置"}；`);
    extras.push(`每半年须进行一次谈话，下一次谈话时间应不晚于${talkDue || "未设置"}。`);
  }

  return { head, extras };
}

Page({
  data: {
    loading: false,
    profile: null,
    stages: [],
    nodes: [],
    topHead: "",
    topExtras: [],
    hint: "提示：点击流程节点查看该阶段说明与待办事项",
  },

  onShow() {
    const api = require("../../services/api");
    const session = api.auth.getSession();
    if (!session?.accountId) {
      wx.reLaunch({ url: "/pages/index/index" });
      return;
    }
    if (session.role === "admin") {
      wx.reLaunch({ url: "/pages/partyAdminList/index" });
      return;
    }
    this.loadProfile();
  },

  async loadProfile() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: "加载中..." });
    try {
      const api = require("../../services/api");
      const resp = await api.featureApi.partyStudentMe();
      const profile = resp.profile || null;
      const stages = resp.stages || [];
      const currentStageIndex = Number(profile?.currentStageIndex || 0);
      const nodes = buildNodes({ stages, currentStageIndex });
      const top = buildTopLines(profile);
      this.setData({
        profile,
        stages,
        nodes,
        topHead: top.head,
        topExtras: top.extras,
      });
    } catch (e) {
      wx.showToast({ title: e?.message || "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  onTapNode(e) {
    const idx = Number(e.currentTarget.dataset.index || 0);
    const node = this.data.nodes?.[idx];
    if (!node) return;
    const profile = this.data.profile || {};
    const currentStageIndex = Number(profile?.currentStageIndex || 0);
    const detail = nodeDetail({
      nodeValue: node.value,
      nextReportDue: profile.nextReportDue,
      nextTalkDue: profile.nextTalkDue,
      isCurrent: idx === currentStageIndex,
    });
    wx.showModal({
      title: node.label,
      content: `${detail.title}\n${detail.content}`,
      showCancel: false,
    });
  },
});

