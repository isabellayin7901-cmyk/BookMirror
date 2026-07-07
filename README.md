# BookMirror

> 用一面镜子，照出你该读的下一本书。
> 中文读书 App：人格画像推书 + AI 陪伴 + 内测书库在线阅读 + 段落评论。

BookMirror 是 React Native/Expo + FastAPI 的读书 App。结合 MBTI × 星座 × AI 画像给你推书；用 AI（雪宝 / Miki）陪你聊、帮你把书读进去；在「内测书库」里真正读完公版/授权的书，并在段落里留下你的批注。

## 文档（先看这些）
- **`docs/PRD.md`** — 产品定位、MVP 范围、功能黑名单、验收标准
- **`docs/DESIGN.md`** — 视觉/交互规范、雪宝语气卡
- **`docs/ARCHITECTURE.md`** — 技术栈、目录、数据表、开发约束、禁止破坏项、发布方式
- **`TODO.md`** — 当前进度，一次做一项
- 早期文档：`docs/mvp-flow.md` `docs/prompts.md` `docs/book-schema.md` `docs/app-store.md`

## 能做什么
推荐书单 · 雪宝(小镜子)AI 阅读与心理陪伴 · 星格(MBTI×星座) · 读后评价与成长 · 社交(ID/关注/私信/主页) · 内测书库在线阅读(WebView 翻页+段落评论) · AI 凭印象找书。

## 技术栈
- 前端：React Native + Expo SDK 54 + TypeScript，EAS 发布（build 出 APK / update 出 OTA）
- 后端：FastAPI + SQLAlchemy，部署 Render（SQLite 持久盘，单实例）
- AI：Anthropic Claude
- 推送：直连 FCM HTTP v1（仅安卓）

## 本地启动
### 后端
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 填 ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npx expo start
```

## 发布
- 纯 JS：`cd frontend && npx eas-cli update --branch preview`（OTA，重启生效）
- 动原生模块/原生配置：`npx eas-cli build -p android --profile preview`（出 APK）
- 后端：push main → Render 自动部署

## 往书库加书（本地脚本 → POST `/api/reader/ingest`）
- EPUB：`python backend/scripts/epub_ingest.py 书.epub --book-id x --api ... --token ...`
- 文字版 PDF：`ingest_pdf.py`；扫描版 PDF：`ocr_pdf.py`（RapidOCR）
- Gutenberg 公版：`ingest_gutenberg.py`
- 只用合法书源：公版 / 用户有权使用的文件。不抓盗版站、不接盗版 API。

## 密钥（绝不进 git）
`ANTHROPIC_API_KEY`、`FCM_SERVICE_ACCOUNT_JSON`、`google-services.json` 的服务账号密钥。`.env` 已 gitignore。本地跑调 Claude 的脚本用 `env -u ANTHROPIC_API_KEY`。

## License
私有项目，内测阶段，无版权内容不可商用。书库仅用公版书与用户有权使用的文件。
