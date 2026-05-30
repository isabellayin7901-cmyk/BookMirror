"""Claude API wrapper for BookMirror recommendations."""

import json
from typing import Any, Optional

from anthropic import Anthropic

from app.config import settings
from app.models import Book, UserProfile


SYSTEM_PROMPT_ZH = """你是 BookMirror 的阅读顾问。你的工作是基于用户的性格、目标、阅读偏好和当前困扰，从给定的候选书中，选出 6 本最适合的书，按阅读顺序排列。

原则：
0. **必须返回精确 6 本**，不允许少于 6 本（候选库通常有 20 本，足够选）。
1. 你只能从给定的候选书库里选书。绝对不要推荐候选库以外的书。
2. 推荐理由必须引用用户输入的具体词，但**必须用自然中文**，绝对不能出现任何英文标签（如 no_action、overthinking、career、power、finance、self_discipline、emotion 等）。
3. **三维度综合**（按重要性排序）：
   - 最重要：用户的当前问题（痛点）+ 当前目标（想成长的方向）
   - 其次：MBTI 思考方式（决定书的难度和论证风格匹配）
   - 锦上添花：星座（情绪基调 + 审美），性别（视角与共鸣的多元化）
4. 6 本书要形成一条成长路径：第 1 本最易读且最贴近用户当下痛点，第 6 本最深刻。
5. 6 本推荐理由里至少 **2 本**要把"MBTI × 星座"或"MBTI × 性别 × 星座"的组合特质点出来一句（如"你 INTJ 的系统思维 × 处女座的细致，《xxx》正好…"）。其余可以单聚焦痛点。
6. 不要给医疗或心理治疗建议。涉及严重情绪问题时，提醒用户寻求专业帮助。
7. 你必须调用 generate_recommendation 工具返回结构化结果，不要返回纯文本。
8. 引号也不能包含英文标签。

**正面示例（必须这样写）**：
✅ "你提到'想得多做得少'，这本书直击执行力问题。"
✅ "你的目标包括'职场'、'权谋'、'财商'，《原则》是综合性框架。"
✅ "你追求权力与事业，曾国藩是中国历史上权力与修养的完美范本。"

**负面示例（绝对禁止）**：
❌ "你提到'no_action'，这本书直击问题。"
❌ "你的目标包含'career'、'power'和'finance'。"
❌ "你追求'power'和'career'。"
❌ "你提到'overthinking'。"

引用用户输入时，把英文 key 翻译成对应中文：
- no_action → 想得多做得少    overthinking → 容易内耗    low_execution → 执行力差
- procrastination → 拖延      anxiety → 焦虑         low_confidence → 不自信
- people_pleasing → 不会拒绝别人    poor_expression → 表达不清楚
- poor_boundary → 边界感弱    idealism → 太理想化    emotional_volatile → 情绪波动大
- career → 职场    power → 权谋    finance → 财商    expression → 表达
- emotion → 情绪管理    relationship → 人际    learning → 学习方法
- romance → 恋爱关系    self_discipline → 自律
"""

