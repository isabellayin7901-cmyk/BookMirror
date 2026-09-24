// 以 app.json 为基础配置，appToken 从环境变量注入，真实令牌不进 git。
// 本地开发：复制 .env.example 为 .env 并填入 APP_TOKEN（Expo CLI 启动时自动加载）。
// EAS 云构建：用 `eas env:create --name APP_TOKEN --value <令牌>` 或在 EAS 控制台配置。
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    appToken: process.env.APP_TOKEN ?? '',
    // 本地联调可用 API_BASE_URL 指向本机后端；不设则用 app.json 里的线上地址
    apiBaseUrl: process.env.API_BASE_URL || config.extra?.apiBaseUrl,
  },
});
