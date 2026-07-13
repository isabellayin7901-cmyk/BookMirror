# BookMirror

> A mirror that shows you the next book you should read.
> A Chinese-language reading app: personality-based book recommendations + an AI reading companion + a built-in library with in-app reading and paragraph-level comments.

[中文版](#bookmirror-中文) below.

BookMirror is a mobile reading app built with React Native/Expo (frontend) and FastAPI (backend). It recommends books from a personality portrait (MBTI × astrology × an AI-distilled psychological profile), pairs you with an AI companion (Xuebao / Miki) that chats with you and helps you actually get through books, and lets you read public-domain / licensed books in the built-in library, leaving annotations on individual paragraphs.

## Features

- **Personalized recommendations** — book lists matched to your MBTI, zodiac sign, and an evolving AI portrait of you
- **AI reading companion** — a conversational AI that remembers context, recommends books mid-chat, and supports voice input and images
- **"Star-grid" profile** — a combined MBTI × astrology personality synthesis
- **Post-reading reviews** — rating + review + self-assessed growth, tied to what problems a book helped with
- **Social** — searchable user IDs, follow/friends, direct messages (text & images), profile pages
- **Built-in library** — in-app reading (WebView pagination) with paragraph-level public comments and private notes, cross-device reading progress
- **Find a book by impression** — describe a half-remembered book and let AI identify it

## Tech stack

- **Frontend**: React Native + Expo SDK 54 + TypeScript; released via EAS (APK builds / OTA updates)
- **Backend**: FastAPI + SQLAlchemy; deployed on Render (SQLite on a persistent disk, single instance)
- **AI**: Anthropic Claude
- **Push notifications**: FCM HTTP v1 (Android)

## Repository layout

- `frontend/` — the Expo app
- `backend/` — the FastAPI service (`app/routes/` API endpoints, `app/services/` AI & astrology logic, `scripts/` book-ingestion tools)
- `docs/` — product & engineering docs (in Chinese): `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`

## Running locally

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # fill in APP_TOKEN (must match the backend's)
npx expo start
```

## Releasing

- JS-only changes: `cd frontend && npx eas-cli update --branch preview` (OTA, applies on restart)
- Native module/config changes: `npx eas-cli build -p android --profile preview` (produces an APK)
- Backend: push to `main` → Render auto-deploys

## Adding books to the library

Local scripts POST to `/api/reader/ingest`:

- EPUB: `python backend/scripts/epub_ingest.py book.epub --book-id x --api ... --token ...`
- Text PDF: `ingest_pdf.py`; scanned PDF: `ocr_pdf.py` (RapidOCR)
- Project Gutenberg: `ingest_gutenberg.py`
- Legal sources only: public-domain works or files the user has rights to. No pirate sites or pirate APIs.

## Secrets (never committed)

`ANTHROPIC_API_KEY`, `APP_TOKEN`, `FCM_SERVICE_ACCOUNT_JSON`, and Google service-account keys live in environment variables / `.env` files (gitignored).

## License

Private project, currently in closed beta. Not for commercial use. The library only contains public-domain works and files users have rights to.

---

# BookMirror（中文）

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
cp .env.example .env   # 填 APP_TOKEN（与后端一致）
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

`ANTHROPIC_API_KEY`、`APP_TOKEN`、`FCM_SERVICE_ACCOUNT_JSON`、`google-services.json` 的服务账号密钥。`.env` 已 gitignore。本地跑调 Claude 的脚本用 `env -u ANTHROPIC_API_KEY`。

## License

私有项目，内测阶段，无版权内容不可商用。书库仅用公版书与用户有权使用的文件。
