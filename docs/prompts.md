# Claude Prompt 设计

## 核心原则

1. **系统提示词固定** → 开 prompt caching，省 90% 输入成本
2. **结构化输出** → 用 tool use，前端直接渲染 JSON
3. **候选库限制** → SQL 先筛 20 本，Claude 只在 20 本里选 5 本，避免幻觉书名
4. **流式响应** → 用户看到 Claude 逐字"思考"，避免 8–15 秒空白

## 推荐流程

```
用户答案 → SQL/JSON 筛 20 本 → Claude 排序 + 画像 → 5 本 JSON → 前端
```

## 模型选择

- **第一版默认**：Haiku 4.5（`claude-haiku-4-5-20251001`）— 快、便宜
- **复杂画像备选**：Sonnet 4.6（`claude-sonnet-4-6`）— 更深刻
- 在 `backend/app/services/claude.py` 一个参数切换

## 成本估算（Haiku 4.5）

- 输入：sys ~500 + 20 本书摘要 ~3000 + 用户答案 ~200 = 3700 tokens
- 输出：~1500 tokens
- 单次 ≈ ¥0.04
- 订阅用户月用 10 次 = ¥0.4 成本，月费 ¥15 利润健康

## System Prompt（缓存）

见 `backend/app/services/claude.py` 中的 `SYSTEM_PROMPT` 常量。

## User Prompt 模板

```
用户画像：
- MBTI: {mbti}（来源：{self|quiz}）
- 当前目标：{goals}
- 阅读偏好：{preferences}，深度倾向 {depth}/10
- 当前问题：{problems}
- 用户自述："{free_text}"

候选书库（20 本，只能在这里选 5 本）：
[{ id, title, author, difficulty, topics, problems_solved, summary }, ...]

请调用 generate_recommendation 工具返回结果。
```

## Tool Schema

定义在 `backend/app/services/claude.py` 的 `RECOMMEND_TOOL`。返回结构：

```json
{
  "profile": {
    "description": "100 字以内画像",
    "keywords": ["关键词1", "关键词2", "关键词3"]
  },
  "growth_gaps": ["短板1（一句话）", "短板2", "短板3"],
  "recommendations": [
    {
      "book_id": "b001",
      "order": 1,
      "why_for_you": "2 句话，引用用户具体输入",
      "key_focus": ["重点章节1", "重点章节2", "重点章节3"]
    }
    // ... 共 5 本
  ]
}
```

## 安全护栏

- System prompt 明确："不给医疗或心理治疗建议；涉及严重情绪问题时提醒用户寻求专业帮助"
- 结果页底部固定文案："推荐由 AI 生成，仅供参考"
- 不允许 Claude 推荐候选库以外的书（system + tool schema 双重约束）