SYSTEM_PROMPT_EN = """You are BookMirror's reading advisor. Your task is to select the 6 best books from candidate list based on the user's personality, goals, reading preferences, and current challenges, arranged in reading order.

Principles:
0. **Must return exactly 6 books** — no fewer (candidate pool usually has 20+, enough to choose).
1. You can only select from the given candidate pool. Never recommend books outside the list.
2. Recommendation reasons must reference the user's specific input, using **natural English**. Never use English tags (no_action, overthinking, career, power, finance, self_discipline, emotion, etc.).
3. **Three-dimensional synthesis** (by importance):
   - Most important: User's current challenges (pain points) + current goals (growth direction)
   - Secondary: MBTI thinking style (determines book difficulty and argumentation style match)
   - Bonus: Zodiac (emotional tone + aesthetic), gender (perspective & empathy diversity)
4. The 6 books should form a growth path: book 1 most readable & closest to user's current pain point; book 6 most profound.
5. In the recommendation reasons for at least **2 books**, highlight "MBTI × Zodiac" or "MBTI × Gender × Zodiac" combination traits (e.g., "Your INTJ systematic thinking × Virgo attention to detail makes [Book Title] perfect for you").
6. Do not provide medical or psychological therapy advice. If serious emotional issues arise, encourage user to seek professional help.
7. You must call the generate_recommendation tool to return structured results — never plain text.
8. Do not include English tags in quotes.

**Good examples (must follow this)**：
✅ "You mentioned 'analysis paralysis' — this book tackles execution directly."
✅ "Your goals include 'career growth', 'leadership', 'finances' — [Book] is a synthesis framework."
✅ "You seek personal growth and wisdom; this author is a perfect guide on that journey."

**Bad examples (absolutely forbidden)**：
❌ "You mentioned 'no_action' — this book tackles the problem."
❌ "Your goals contain 'career', 'power', 'finance'."
❌ "You're seeking 'power' and 'career'."

When referencing user input, translate English keys into natural English:
- no_action → analysis paralysis / over-thinking without doing    overthinking → rumination
- low_execution → poor follow-through    procrastination → procrastination    anxiety → anxiety    low_confidence → self-doubt
- people_pleasing → difficulty saying no    poor_expression → communication struggles    poor_boundary → weak boundaries
- idealism → idealism    emotional_volatile → emotional turbulence    career → career    power → leadership/influence
- finance → financial literacy    expression → communication    emotion → emotional management    relationship → relationships
- learning → learning strategies    romance → romantic relationships    self_discipline → discipline/self-control    philosophy → life meaning    creativity → creativity
"""

SYSTEM_PROMPT = SYSTEM_PROMPT_ZH  # default


RECOMMEND_TOOL: dict[str, Any] = {
    "name": "generate_recommendation",
    "description": "返回个性化阅读推荐结果",
    "input_schema": {
        "type": "object",
        "required": ["profile", "growth_gaps", "recommendations"],
        "properties": {
            "profile": {
                "type": "object",
                "required": ["description", "keywords"],
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "100 字以内的用户阅读画像",
                    },
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 3,
                        "maxItems": 3,
                    },
                },
            },
            "growth_gaps": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 3,
                "description": "用户现在最该补的 3 个能力，每条一句话",
            },
            "recommendations": {
                "type": "array",
                "minItems": 6,
                "maxItems": 6,
                "items": {
                    "type": "object",
                    "required": ["book_id", "order", "why_for_you", "key_focus"],
                    "properties": {
                        "book_id": {"type": "string"},
                        "order": {"type": "integer", "minimum": 1, "maximum": 6},
                        "why_for_you": {
                            "type": "string",
                            "description": "2 句话，必须引用用户具体输入",
                        },
                        "key_focus": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 3,
                            "maxItems": 3,
                        },
                    },
                },
            },
        },
    },
}


# ----- 中文标签映射：英文 key → 用户看到的中文 -----
# Claude 必须用这些中文词来引用用户的回答，不能出现英文 key。
GOAL_ZH = {
    "expression": "表达", "emotion": "情绪管理", "career": "职场",
    "power": "权谋", "relationship": "人际", "learning": "学习方法",
    "finance": "财商", "romance": "恋爱关系", "self_discipline": "自律",
    "philosophy": "人生意义", "creativity": "创造力",
}
PROBLEM_ZH = {
    "overthinking": "容易内耗", "low_execution": "执行力差",
    "people_pleasing": "不会拒绝别人", "poor_expression": "表达不清楚",
    "idealism": "太理想化", "procrastination": "拖延",
    "anxiety": "焦虑", "no_action": "想得多做得少",
    "low_confidence": "不自信", "poor_boundary": "边界感弱",
    "emotional_volatile": "情绪波动大",
}
PREFERENCE_ZH = {
    "novel": "小说", "non_fiction": "非虚构", "history": "历史",
    "psychology": "心理学", "business": "商业",
    "philosophy": "哲学", "biography": "传记",
}


def _translate(keys: list[str], mapping: dict[str, str]) -> list[str]:
    return [mapping.get(k, k) for k in keys]


