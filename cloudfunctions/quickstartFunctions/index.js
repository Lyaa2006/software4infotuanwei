const cloud = require("wx-server-sdk");
const crypto = require("crypto");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

function normalizeRole(role) {
  return role === "admin" ? "admin" : "student";
}

function normalizeAccountId(accountId) {
  return String(accountId ?? "").trim();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function tokenizeKeywords(text) {
  const raw = String(text ?? "").toLowerCase();
  const tokens = [];

  const han = raw.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const alnum = raw.match(/[a-z0-9]{2,}/g) || [];
  for (const t of han) tokens.push(t);
  for (const t of alnum) tokens.push(t);

  const stop = new Set([
    "请问",
    "如何",
    "怎么",
    "怎样",
    "什么",
    "是否",
    "能否",
    "可以",
    "需要",
    "办理",
    "申请",
    "流程",
    "材料",
    "规定",
    "相关",
    "问题",
    "老师",
    "同学",
    "学校",
  ]);

  const freq = new Map();
  for (const token of tokens) {
    if (stop.has(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (e) {}
}

async function requireAdmin() {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { ok: false, code: "NO_OPENID", message: "无法获取用户身份" };
  }

  const userQuery = await db
    .collection("users")
    .where({ role: "admin", openid })
    .limit(1)
    .get();

  if (!userQuery?.data?.length) {
    return { ok: false, code: "NOT_ADMIN", message: "无管理员权限" };
  }
  return { ok: true, user: userQuery.data[0], openid };
}

async function authLogin(event) {
  const data = event?.data || {};
  const role = normalizeRole(data.role);
  const accountId = normalizeAccountId(data.accountId);
  const password = String(data.password ?? "");
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!accountId) {
    return { success: false, code: "EMPTY_ACCOUNT", message: "请输入学工号" };
  }
  if (!password) {
    return { success: false, code: "EMPTY_PASSWORD", message: "请输入密码" };
  }

  const permitted = await db
    .collection("permitted_accounts")
    .where({ role, accountId, enabled: true })
    .limit(1)
    .get();

  if (!permitted?.data?.length) {
    return { success: false, code: "NOT_PERMITTED", message: "该学工号不在权限清单中" };
  }

  const userQuery = await db
    .collection("users")
    .where({ role, accountId })
    .limit(1)
    .get();

  const now = Date.now();
  if (!userQuery?.data?.length) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = sha256Hex(`${salt}:${password}`);
    await db.collection("users").add({
      data: {
        role,
        accountId,
        passwordHash,
        salt,
        openid,
        createdAt: now,
        lastLoginAt: now,
      },
    });
    return {
      success: true,
      data: { isNew: true, user: { role, accountId }, loginAt: now },
    };
  }

  const existing = userQuery.data[0];
  if (existing.openid && openid && existing.openid !== openid) {
    return { success: false, code: "OPENID_MISMATCH", message: "账号已绑定其他微信用户" };
  }
  const expected = sha256Hex(`${existing.salt}:${password}`);
  if (existing.passwordHash !== expected) {
    return { success: false, code: "WRONG_PASSWORD", message: "密码错误" };
  }

  const updateData = { lastLoginAt: now };
  if (!existing.openid && openid) {
    updateData.openid = openid;
  }
  await db
    .collection("users")
    .doc(existing._id)
    .update({ data: updateData });

  return {
    success: true,
    data: { isNew: false, user: { role, accountId }, loginAt: now },
  };
}

async function qaAsk(event) {
  const question = String(event?.data?.question ?? "").trim();
  if (!question) {
    return { success: false, code: "EMPTY_QUESTION", message: "请输入问题" };
  }

  await ensureCollection("knowledge_qa");

  const extracted = tokenizeKeywords(question);
  const listResp = await db
    .collection("knowledge_qa")
    .where({ enabled: true })
    .orderBy("updatedAt", "desc")
    .limit(200)
    .get();

  const items = listResp?.data || [];
  let best = null;
  let bestScore = -1;
  for (const item of items) {
    const keys = Array.isArray(item.keywords) ? item.keywords.map((x) => String(x).toLowerCase()) : [];
    let overlap = 0;
    for (const k of extracted) {
      if (keys.includes(k)) overlap += 1;
    }
    let score = overlap;
    const stdQ = String(item.question ?? "");
    if (stdQ && question.includes(stdQ)) score += 2;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) {
    return {
      success: true,
      data: {
        answer: "未找到匹配答案",
        matchedQuestion: "",
        keywords: extracted,
      },
    };
  }

  return {
    success: true,
    data: {
      answer: String(best.answer ?? ""),
      matchedQuestion: String(best.question ?? ""),
      keywords: extracted,
    },
  };
}

async function qaList() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return { success: false, code: admin.code, message: admin.message };
  }
  await ensureCollection("knowledge_qa");
  const resp = await db
    .collection("knowledge_qa")
    .orderBy("updatedAt", "desc")
    .limit(200)
    .get();
  return { success: true, data: { items: resp.data || [] } };
}

async function qaUpsert(event) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return { success: false, code: admin.code, message: admin.message };
  }
  await ensureCollection("knowledge_qa");

  const data = event?.data || {};
  const id = String(data.id ?? "").trim();
  const question = String(data.question ?? "").trim();
  const answer = String(data.answer ?? "").trim();
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.map((x) => String(x).trim()).filter(Boolean)
    : [];

  if (!question) {
    return { success: false, code: "EMPTY_STD_QUESTION", message: "请填写标准问题" };
  }
  if (!answer) {
    return { success: false, code: "EMPTY_ANSWER", message: "请填写标准答案" };
  }

  const now = Date.now();
  const payload = {
    question,
    answer,
    keywords,
    enabled: true,
    updatedAt: now,
  };

  if (!id) {
    await db.collection("knowledge_qa").add({
      data: {
        ...payload,
        createdAt: now,
        createdByOpenid: admin.openid,
      },
    });
    return { success: true, data: { ok: true } };
  }

  await db.collection("knowledge_qa").doc(id).update({ data: payload });
  return { success: true, data: { ok: true } };
}

async function qaDelete(event) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return { success: false, code: admin.code, message: admin.message };
  }
  await ensureCollection("knowledge_qa");

  const id = String(event?.data?.id ?? "").trim();
  if (!id) {
    return { success: false, code: "EMPTY_ID", message: "缺少ID" };
  }
  await db.collection("knowledge_qa").doc(id).remove();
  return { success: true, data: { ok: true } };
}

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "authLogin":
      return await authLogin(event);
    case "qaAsk":
      return await qaAsk(event);
    case "qaList":
      return await qaList();
    case "qaUpsert":
      return await qaUpsert(event);
    case "qaDelete":
      return await qaDelete(event);
  }
};
