# BookMirror

> 用一面镜子，照出你该读的下一本书。
> An AI-powered personality-based reading recommendation app.

BookMirror 是一个基于 Claude 的个性化读书推荐 APP。它结合用户的 MBTI 性格倾向、当前成长目标、阅读偏好与短板，从精挑细选的书库中推荐 5 本最该读的书，并给出阅读顺序与每本书的重点。

---

## 项目结构

```
BookMirror/
├── docs/                    # 设计文档
│   ├── mvp-flow.md          # MVP 页面流程
│   ├── prompts.md           # Claude prompt 设计
│   ├── book-schema.md       # 书籍标签体系
│   └── app-store.md         # 上架 App Store 清单
├── backend/                 # FastAPI 后端
│   ├── main.py              # 入口
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── config.py        # 环境变量
│       ├── models.py        # Pydantic 模型
│       ├── routes/          # API 路由
│       │   ├── recommend.py
│       │   └── feedback.py
│       ├── services/
│       │   ├── claude.py    # Claude API 封装
│       │   └── book_filter.py  # 候选书筛选
│       └── data/
│           ├── seed_books.json # 种子书库（待填充）
│           └── tags.py         # 标签字典
├── frontend/                # React Native + Expo
│   ├── package.json
│   ├── app.json
│   ├── App.tsx
│   └── src/
│       ├── screens/         # 4 个页面
│       ├── components/
│       ├── data/
│       │   └── mbtiQuestions.ts  # 12 题精简测试（待填充）
│       ├── lib/             # storage / api / i18n
│       ├── theme.ts
│       └── types.ts
└── scripts/
    └── tag_books.py         # 调 Claude 给书批量打标签
```

---

## 当前状态

- [x] 项目骨架
- [x] 后端 FastAPI + Claude 集成
- [x] 前端 4 页面 UI
- [x] 标签字典 + 书籍 schema
- [ ] **MBTI 12 题题库**（用户后续提供）
- [ ] **100 本中文书 + 50 本英文书**（用户后续提供，或用 `scripts/tag_books.py` 批量生成）
- [ ] 订阅 / IAP（第二版）
- [ ] 上架 App Store（按 `docs/app-store.md` 清单）

---

## 快速启动

### 后端

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 填入 ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npx expo start
```

iOS 模拟器按 `i`，安卓按 `a`，手机扫码用 Expo Go。

### 给书批量打标签

```bash
cd scripts
python tag_books.py --input raw_books.txt --output ../backend/app/data/seed_books.json
```

---

## 技术栈

- **前端**：React Native + Expo + TypeScript
- **后端**：FastAPI + Python 3.11
- **AI**：Claude Haiku 4.5（默认）/ Sonnet 4.6（复杂画像）
- **本地存储**：AsyncStorage（第一版不做账号）
- **未来**：Supabase（账号 + 云端数据）、Stripe / 苹果 IAP（订阅）

---

## 数据归属

- 第一版：用户答题结果存本地 AsyncStorage + 后端日志（仅推荐用，不卖不分析）
- 隐私政策见 `docs/app-store.md`

---

## License

私有项目。书籍封面来自 Google Books / Open Library 公开 API。
