# TODO

## ✅ 已完成

- [x] **53 题 MBTI 题库** — [mbtiQuestions.ts](frontend/src/data/mbtiQuestions.ts)（含 20 题快速版）
- [x] **AI 推断 MBTI** — Claude tool_use 返回 `{ mbti, confidence, reasoning }`
- [x] Quiz 四步流程 + 知道/不知道 MBTI 双入口 + 快速/完整测评模式
- [x] **141 本中文书库**（去重自 150 → 9 个重复合并），标签全部打好
  - 源文件保留在 [scripts/sources/source_books_150_zh.json](scripts/sources/source_books_150_zh.json)
  - 成品在 [backend/app/data/seed_books.json](backend/app/data/seed_books.json)
  - 11 个 topic、11 个 problem 全部 ≥ 5 本，难度 1–5 均衡分布
- [x] 后端 FastAPI + Claude 集成（SQL 风格筛选 → Claude 排序 → 防幻觉）
- [x] 前端 React Native + Expo 4 页面 + 设置页
- [x] 中英双语 i18n
- [x] 反馈系统（本地 + 后端 JSONL）

## ⏳ 等你继续提供 / 决定

### 1. 后续添加的书

新书可以直接续写到 `backend/app/data/seed_books.json`，沿用 schema：
```json
{
  "id": "book_142",
  "title": "...",
  "author": "...",
  "language": "zh",
  "category": "psychology | business | non_fiction | novel | philosophy | history | biography",
  "difficulty": 1-5,
  "mbti_fit": ["INFP", ...],
  "topics": ["expression", "emotion", ...],
  "problems_solved": ["overthinking", ...],
  "stage": ["universal"],
  "summary": "≤50 字",
  "key_chapters": ["…", "…", "…"],
  "purchase_links": {}
}
```

或者把书名贴给我，我整理。

### 2. 50 本英文书

目前 141 本全是中文（language: "zh"）。海外区上架前需要补英文书。

### 3. 上架前要补的资产

- [ ] App 图标（1024×1024 PNG → `frontend/assets/icon.png`）
- [ ] 启动屏（→ `frontend/assets/splash.png`）
- [ ] 隐私政策 URL
- [ ] 后端部署地址（填入 [app.json](frontend/app.json) 的 `extra.apiBaseUrl`）
- [ ] 53 题英文翻译（如果要上海外区）

### 4. 订阅会员（第二版）

还没想好。常见选项：
- 每月推荐次数（免费 3 次 / 会员无限）
- 模型升级（免费 Haiku / 会员 Sonnet 4.6 更深刻）
- 成长追踪：每月重新测对比变化
- 书单导出 PDF / 分享卡片
- 进阶筛选（"只推荐豆瓣 8.0+"）

### 5. 书的封面图

目前 `cover_url` 全部留空，UI 会显示占位卡片。

补封面图两种方式：
- **方式 A**：跑 `scripts/tag_books.py` 时自动拉 Google Books API 封面
- **方式 B**：手动给每本书填 `cover_url`（Open Library: `https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg`）

---

## 🚀 下一步可以做的事

1. 把书库部署上去跑通完整推荐流程
2. 给我 App 图标或描述风格，我画封面
3. 补 50 本英文书 + 题目英文翻译
4. 部署后端（Railway / Fly.io / Render）
