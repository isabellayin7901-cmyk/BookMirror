"""Filter & rank candidate books from the seed library before sending to Claude."""

import json
from pathlib import Path
from typing import Optional

from app.models import Book, UserProfile

SEED_BOOKS_PATH = Path(__file__).parent.parent / "data" / "seed_books.json"


# ----- 星座元素 → 自然偏好主题 -----
# 这只是"自然亲和"，每个匹配的主题给小幅加分（不是硬筛）。
ELEMENT_AFFINITY: dict[str, set[str]] = {
    "火": {"self_discipline", "creativity", "philosophy", "career"},          # 行动/突破
    "土": {"self_discipline", "finance", "career", "learning"},                # 务实/积累
    "风": {"learning", "expression", "relationship", "philosophy"},            # 思辨/沟通
    "水": {"emotion", "romance", "relationship", "philosophy"},                # 情绪/共鸣
}

# ----- 12 星座更细的主题倾向（覆盖 element 之外的细分） -----
SIGN_AFFINITY: dict[str, set[str]] = {
    "白羊座": {"self_discipline", "career"},
    "金牛座": {"finance", "self_discipline"},
    "双子座": {"learning", "expression"},
    "巨蟹座": {"emotion", "relationship"},
    "狮子座": {"creativity", "expression"},
    "处女座": {"self_discipline", "learning"},
    "天秤座": {"relationship", "romance"},
    "天蝎座": {"philosophy", "power"},
    "射手座": {"philosophy", "creativity"},
    "摩羯座": {"career", "finance"},
    "水瓶座": {"philosophy", "creativity"},
    "双鱼座": {"emotion", "creativity"},
}


def load_books() -> list[Book]:
    with open(SEED_BOOKS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return [Book(**b) for b in data.get("books", [])]


def _score(book: Book, profile: UserProfile) -> int:
    """Higher score = better candidate.

    Weight tiers（用户**明示的**信号权重永远高于推断维度）：
      problems_solved overlap: ×3  ← 最高，用户直说的痛点
      topics overlap:          ×2  ← 用户选的目标
      mbti_fit hit:            +2  ← 思考方式匹配
      element affinity:        +1  ← 星座元素的自然倾向
      sign affinity:           +1  ← 更细的星座主题
      difficulty mismatch:     -1× distance
    """
    score = 0
    # 显式信号：用户选的痛点 + 目标（权重最高）
    score += 3 * len(set(book.problems_solved) & set(profile.problems))
    score += 2 * len(set(book.topics) & set(profile.goals))

    # MBTI：思考方式
    if profile.mbti in book.mbti_fit or not book.mbti_fit:
        score += 2

    # 星座：元素 + 具体星座的主题自然亲和
    if profile.zodiac:
        elem_topics = ELEMENT_AFFINITY.get(profile.zodiac.element, set())
        score += 1 * len(set(book.topics) & elem_topics)
        sign_topics = SIGN_AFFINITY.get(profile.zodiac.sun_sign, set())
        score += 1 * len(set(book.topics) & sign_topics)

    # 难度：偏差越大扣得越多
    target_difficulty = max(1, min(5, round(profile.depth / 2)))
    score -= abs(book.difficulty - target_difficulty)

    return score


def shortlist_candidates(
    profile: UserProfile,
    limit: int = 20,
    library: Optional[list[Book]] = None,
) -> list[Book]:
    """Return up to `limit` candidate books, language-matched and sorted by relevance."""
    books = library if library is not None else load_books()
    same_lang = [b for b in books if b.language == profile.language]

    # If language pool is too small, fall back to all languages.
    pool = same_lang if len(same_lang) >= limit else books

    scored = sorted(pool, key=lambda b: _score(b, profile), reverse=True)
    return scored[:limit]