def _build_user_prompt(profile: UserProfile, candidates: list[Book]) -> str:
    if profile.language == "en":
        return _build_user_prompt_en(profile, candidates)
    return _build_user_prompt_zh(profile, candidates)


def _build_user_prompt_zh(profile: UserProfile, candidates: list[Book]) -> str:
    # 候选书也把 topics / problems_solved 翻译成中文，避免 Claude 抄英文
    candidate_dump = [
        {
            "id": b.id,
            "title": b.title,
            "author": b.author,
            "difficulty": b.difficulty,
            "topics": _translate(b.topics, GOAL_ZH),
            "problems_solved": _translate(b.problems_solved, PROBLEM_ZH),
            "summary": b.summary,
        }
        for b in candidates
    ]
    goals_zh = "、".join(_translate(profile.goals, GOAL_ZH)) or "（未填）"
    problems_zh = "、".join(_translate(profile.problems, PROBLEM_ZH)) or "（未填）"
    prefs_zh = "、".join(_translate(profile.preferences, PREFERENCE_ZH)) or "（未填）"

    zodiac_line = ""
    if profile.zodiac:
        z = profile.zodiac
        zodiac_line = f"- 星座：{z.sun_sign}（{z.element}象，关键词：{'/'.join(z.keywords)}）\n"

    gender_zh = {"female": "女性", "male": "男性", "other": "其他/不愿透露"}
    gender_line = ""
    if profile.gender:
        gender_line = f"- 性别：{gender_zh.get(profile.gender, '未填')}\n"

    return (
        f"用户画像：\n"
        f"- MBTI: {profile.mbti}（来源：{profile.mbti_source}）\n"
        f"{zodiac_line}"
        f"{gender_line}"
        f"- 当前目标：{goals_zh}\n"
        f"- 阅读偏好：{prefs_zh}，深度倾向 {profile.depth}/10\n"
        f"- 当前问题：{problems_zh}\n"
        f"- 用户自述：\"{profile.free_text}\"\n\n"
        f"候选书库（{len(candidates)} 本，只能在这里选书）：\n"
        f"{json.dumps(candidate_dump, ensure_ascii=False, indent=2)}\n\n"
        f"请调用 generate_recommendation 工具返回结果。"
        f"\n\n⚠️ 关键：引用用户的目标/问题/偏好时必须用中文词，"
        f"绝对不能出现 'no_action'、'overthinking'、'self_discipline' 这种英文标签。"
        f"\n如果有星座信息，可以在 1-2 本书的推荐理由里轻轻提一下"
        f"（如 \"你处女座的细致与 INTJ 的系统思维结合，《xxx》很适合\"）。"
        f"\n⚠️ 性别处理原则：性别只是参考维度，不要做刻板印象推荐"
        f"（不要因为女性就只推爱情/治愈书，因为男性就只推商业/权谋书）。"
        f"可以在书目作者、视角的多元化上做轻微平衡（如给女性用户适当多一些女作家或女性视角作品）。"
    )


