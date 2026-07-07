# BookMirror 架构

> 技术栈、结构、数据模型、约束。改结构前先更新这里。

## 技术栈
- **前端**：React Native + Expo SDK 54 + TypeScript。导航 `@react-navigation/native-stack`。发布走 EAS（build 出 APK / update 出 OTA）。
- **后端**：FastAPI + SQLAlchemy 2.0。部署 Render（Docker，push main 自动部署，单实例）。
- **DB**：SQLite（`DATABASE_URL`，Render 挂持久盘 `sqlite:////data/...`）。抽象层用 SQLAlchemy，将来切 MySQL 只改 `DATABASE_URL` + 驱动。
- **AI**：Anthropic Claude（`app/services/claude.py` get_client，模型 `settings.claude_model`）。
- **推送**：直连 FCM HTTP v1（服务账号在 Render 环境变量，不经 Expo 中转）。iOS 未做。

## 目录
```
frontend/
  App.tsx                # 路由注册 + 启动(字体/档案/收藏对账/推送)；有 4s 启动兜底防白屏
  src/screens/*          # 每个页面一个文件
  src/components/        # BookDetailModal、IncomingBanner 等
  src/lib/               # api.ts(所有后端调用) storage.ts(AsyncStorage) i18n.ts LanguageContext navigationRef push chatTime
  src/theme, illustrations, data
  app.json               # Expo 配置(plugins/权限/包名/runtimeVersion=appVersion)
  eas.json               # build/update 档位(channel=preview)
backend/
  main.py                # FastAPI app + include_router + /uploads 静态挂载
  app/routes/*           # 每个领域一个路由文件
  app/services/          # mirror(雪宝) claude book_filter mirror_score 等
  app/db.py              # 所有表 + init_db + _ensure_columns(轻量迁移)
  scripts/               # 一次性数据脚本(见下)
docs/                    # 本目录
```

## 后端路由（`/api` 前缀，`X-App-Token` 网关鉴权，见 `app/security.py`）
recommend / feedback / mbti / astrology / books / synthesis / book_fit / mirror / auth / reviews / reading / social / messages / uploads / push / reader

## 数据表（`app/db.py`）
账号：users, auth_tokens, phone_otps, account_profiles, user_handles(可搜索ID，区分大小写，20天3次), user_remarks
小镜子：mirror_messages, mirror_conversations, mirror_projects, mirror_profiles
书评/阅读：book_reviews, reading_status, user_favorites
社交：follows, profile_visits, direct_messages, push_tokens
阅读器：reader_content(整本 JSON:{chapters:[{index,title,paras[]}]}), reader_progress(锚点:章+段), paragraph_comments, comment_likes

## 关键约定 / 禁止破坏
- **迁移**：`create_all` 不改已存在的表；加列走 `_ensure_columns()` 里的 `ALTER TABLE ... ADD COLUMN`（幂等）。加新表直接 create_all 即可。
- **时间**：SQLite 存 naive UTC；比较用 `datetime.utcnow()`；序列化补 `tzinfo=utc` 再 isoformat。
- **身份**：多数接口前端直接传 `user_id`（匿名或账号），沿用现有惯例，别擅自改成强鉴权。
- **收藏**：本地 AsyncStorage 存整本 + 账号侧存 book_id；toggle 同步、登录/启动 `reconcileFavorites` 取并集恢复。
- **阅读进度**：存「第几章第几段」锚点，不存页码（页码随字号变）。
- **原生模块懒加载**：webview/notifications/clipboard/image-picker/speech 等一律 `require()` in-function + try/catch，OTA 到缺该模块的旧构建不许崩。
- **runtimeVersion=appVersion(0.1.0)**：所有 OTA 命中所有构建 → 顶层 import 原生模块会拖垮旧包，务必懒加载。
- **grounded 荐书**：雪宝只能从后端给的候选书里选（tool 校验），防幻觉。
- **不硬编**：书封面/购买链接/书名/平台 id 一律来自真实数据，不编。
- **密钥**：`ANTHROPIC_API_KEY`、`FCM_SERVICE_ACCOUNT_JSON`、Firebase 服务账号 JSON 绝不进 git；本地跑调 Claude 的脚本用 `env -u ANTHROPIC_API_KEY`。不要重生成 EAS 安卓 keystore(会毁签名)。

## 数据脚本（`backend/scripts/`，本地跑，POST 到 `/api/reader/ingest`）
- `ingest_pdf.py`：文字版 PDF → 章节/段落（认「第X章/回」标题，去重复页眉，兜底切）。
- `ocr_pdf.py`：扫描版 PDF → RapidOCR 取字 → 入库（`--split N` 大部头分册）。
- `ingest_gutenberg.py`：Gutenberg 公版书（繁→简 OpenCC）。
- `epub_ingest.py`：EPUB → 章节（ebooklib+bs4），用户自有授权 EPUB 也走它。
- `ingest_standardebooks.py`：SE 有反爬蜜罐，未启用。
- 依赖只在本地装（PyMuPDF/rapidocr/opencc/ebooklib），**服务器不装**。

## 发布
- 纯 JS 改动：`eas update --branch preview`（OTA，重启 App 生效）。
- 动到原生模块/app.json 原生配置：`eas build -p android --profile preview`（出 APK）。
- 后端：push main → Render 自动部署（~3-5min，单实例 rollover 期间可能 502，轮询到好为止）。
