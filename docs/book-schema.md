# 书籍标签体系

## 标签字典

### `mbti_fit`（适合的 MBTI，可多选；留空 `[]` 表示通用）
```
INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP,
ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP
```

### `topics`（主题，对应用户目标）
| key | 含义 |
|---|---|
| expression | 表达 |
| emotion | 情绪管理 |
| career | 职场 |
| power | 权谋 |
| relationship | 人际 |
| learning | 学习方法 |
| finance | 财商 |
| romance | 恋爱关系 |
| self_discipline | 自律 |
| philosophy | 人生意义 |
| creativity | 创造力 |

### `problems_solved`（解决的问题，对应用户痛点）
| key | 含义 |
|---|---|
| overthinking | 容易内耗 |
| low_execution | 执行力差 |
| people_pleasing | 不会拒绝 |
| poor_expression | 表达不清 |
| idealism | 太理想化 |
| procrastination | 拖延 |
| anxiety | 焦虑 |
| no_action | 想得多做得少 |
| low_confidence | 不自信 |
| poor_boundary | 边界感弱 |
| emotional_volatile | 情绪波动大 |

### `difficulty`：1（通俗）—— 5（学术）

### `category`
`novel / non_fiction / history / psychology / business / philosophy / biography`

### `stage`：人生阶段
`student / early_career / mid_career / life_transition / universal`

### `language`：`zh` / `en`（同书中英文分两条记录）

---

## Schema（一本书的完整字段）

```json
{
  "id": "b001",
  "title": "非暴力沟通",
  "author": "马歇尔·卢森堡",
  "isbn": "9787561343647",
  "cover_url": "https://covers.openlibrary.org/b/isbn/9787561343647-L.jpg",
  "language": "zh",
  "category": "psychology",
  "difficulty": 2,
  "mbti_fit": ["INFP", "INFJ", "ENFP", "ISFP"],
  "topics": ["expression", "relationship", "emotion"],
  "problems_solved": ["poor_expression", "poor_boundary", "people_pleasing"],
  "stage": ["universal"],
  "summary": "提出'观察-感受-需要-请求'四步沟通法，帮助跳出指责评判的语言陷阱。",
  "key_chapters": [
    "区分观察与评论",
    "表达感受而非想法",
    "倾听他人的需要"
  ],
  "purchase_links": {
    "douban": "https://book.douban.com/subject/3393213/",
    "amazon": ""
  }
}
```

---

## 怎么整理 100 本中文书 + 50 本英文书

### Step 1 — 列书单（90 分钟）
9 个分类各 15 本，去重 ≈ 100 本：
- 心理学（情绪 / 自我认知 / 关系）
- 商业 / 职场
- 沟通表达
- 自我成长
- 文学 / 小说
- 哲学入门
- 历史
- 传记
- 财商

> 来源：豆瓣读书各分类高分榜、樊登读书会、得到精选。

### Step 2 — 批量打标签（用脚本）

```bash
cd scripts
python tag_books.py --input raw_books.txt --output ../backend/app/data/seed_books.json
```

`raw_books.txt` 每行一本书，格式 `书名|作者|ISBN（可选）`：

```
非暴力沟通|马歇尔·卢森堡|9787561343647
被讨厌的勇气|岸见一郎|9787111495482
原则|瑞·达利欧|
```

脚本流程：
1. 调 Google Books API 拿封面 + ISBN + 简介
2. 调 Claude 按 schema 打 `mbti_fit / topics / problems_solved / difficulty / summary / key_chapters`
3. 输出 `seed_books.json`

### Step 3 — 人工抽查
随机抽 20 本检查标签，准确率一般 80%+。错的手动修。

### Step 4 — 覆盖度自查

每个 `topic`、每个 `problem` 至少要有 **5 本**对应书，否则用户选了筛不到 20 本候选。

| topic | 书数 | 难度分布 | OK? |
|---|---|---|---|
| expression | 8 | 1×3, 2×3, 3×2 | ✅ |
| power | 3 |  | ❌ 需补 |

---

## 封面图来源

1. **首选**：Google Books API
   `https://www.googleapis.com/books/v1/volumes?q=isbn:9787561343647`
2. **备用**：Open Library
   `https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`
3. **不要**直接盗豆瓣图床 URL（防盗链 + 版权风险）
