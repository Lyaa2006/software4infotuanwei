const api = require("./services/api");

App({
  onLaunch: function () {
    const runtimeConfig = api.getRuntimeConfig();
    this.globalData = {
      env: "",
      apiEnvKey: runtimeConfig.envKey,
      apiEnvName: runtimeConfig.envName,
      apiBaseUrl: runtimeConfig.baseUrl,
      apiEnvNote: runtimeConfig.note,
      apiSupportsRealDevice: runtimeConfig.supportsRealDevice,
    };
  },
});