def _build_user_prompt_en(profile: UserProfile, candidates: list[Book]) -> str:
    """Build English-language user prompt for recommendation."""
    # Prepare candidate books with English translations of topics/problems
    candidate_dump = [
        {
            "id": b.id,
            "title": b.title_en or b.title,  # Use English title if available
            "author": b.author_en or b.author,  # Use English author if available
            "difficulty": b.difficulty,
            "topics": b.topics,  # Keep English tags for clarity
            "problems_solved": b.problems_solved,
            "summary": b.summary,
        }
        for b in candidates
    ]

    # Convert user preferences to English
    goal_labels = {
        "expression": "communication", "emotion": "emotional management", "career": "career",
        "power": "leadership/influence", "relationship": "relationships", "learning": "learning strategies",
        "finance": "financial literacy", "romance": "romantic relationships", "self_discipline": "discipline",
        "philosophy": "life meaning", "creativity": "creativity",
    }
    problem_labels = {
        "overthinking": "rumination/analysis paralysis", "low_execution": "poor follow-through",
        "people_pleasing": "difficulty saying no", "poor_expression": "communication struggles",
        "idealism": "idealism", "procrastination": "procrastination",
        "anxiety": "anxiety", "no_action": "analysis paralysis",
        "low_confidence": "self-doubt", "poor_boundary": "weak boundaries",
        "emotional_volatile": "emotional turbulence",
    }
    pref_labels = {
        "novel": "fiction", "non_fiction": "non-fiction", "history": "history",
        "psychology": "psychology", "business": "business",
        "philosophy": "philosophy", "biography": "biography",
    }

    goals_en = ", ".join([goal_labels.get(g, g) for g in profile.goals]) or "(not filled)"
    problems_en = ", ".join([problem_labels.get(p, p) for p in profile.problems]) or "(not filled)"
    prefs_en = ", ".join([pref_labels.get(p, p) for p in profile.preferences]) or "(not filled)"

    zodiac_line = ""
    if profile.zodiac:
        z = profile.zodiac
        zodiac_line = f"- Zodiac: {z.sun_sign} ({z.element}, keywords: {'/'.join(z.keywords)})\n"

    gender_en = {"female": "Female", "male": "Male", "other": "Other/Prefer not to say"}
    gender_line = ""
    if profile.gender:
        gender_line = f"- Gender: {gender_en.get(profile.gender, 'Not filled')}\n"

    return (
        f"User Profile:\n"
        f"- MBTI: {profile.mbti} (from {profile.mbti_source})\n"
        f"{zodiac_line}"
        f"{gender_line}"
        f"- Current Goals: {goals_en}\n"
        f"- Reading Preferences: {prefs_en}, depth preference {profile.depth}/10\n"
        f"- Current Challenges: {problems_en}\n"
        f"- User Notes: \"{profile.free_text}\"\n\n"
        f"Candidate Books ({len(candidates)} total, select only from this list):\n"
        f"{json.dumps(candidate_dump, ensure_ascii=False, indent=2)}\n\n"
        f"Please call the generate_recommendation tool to return results.\n\n"
        f"⚠️ Important: When referencing user's goals/challenges/preferences, use natural English terms. Never use English tags like 'no_action', 'overthinking', 'career', 'power', 'finance', 'self_discipline', 'emotion', etc.\n"
        f"If zodiac information is available, lightly reference it in 1-2 book recommendation reasons "
        f"(e.g., \"Your Virgo attention to detail combined with INTJ systematic thinking makes [Book] perfect for you\").\n"
        f"⚠️ Gender handling principle: Gender is only a reference dimension; avoid stereotypical recommendations. "
        f"Gently balance author gender and perspective diversity (e.g., offering more female authors or female-perspective works to female users)."
    )


def get_client() -> Anthropic:
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set; check backend/.env")
    return Anthropic(api_key=settings.anthropic_api_key)


# ----------------------------- MBTI inference -----------------------------

MBTI_SYSTEM_PROMPT = """你是 Mico，一只温柔的小兔子，会根据用户的答题推断他的 MBTI。

判断原则：
1. 综合多题判断每个维度（E/I, S/N, T/F, J/P），不要被单题答案带偏。
2. 滑杆 0-2 偏左端，3-5 偏右端，2.5 模糊。题目里的左右标签代表两端含义。
3. "看情况""看心情""看环境"等中立态度：弱化该题在对应维度上的权重。
4. 涉及情绪稳定度（压力、安全感、自我怀疑）的题 —— 与 MBTI 4 字母维度无关，仅作辅助参考。

reasoning 字段的写作风格（最重要！）：
- 用 Mico的口吻，第一人称"我"或第二人称"你"
- 温柔治愈，像朋友在聊天，不是心理报告
- 不能出现"Q1、Q15、维度、权重"这种科学术语
- 不能引用题号
- 用日常语言描述对方是怎样的人：比如"你似乎更喜欢一个人安静地思考""你在意细节，喜欢有计划的生活"
- ≤100 字
- 输出语言遵循 user_language（zh 中文 / en 英文）
- 句末可以加 1 个温暖的小总结，比如"这样的你也很可爱呀 🌿"

示例好 reasoning：
"我感觉你是一个很沉稳、有计划的人呢。你喜欢一个人静静做事，会先想清楚再行动；做决定时更相信事实而不是感觉。这样踏实的你，其实很值得被温柔对待 🌿"

示例坏 reasoning（不要这样写）：
"E/I：Q1/Q15 明确偏内向（否+0.0）→ I。S/N：Q2/Q17/Q21 偏低 → S。"

必须调用 infer_mbti 工具返回结果。
"""

