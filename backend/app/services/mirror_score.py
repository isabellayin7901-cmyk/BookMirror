"""Mirror Score —— 判断「这本书有没有帮到这个人」的综合推荐分。

推荐分 = 基础匹配分 + 相似人格用户评分 + 相似问题用户帮助度 + 个人历史偏好 − 难度不匹配惩罚

数据少（冷启动）时，缺失的信号权重自动并入基础匹配，分数依然合理。返回 0-100。
"""

import json
from typing import Optional

from sqlalchemy import select

from app.models import Book, UserProfile
from app.db import BookReview
from app.services.book_filter import _score as base_match_score


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _history_topics(session, user_id: str, book_index: dict[str, Book]) -> set[str]:
    """用户自己打 4 星及以上的书，它们的主题集合（个人历史偏好）。"""
    if not user_id:
        return set()
    rows = session.execute(
        select(BookReview).where(BookReview.user_id == user_id, BookReview.rating >= 4)
    ).scalars().all()
    topics: set[str] = set()
    for r in rows:
        b = book_index.get(r.book_id)
        if b:
            topics.update(b.topics)
    return topics


def compute_scores(
    profile: UserProfile,
    books: list[Book],
    session,
    book_index: dict[str, Book],
    user_id: str = "",
) -> dict[str, int]:
    hist_topics = _history_topics(session, user_id, book_index)
    return {b.id: _score_one(profile, b, session, hist_topics) for b in books}


def _score_one(profile: UserProfile, book: Book, session, hist_topics: set[str]) -> int:
    # 1) 基础匹配分，归一化到 0-1
    base = _clamp01((base_match_score(book, profile) + 2) / 14.0)

    reviews = session.execute(
        select(BookReview).where(BookReview.book_id == book.id)
    ).scalars().all()
    n = len(reviews)

    # 2) 相似人格用户评分
    sim_pers: Optional[float] = None
    if profile.mbti and n > 0:
        same = [r for r in reviews if r.mbti and r.mbti == profile.mbti]
        if same:
            sim_pers = sum((r.rating - 1) / 4.0 for r in same) / len(same)

    # 3) 相似问题用户帮助度
    sim_prob: Optional[float] = None
    if profile.problems and n > 0:
        helped = sum(
            1 for r in reviews
            if set(json.loads(r.helped_problems or "[]")) & set(profile.problems)
        )
        sim_prob = helped / n

    # 整体口碑（弱兜底）
    overall = (sum((r.rating - 1) / 4.0 for r in reviews) / n) if n > 0 else None

    # 4) 个人历史偏好：这本书主题与用户高分书主题的重合
    hist: Optional[float] = None
    if hist_topics and book.topics:
        inter = len(set(book.topics) & hist_topics)
        hist = _clamp01(inter / max(1, len(set(book.topics))))

    # 5) 难度不匹配惩罚
    target = max(1, min(5, round(profile.depth / 2)))
    penalty = abs(book.difficulty - target) / 4.0

    parts: list[tuple[float, float]] = [(0.55, base)]
    if sim_pers is not None:
        parts.append((0.20, sim_pers))
    elif overall is not None:
        parts.append((0.10, overall))
    if sim_prob is not None:
        parts.append((0.20, sim_prob))
    if hist is not None:
        parts.append((0.15, hist))

    wsum = sum(w for w, _ in parts)
    score01 = sum(w * v for w, v in parts) / wsum if wsum else base
    score01 = _clamp01(score01 - 0.15 * penalty)
    # 映射到 40-98，避免吓人的低分
    return int(round(40 + score01 * 58))
