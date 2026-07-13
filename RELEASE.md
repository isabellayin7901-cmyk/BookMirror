# BookMirror 发布到测试版（TestFlight 内测）操作手册

我已把代码层面的发布加固全部做完。下面是**只需要你动手的几步**（账号、付费、点部署按钮）。

---

## 1. 后端上云（让外部测试者能连上）

代码已就绪：`backend/Dockerfile`、`Procfile`、`render.yaml` 都有了。

### 用 Render（推荐，最省事）
1. 把整个项目推到 GitHub（私有库即可）。
2. 登录 https://render.com → New + → **Blueprint** → 选你的仓库。
   它会读 `backend/render.yaml` 自动建服务。
3. 在服务的 **Environment** 里填两个值（render.yaml 里标了 `sync:false`，必须手填）：
   - `ANTHROPIC_API_KEY` = 你的真实 key
   - `APP_TOKEN` = 与前端 `frontend/.env` 里的 APP_TOKEN 相同的长随机串，
     生成方式：`python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
     （令牌不要写进任何会提交到 git 的文件；想换就两边一起换）
4. 部署完成后会得到一个 **https 域名**，例如 `https://bookmirror-api.onrender.com`。
   打开 `<域名>/health` 看到 `{"status":"ok"}` 即成功。

> Railway / Fly.io 也行：它们能直接用 `backend/Dockerfile`，环境变量填一样的。

## 2. 前端指向云后端

把 `frontend/app.json` 里：
```json
"apiBaseUrl": "http://10.133.60.8:8000"
```
改成第 1 步拿到的 https 域名：
```json
"apiBaseUrl": "https://bookmirror-api.onrender.com"
```
（`appToken` 不在 app.json 里：本地开发写在 `frontend/.env`，EAS 云构建用
`eas env:create --name APP_TOKEN --value <令牌>` 配置，见 `frontend/app.config.js`。）

然后真机连**外网**（关掉同局域网依赖）跑一遍完整流程：测 MBTI → 星盘 → 综合画像 → 推荐 → 点书跳转。

## 3. 打包上 TestFlight

需要 **Apple 开发者账号（$99/年）**。
```bash
cd frontend
npm i -g eas-cli
eas login
eas build:configure          # 已有 eas.json，按提示确认
eas build --profile production --platform ios
eas submit --profile production --platform ios
```
构建产物上传后，在 App Store Connect → TestFlight 里：
- 填隐私政策链接（把 `PRIVACY.md` 挂到任意网页，或用 GitHub Pages）
- 添加外部测试者邮箱 → 发邀请。

> 想更快内测、不走苹果审核：`eas build --profile preview` 出一个内部分发包，
> 直接发链接给少数人装（iOS 仍需把设备 UDID 加进 Provisioning，安卓直接装 apk）。

## 4.（建议）接崩溃上报 Sentry

`ErrorBoundary` 里已留好上报点（`componentDidCatch`）。注册 Sentry → 拿到 DSN：
```bash
npx expo install @sentry/react-native
```
然后在 `App.tsx` 初始化、在 `ErrorBoundary.componentDidCatch` 里 `Sentry.captureException(error)`。
（这步我没自动做，因为需要你的 DSN。要的话告诉我，我接好。）

---

## 我已经做完的（代码层）
- ✅ App 图标 / 自适应图标 / 启动屏（Mico 兔子举星星+夹书，Miki 猫拿狗尾巴草仰望）：`frontend/assets/`
- ✅ 后端 `/api/*` 令牌鉴权（`X-App-Token`）+ 按 IP 限流（默认 30 次/分钟）：`backend/app/security.py`
- ✅ CORS、令牌、限流全部走环境变量：`backend/app/config.py` / `.env.example`
- ✅ 前端所有请求自动带令牌：`frontend/src/lib/api.ts`
- ✅ 全局 ErrorBoundary 友好兜底：`frontend/src/components/ErrorBoundary.tsx`
- ✅ 设置页「反馈与建议」一键发邮件（改 `SettingsScreen.tsx` 里的 `FEEDBACK_EMAIL`）
- ✅ 部署配置：`Dockerfile` / `Procfile` / `render.yaml`
- ✅ 隐私政策中英双语：`PRIVACY.md`
- ✅ EAS 构建配置：`frontend/eas.json`

## 需要你补的小事
- 把 `SettingsScreen.tsx` 里的 `feedback@bookmirror.app` 换成你的真实邮箱。
- 决定正式 `APP_TOKEN`（现在是我生成的随机串，够用）。
