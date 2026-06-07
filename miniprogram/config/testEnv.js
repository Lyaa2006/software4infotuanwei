const STORAGE_KEYS = {
  session: "session_v1",
  apiBaseUrl: "api_base_url_v1",
  apiEnvKey: "api_env_key_v1",
};

const TEST_ENV_OPTIONS = [
  {
    key: "lan-api",
    label: "本地开发接口",
    baseUrl: "http://10.10.0.5:3001",
    note: "适用于微信开发者工具预览和同局域网接口直连调试。",
    supportsRealDevice: false,
  },
  {
    key: "lan-web",
    label: "服务器内网入口",
    baseUrl: "http://10.10.0.5",
    note: "适用于经 Nginx 统一转发后的局域网联调，接口路径保持 /api/* 规则一致。",
    supportsRealDevice: false,
  },
  {
    key: "cloudflare",
    label: "临时公网测试",
    baseUrl: "https://entities-paths-bowling-concluded.trycloudflare.com",
    note: "适用于预览、异地联调和真机调试；Cloudflare Quick Tunnel 重启后地址可能变化。",
    supportsRealDevice: true,
  },
];

const DEFAULT_ENV_KEY = "lan-api";

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function getTestingEnvOptions() {
  return TEST_ENV_OPTIONS.map((item) => ({ ...item }));
}

function findTestingEnvByKey(envKey) {
  return TEST_ENV_OPTIONS.find((item) => item.key === envKey) || null;
}

function findTestingEnvByBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  return TEST_ENV_OPTIONS.find((item) => item.baseUrl === normalized) || null;
}

function getDefaultTestingEnv() {
  return findTestingEnvByKey(DEFAULT_ENV_KEY) || TEST_ENV_OPTIONS[0];
}

module.exports = {
  STORAGE_KEYS,
  DEFAULT_ENV_KEY,
  normalizeBaseUrl,
  getTestingEnvOptions,
  findTestingEnvByKey,
  findTestingEnvByBaseUrl,
  getDefaultTestingEnv,
};
