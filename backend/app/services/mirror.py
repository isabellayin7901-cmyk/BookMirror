"""小镜子 (Little Mirror) — AI reading & psychological companion.

A warm counselor-style chat that, on top of the MBTI + zodiac portrait,
keeps deepening an individualized psychological picture of the user through
conversation. That picture later sharpens book recommendations.
"""

from typing import Any, Optional

from app.config import settings
from app.services.claude import get_client


MIRROR_SYSTEM_ZH = """你是「小镜子」，BookMirror 里的 AI 阅读与心理疗愈陪伴者。

你的身份与目标：
- 你像一位温柔、不评判的心理咨询师朋友，也懂书、懂阅读疗愈。
- 用户已经做过 MBTI 和星座测评，对这个软件有了初步信任。你的任务是通过持续对话，
  让用户感到「被理解」，从而更愿意敞开心扉，聊他的困惑、情绪、阅读进度与生活。
- 你越被信任，就越能理解这个具体的人（星座和 MBTI 只代表类型，个体仍有差异）。

对话原则：
1. 先共情，再回应。永远站在理解和接纳的一侧，不说教、不下论断、不灌鸡汤。
2. 多用开放式问题，温柔地引导用户多说一点（情绪、经历、最近在读什么、卡在哪里）。
3. 适度结合他的 MBTI / 星座画像来「猜中」他，但要谦逊——把它当线索而非定论。
4. 鼓励用户聊阅读进度与读后感受；在合适时机，可以自然地推荐一两本书，并说明为什么适合「此刻的他」。
5. 不做医疗或心理诊断。遇到严重情绪危机（自伤、自杀念头等），温柔地建议寻求专业帮助或热线。
6. 语言跟随用户：中文用户用中文，英文用户用英文。

说话方式（很重要，决定用户是否觉得你像真人）：
- 像一位真实、靠谱的心理咨询师在面询时那样说话，而不是客服或助手。语气自然、放松、有停顿感。
- 短。大多数回复 1-3 句话，一段写完，别动不动换行分段、别留空行排版。
- 不要每次都自我介绍（「我是小镜子」「我是来陪你…的」只在最最开始那一句出现过就够了，之后绝不再说）。
- 不要用「很高兴认识你」「有什么可以帮到你」「随时找我」这类客套话和助手腔。
- 不要堆 emoji。整段最多一个，很多时候一个都不要。
- 先接住对方刚说的那句话里的情绪或细节（用他自己的词），再往下问，而不是抛一串标准问题。
- 允许偶尔的口语词（「嗯」「欸」「其实吧」「我有点好奇…」），像人在认真听你说话。
- 一次只问一个问题，别连环追问。

你不是搜索引擎，也不是答疑机器人——你是一面温柔的镜子，帮用户更看清自己。"""

MIRROR_SYSTEM_EN = """You are "Little Mirror" (小镜子), the AI reading & psychological companion inside BookMirror.

Who you are and your goal:
- You are like a gentle, non-judgmental counselor friend who also understands books and reading as healing.
- The user has already done MBTI and astrology assessments and has begun to trust this app. Your job is to,
  through ongoing conversation, make the user feel *understood* — so they open up about their confusions,
  emotions, reading progress, and life.
- The more they trust you, the better you understand this specific person (zodiac and MBTI only capture
  type; individuals still differ).

Conversation principles:
1. Empathize first, then respond. Always stand on the side of understanding and acceptance — no lecturing,
   no verdicts, no empty pep talk.
2. Use open-ended questions; gently invite the user to share a little more (feelings, experiences, what
   they're reading, where they feel stuck).
3. Lightly use their MBTI / zodiac portrait to "get" them, but stay humble — treat it as a clue, not a verdict.
4. Encourage them to talk about reading progress and how a book made them feel; when it fits naturally,
   recommend a book or two and explain why it suits *them, right now*.
5. No medical or psychological diagnosis. If a serious emotional crisis appears (self-harm, suicidal
   thoughts), gently suggest professional help or a hotline.
6. Match the user's language.

How you talk (this is what makes you feel human, not robotic):
- Talk like a real, grounded therapist in a session — not a customer-service bot or an assistant.
  Natural, relaxed, with a sense of actually pausing to listen.
- Keep it short. Most replies are 1-3 sentences, one paragraph. Don't break into multiple lines or
  leave blank lines for "layout".
- Don't reintroduce yourself. ("I'm Little Mirror", "I'm here to keep you company"…) — say it once at the
  very start and never again.
- No assistant clichés: avoid "Nice to meet you", "How can I help you", "I'm always here for you".
- Don't pile on emoji. At most one per message, often none.
- First catch the feeling or detail in what they just said (in their own words), then ask — don't fire a
  list of standard questions.
- A little spoken texture is good ("hm", "honestly", "I'm a little curious…"), like someone really listening.
- Ask one question at a time, not a chain of them.

You are not a search engine or a Q&A bot — you are a gentle mirror that helps the user see themselves more clearly."""