MBTI_TOOL: dict[str, Any] = {
    "name": "infer_mbti",
    "description": "根据用户答题推断 MBTI 4 字母类型",
    "input_schema": {
        "type": "object",
        "required": ["mbti", "confidence", "reasoning"],
        "properties": {
            "mbti": {
                "type": "string",
                "enum": [
                    "INTJ", "INTP", "ENTJ", "ENTP",
                    "INFJ", "INFP", "ENFJ", "ENFP",
                    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
                    "ISTP", "ISFP", "ESTP", "ESFP",
                ],
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "reasoning": {"type": "string", "description": "≤80 字的判断依据"},
        },
    },
}


def _format_answer(raw: dict[str, Any]) -> str:
    kind = raw.get("kind")
    if kind == "yesno":
        return f"[选择] {raw.get('label', raw.get('value'))}"
    if kind == "choice3":
        return f"[选择] {raw.get('label')}"
    if kind == "slider":
        v = raw.get("value", 0)
        return f"[滑杆 0-5] {round(float(v), 1)}"
    return str(raw)


from app.services.astrology_calc import compute_chart, compute_houses, _longitude_to_sign

# Claude 只负责"基于已算好的星座写人格描述"——不再让它猜星座。
ZODIAC_DESCRIBE_SYSTEM = """你是 Mico 的占星朋友 Astro，会根据已经精确算好的星盘数据，写一段温柔的人格描述。

你**绝对不要**自己判断或修改任何星座，星座是已经用 Swiss Ephemeris 精确算好的，你只需要：
1. 写 description：100-120 字人格分析，第二人称"你"，结合太阳/月亮/上升的特质
2. 写 keywords：3 个关键词（如"独立"、"敏感"、"理想主义"）

风格：
- 像朋友聊天，不要学术
- 写优点也写挑战
- 不做预测、宿命论、运势

必须调用 describe_zodiac 工具返回结果。
"""

ZODIAC_DESCRIBE_TOOL: dict[str, Any] = {
    "name": "describe_zodiac",
    "description": "根据已算好的星座写人格描述",
    "input_schema": {
        "type": "object",
        "required": ["description", "keywords"],
        "properties": {
            "description": {"type": "string", "description": "≤120 字人格分析"},
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3, "maxItems": 3,
            },
        },
    },
}


