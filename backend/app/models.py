from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------- User input ----------

MBTI = Literal[
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
]


class Birthday(BaseModel):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    day: int = Field(ge=1, le=31)
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59, default=0)


class PlanetPosition(BaseModel):
    sign: str
    longitude: float  # 0-360 黄经


class ZodiacReading(BaseModel):
    sun_sign: str
    moon_sign: Optional[str] = None
    rising_sign: Optional[str] = None
    element: str
    description: str
    keywords: list[str]
    # 完整星盘（用于前端绘图）
    chart: Optional[dict] = None  # { sun:{sign,longitude}, moon, mercury, venus, mars, ascendant? }


class UserProfile(BaseModel):
    mbti: MBTI
    mbti_source: Literal["self", "quiz"] = "self"
    goals: list[str] = Field(default_factory=list, max_length=3)
    preferences: list[str] = Field(default_factory=list)
    depth: int = Field(5, ge=0, le=10)
    problems: list[str] = Field(default_factory=list)
    free_text: str = Field("", max_length=200)
    language: Literal["zh", "en"] = "zh"
    birthday: Optional[Birthday] = None
    zodiac: Optional[ZodiacReading] = None
    gender: Optional[Literal["female", "male", "other"]] = None


# ---------- Book ----------

class Book(BaseModel):
    id: str
    title: str
    author: str
    title_en: Optional[str] = None
    author_en: Optional[str] = None
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    language: Literal["zh", "en"]
    category: str
    difficulty: int = Field(ge=1, le=5)
    mbti_fit: list[str] = Field(default_factory=list)
    topics: list[str]
    problems_solved: list[str]
    stage: list[str] = Field(default_factory=lambda: ["universal"])
    summary: str
    summary_en: Optional[str] = None
    key_chapters: list[str] = Field(default_factory=list)
    key_chapters_en: list[str] = Field(default_factory=list)
    purchase_links: dict[str, str] = Field(default_factory=dict)


# ---------- Recommendation output ----------

class ProfileCard(BaseModel):
    description: str
    keywords: list[str]


class BookRecommendation(BaseModel):
    book_id: str
    order: int
    why_for_you: str
    key_focus: list[str]


class RecommendationResponse(BaseModel):
    profile: ProfileCard
    growth_gaps: list[str]
    recommendations: list[BookRecommendation]
    # 5 本 Claude 精选（recommendations 对应的完整书数据）
    books: list[Book] = Field(default_factory=list)
    # 候选池里没被选进 5 本的其他书 —— 主页"更多适合你"轮播用
    more_books: list[Book] = Field(default_factory=list)


# ---------- Feedback ----------

# ---------- MBTI inference ----------

class MbtiAnswerPayload(BaseModel):
    question_id: int
    question_text: str
    answer: dict  # raw answer envelope from frontend (kind + value/label)


class MbtiInferenceRequest(BaseModel):
    answers: list[MbtiAnswerPayload]
    language: Literal["zh", "en"] = "zh"
    mode: Literal["quick", "full"] = "full"


class MbtiInferenceResponse(BaseModel):
    mbti: MBTI
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


# ---------- MBTI × Zodiac synthesis ----------

class SynthesisRequest(BaseModel):
    mbti: MBTI
    sun_sign: str
    moon_sign: Optional[str] = None
    rising_sign: Optional[str] = None
    element: str
    language: Literal["zh", "en"] = "zh"


class SynthesisProfile(BaseModel):
    title: str                       # 一句话人格标签，如「理想主义的水象筑梦者」
    description: str                 # 综合人格描述
    strengths: list[str]            # 优势
    blindspots: list[str]           # 盲点 / 成长挑战
    keywords: list[str]             # 关键词


# ---------- Per-book personalized fit ----------

class BookFitRequest(BaseModel):
    # 书本身的信息（前端把整本书的关键字段传过来，避免后端再查库）
    book_title: str
    book_author: str = ""
    book_summary: str = ""
    book_topics: list[str] = Field(default_factory=list)
    book_category: str = ""
    book_difficulty: int = Field(3, ge=1, le=5)
    # 用户画像
    mbti: Optional[str] = None
    sun_sign: Optional[str] = None
    moon_sign: Optional[str] = None
    rising_sign: Optional[str] = None
    element: Optional[str] = None
    goals: list[str] = Field(default_factory=list)
    problems: list[str] = Field(default_factory=list)
    preferences: list[str] = Field(default_factory=list)
    free_text: str = Field("", max_length=200)
    language: Literal["zh", "en"] = "zh"


class BookFitResponse(BaseModel):
    why_for_you: str          # 点对点说明为什么这本书适合「你」
    key_focus: list[str]      # 结合画像该重点读什么（2-3 条）


# ---------- Feedback ----------

class FeedbackRequest(BaseModel):
    book_id: str
    reaction: Literal["useful", "too_hard", "not_interested", "want_similar"]
    note: str = Field("", max_length=300)
    user_profile: Optional[UserProfile] = None