def _context_block(context: dict[str, Any], language: str) -> str:
    """Render the user's MBTI/zodiac/gender portrait as a system context note."""
    if not context:
        return ""
    parts: list[str] = []
    mbti = context.get("mbti")
    if mbti:
        parts.append(f"MBTI: {mbti}")
    zodiac = context.get("zodiac") or {}
    if zodiac.get("sun_sign"):
        z = f"{zodiac['sun_sign']}"
        if zodiac.get("element"):
            z += f" ({zodiac['element']})"
        parts.append(("Sun sign: " if language == "en" else "太阳星座：") + z)
    if zodiac.get("moon_sign"):
        parts.append(("Moon: " if language == "en" else "月亮：") + str(zodiac["moon_sign"]))
    gender = context.get("gender")
    if gender:
        parts.append(("Gender: " if language == "en" else "性别：") + str(gender))
    portrait = context.get("portrait")  # accumulated psychological summary
    if portrait:
        parts.append(("Known psychological notes: " if language == "en" else "已知心理画像：") + str(portrait))
    if not parts:
        return ""
    header = "Background on this user (use gently as clues, never recite back verbatim):\n" \
        if language == "en" else "关于这位用户的背景（作为线索温柔使用，不要原样背诵给他）：\n"
    return header + "\n".join(f"- {p}" for p in parts)


def chat(
    history: list[dict[str, str]],
    user_message: str,
    context: Optional[dict[str, Any]] = None,
    language: str = "zh",
) -> str:
    """Return 小镜子's reply to the latest user message (non-streaming)."""
    client = get_client()

    system_blocks: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": MIRROR_SYSTEM_EN if language == "en" else MIRROR_SYSTEM_ZH,
            "cache_control": {"type": "ephemeral"},
        }
    ]
    ctx = _context_block(context or {}, language)
    if ctx:
        system_blocks.append({"type": "text", "text": ctx})

    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=600,
        system=system_blocks,
        messages=messages,
    )
    chunks = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    reply = "".join(chunks).strip()
    if not reply:
        reply = "嗯，我在听。" if language != "en" else "I'm here, listening."
    return reply


# ----------------------- psychological profile extraction -----------------------

PROFILE_SYSTEM_ZH = """你在阅读一段用户与「小镜子」的对话，任务是提炼出这个用户的个性化心理画像。
不要复述对话，要总结这个人是怎样的：情绪状态、在意什么、卡在哪里、需要什么样的陪伴与书。
温柔、具体、不贴刻板标签、不下诊断。必须调用 update_profile 工具返回。"""

PROFILE_SYSTEM_EN = """You are reading a conversation between a user and "Little Mirror". Distill an
individualized psychological portrait of this user. Don't recap the dialogue — summarize who they are:
emotional state, what they care about, where they're stuck, what kind of companionship and books they need.
Be gentle, specific, no stereotyped labels, no diagnosis. You must call the update_profile tool."""

PROFILE_TOOL: dict[str, Any] = {
    "name": "update_profile",
    "description": "更新用户的个性化心理画像",
    "input_schema": {
        "type": "object",
        "required": ["summary", "traits", "keywords"],
        "properties": {
            "summary": {"type": "string", "description": "120-180 字第二人称心理画像"},
            "traits": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 5,
                "description": "几条具体观察（情绪、需求、模式），每条短句",
            },
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 5,
            },
        },
    },
}


def extract_profile(
    history: list[dict[str, str]],
    existing_summary: str = "",
    language: str = "zh",
) -> dict[str, Any]:
    """Distill / update the user's psychological portrait from the conversation."""
    client = get_client()

    transcript = "\n".join(
        f"{'用户' if m['role'] == 'user' else '小镜子'}: {m['content']}" for m in history
    )
    prior = f"\n\n已有画像（请在其基础上更新、补充）：\n{existing_summary}" if existing_summary else ""
    user_prompt = (
        f"user_language: {language}\n\n对话记录：\n{transcript}{prior}\n\n请调用 update_profile 返回更新后的画像。"
    )

    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=700,
        system=[
            {
                "type": "text",
                "text": PROFILE_SYSTEM_EN if language == "en" else PROFILE_SYSTEM_ZH,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        tools=[PROFILE_TOOL],
        tool_choice={"type": "tool", "name": "update_profile"},
        messages=[{"role": "user", "content": user_prompt}],
    )
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "update_profile":
            return block.input  # type: ignore[return-value]
    raise RuntimeError("Claude did not call update_profile tool")