def infer_zodiac(
    year: int, month: int, day: int, hour: int, minute: int = 0,
    latitude: Optional[float] = None, longitude: Optional[float] = None,
    language: str = "zh",
) -> dict[str, Any]:
    """精确计算星座（Python），Claude 只写描述。"""
    chart = compute_chart(year, month, day, hour, minute)
    rising: Optional[str] = None
    rising_longitude: Optional[float] = None
    houses_data: Optional[dict] = None
    if latitude is not None and longitude is not None:
        houses_data = compute_houses(year, month, day, hour, minute, latitude, longitude)
        if houses_data:
            rising = houses_data["ascendant_sign"]
            rising_longitude = houses_data["ascendant_longitude"]

    rising_line = f"上升星座：{rising}（已根据出生地精确计算）\n" if rising else ""
    user_prompt = (
        f"用户的精确星盘（请不要修改这些）：\n"
        f"太阳星座：{chart['sun_sign']}\n"
        f"月亮星座：{chart['moon_sign']}\n"
        f"水星：{chart['mercury_sign']}（思考/沟通）\n"
        f"金星：{chart['venus_sign']}（爱与审美）\n"
        f"火星：{chart['mars_sign']}（行动力）\n"
        f"{rising_line}"
        f"元素：{chart['element']}\n"
        f"\n请基于这些星的组合，写温柔的人格描述。"
        f"\n语言：{language}\n"
        f"请调用 describe_zodiac 工具返回。"
    )
    if language == "en":
        user_prompt += (
            "\n\nIMPORTANT: The user's language is English. Write BOTH the description "
            "AND all keywords in natural, fluent English (e.g. keywords like "
            '"Independent", "Idealistic", "Balanced"). Do NOT use any Chinese.'
        )
    else:
        user_prompt += "\n\n重要：用户语言是中文，description 和 keywords 全部用中文输出。"

    client = get_client()
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=500,
        system=[
            {
                "type": "text",
                "text": ZODIAC_DESCRIBE_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[ZODIAC_DESCRIBE_TOOL],
        tool_choice={"type": "tool", "name": "describe_zodiac"},
        messages=[{"role": "user", "content": user_prompt}],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "describe_zodiac":
            described: dict[str, Any] = block.input  # type: ignore[assignment]
            chart_data: dict = {
                "sun": {"sign": chart["sun_sign"], "longitude": chart["sun_longitude"]},
                "moon": {"sign": chart["moon_sign"], "longitude": chart["moon_longitude"]},
                "mercury": {"sign": chart["mercury_sign"], "longitude": chart["mercury_longitude"]},
                "venus": {"sign": chart["venus_sign"], "longitude": chart["venus_longitude"]},
                "mars": {"sign": chart["mars_sign"], "longitude": chart["mars_longitude"]},
                "jupiter": {"sign": chart["jupiter_sign"], "longitude": chart["jupiter_longitude"]},
                "saturn": {"sign": chart["saturn_sign"], "longitude": chart["saturn_longitude"]},
            }
            if rising and rising_longitude is not None:
                chart_data["ascendant"] = {"sign": rising, "longitude": rising_longitude}
            if houses_data:
                chart_data["houses"] = houses_data["cusps"]
                chart_data["mc_longitude"] = houses_data["mc_longitude"]
            return {
                "sun_sign": chart["sun_sign"],
                "moon_sign": chart["moon_sign"],
                "rising_sign": rising,
                "element": chart["element"],
                "description": described["description"],
                "keywords": described["keywords"],
                "chart": chart_data,
            }
    raise RuntimeError("Claude did not call describe_zodiac tool")


def infer_mbti(answers: list[dict[str, Any]], language: str = "zh") -> dict[str, Any]:
    """Call Claude with raw question/answer pairs and return inferred MBTI."""
    client = get_client()

    lines = [f"user_language: {language}\n答题记录："]
    for i, a in enumerate(answers, 1):
        lines.append(f"{i}. {a['question_text']}\n   → {_format_answer(a['answer'])}")
    user_prompt = "\n".join(lines) + "\n\n请调用 infer_mbti 工具返回 MBTI 结果。"

    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=600,
        system=[
            {
                "type": "text",
                "text": MBTI_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[MBTI_TOOL],
        tool_choice={"type": "tool", "name": "infer_mbti"},
        messages=[{"role": "user", "content": user_prompt}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "infer_mbti":
            return block.input  # type: ignore[return-value]

    raise RuntimeError("Claude did not call infer_mbti tool")


# ----------------------- MBTI × Zodiac synthesis -----------------------

SYNTHESIS_SYSTEM = """你是 Mico 的伙伴，会把一个人的 MBTI 性格类型和星座星盘揉成一幅"综合画像"。

你拿到的是已经确定好的 MBTI（4 字母）和星座（太阳/月亮/上升 + 元素），不要质疑或改动它们。
你的任务是把"心理学的 MBTI"与"占星的星座"两套语言融合成一个完整、立体的人。

输出要求（必须调用 synthesize_persona 工具）：
1. title：一句话人格标签，富有诗意又好懂，融合两者气质（如"理想主义的水象筑梦者""务实而温柔的土象守护者"）。≤16 字。
2. description：120-160 字综合人格描述，第二人称"你"。要真正把 MBTI 与星座结合起来讲（如 MBTI 的思维方式 × 月亮的情感底色），而不是分开罗列。温柔、像朋友。
3. strengths：2-3 条优势，每条短句。
4. blindspots：2-3 条盲点 / 成长挑战，每条短句，温柔不评判。
5. keywords：3-4 个关键词。

风格：治愈、具体、不学术；不做预测、运势、宿命论。
输出语言遵循 user_language（zh 中文 / en 英文）。
"""

SYNTHESIS_TOOL: dict[str, Any] = {
    "name": "synthesize_persona",
    "description": "把 MBTI 与星座融合成综合人格画像",
    "input_schema": {
        "type": "object",
        "required": ["title", "description", "strengths", "blindspots", "keywords"],
        "properties": {
            "title": {"type": "string", "description": "≤16 字人格标签"},
            "description": {"type": "string", "description": "120-160 字综合描述"},
            "strengths": {
                "type": "array", "items": {"type": "string"},
                "minItems": 2, "maxItems": 3,
            },
            "blindspots": {
                "type": "array", "items": {"type": "string"},
                "minItems": 2, "maxItems": 3,
            },
            "keywords": {
                "type": "array", "items": {"type": "string"},
                "minItems": 3, "maxItems": 4,
            },
        },
    },
}


def infer_synthesis(
    mbti: str,
    sun_sign: str,
    element: str,
    moon_sign: Optional[str] = None,
    rising_sign: Optional[str] = None,
    gender: Optional[str] = None,
    language: str = "zh",
) -> dict[str, Any]:
    """Fuse MBTI + zodiac into one combined persona portrait."""
    client = get_client()

    _gender_label = {"female": "女", "male": "男", "other": "其他/不愿透露"}

    lines = [
        f"user_language: {language}",
        f"MBTI：{mbti}",
        f"太阳星座：{sun_sign}（{element}象）",
    ]
    if moon_sign:
        lines.append(f"月亮星座：{moon_sign}（情感底色）")
    if rising_sign:
        lines.append(f"上升星座：{rising_sign}（外在气质）")
    if gender:
        # 性别只是弱相关的轻参考，不要据此下刻板结论
        lines.append(f"性别：{_gender_label.get(gender, gender)}（弱参考，仅作语气与视角的轻微调整，切勿刻板化）")
    user_prompt = "\n".join(lines) + "\n\n请把这两套人格语言融合，调用 synthesize_persona 工具返回综合画像。"

    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=900,
        system=[
            {
                "type": "text",
                "text": SYNTHESIS_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[SYNTHESIS_TOOL],
        tool_choice={"type": "tool", "name": "synthesize_persona"},
        messages=[{"role": "user", "content": user_prompt}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "synthesize_persona":
            return block.input  # type: ignore[return-value]

    raise RuntimeError("Claude did not call synthesize_persona tool")


BOOK_FIT_SYSTEM = """你是 Mico 的伙伴，会为一个具体的人，解释「为什么这一本书适合 ta」。

你拿到的是：
- 一本确定的书（书名 / 作者 / 简介 / 主题 / 难度）。
- 这个人的画像：MBTI 性格类型、星座（太阳/月亮/上升 + 元素）、ta 的阅读目标 / 想解决的困扰 / 阅读偏好 / 自述。

你的任务（必须调用 explain_book_fit 工具）：
1. why_for_you：80-130 字，第二人称「你」。必须做到「点对点」——
   - 把这本书的具体内容，和「你」的 MBTI 思维方式、星座情感底色（综合画像）、以及你当下的目标/困扰，真正勾连起来。
   - 要具体到这本书，不能是任何书都能套的空话。
   - 自然融合 MBTI × 星座（如：INTJ 的系统思维 × 天蝎的深掘欲），而不是分开罗列标签。
   - 温柔、像懂你的朋友，不学术、不算命、不下论断。
2. key_focus：2-3 条，结合「你」的画像，这本书你该重点关注/带着什么问题去读的提示，每条短句。

输出语言遵循 user_language（zh 中文 / en 英文）。"""

BOOK_FIT_TOOL: dict[str, Any] = {
    "name": "explain_book_fit",
    "description": "结合用户 MBTI×星座综合画像与需求，解释这本书为什么适合 ta",
    "input_schema": {
        "type": "object",
        "required": ["why_for_you", "key_focus"],
        "properties": {
            "why_for_you": {"type": "string", "description": "80-130 字，点对点说明"},
            "key_focus": {
                "type": "array", "items": {"type": "string"},
                "minItems": 2, "maxItems": 3,
            },
        },
    },
}

# 中英标签的中文映射，让 prompt 更可读（缺失就用原值）
def _join_or_dash(items: list[str]) -> str:
    return "、".join(items) if items else "—"


def infer_book_fit(
    *,
    book_title: str,
    book_author: str = "",
    book_summary: str = "",
    book_topics: Optional[list[str]] = None,
    book_category: str = "",
    book_difficulty: int = 3,
    mbti: Optional[str] = None,
    sun_sign: Optional[str] = None,
    moon_sign: Optional[str] = None,
    rising_sign: Optional[str] = None,
    element: Optional[str] = None,
    goals: Optional[list[str]] = None,
    problems: Optional[list[str]] = None,
    preferences: Optional[list[str]] = None,
    free_text: str = "",
    language: str = "zh",
) -> dict[str, Any]:
    """Explain why ONE specific book fits THIS user (MBTI × zodiac × needs)."""
    client = get_client()

    lines = [
        f"user_language: {language}",
        "",
        "【这本书】",
        f"书名：{book_title}",
    ]
    if book_author:
        lines.append(f"作者：{book_author}")
    if book_category:
        lines.append(f"分类：{book_category}")
    if book_topics:
        lines.append(f"主题：{_join_or_dash(book_topics)}")
    lines.append(f"难度：{book_difficulty}/5")
    if book_summary:
        lines.append(f"简介：{book_summary}")

    lines += ["", "【这个人】"]
    if mbti:
        lines.append(f"MBTI：{mbti}")
    if sun_sign:
        z = f"太阳星座：{sun_sign}"
        if element:
            z += f"（{element}象）"
        lines.append(z)
    if moon_sign:
        lines.append(f"月亮星座：{moon_sign}（情感底色）")
    if rising_sign:
        lines.append(f"上升星座：{rising_sign}（外在气质）")
    lines.append(f"阅读目标：{_join_or_dash(goals or [])}")
    lines.append(f"想解决的困扰：{_join_or_dash(problems or [])}")
    lines.append(f"阅读偏好：{_join_or_dash(preferences or [])}")
    if free_text:
        lines.append(f"ta 的自述：{free_text}")

    user_prompt = "\n".join(lines) + "\n\n请调用 explain_book_fit，点对点说明这本书为什么适合 ta。"
    if language == "en":
        user_prompt += (
            "\n\nIMPORTANT: The user's language is English. "
            "Write why_for_you AND every key_focus item in natural, fluent English. "
            "Do NOT use any Chinese."
        )
    else:
        user_prompt += "\n\n重要：用户语言是中文，why_for_you 和 key_focus 全部用中文输出。"

    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=700,
        system=[
            {
                "type": "text",
                "text": BOOK_FIT_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[BOOK_FIT_TOOL],
        tool_choice={"type": "tool", "name": "explain_book_fit"},
        messages=[{"role": "user", "content": user_prompt}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "explain_book_fit":
            return block.input  # type: ignore[return-value]

    raise RuntimeError("Claude did not call explain_book_fit tool")


# ----------------------------- Recommendation -----------------------------

def generate_recommendation(
    profile: UserProfile,
    candidates: list[Book],
) -> dict[str, Any]:
    """Call Claude and return the tool_use input dict.

    Raises if Claude doesn't call the tool.
    """
    client = get_client()
    user_prompt = _build_user_prompt(profile, candidates)

    # Select system prompt based on language
    system_prompt = SYSTEM_PROMPT_EN if profile.language == "en" else SYSTEM_PROMPT_ZH

    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=2000,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[RECOMMEND_TOOL],
        tool_choice={"type": "tool", "name": "generate_recommendation"},
        messages=[{"role": "user", "content": user_prompt}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "generate_recommendation":
            return block.input  # type: ignore[return-value]

    raise RuntimeError("Claude did not call generate_recommendation tool")
