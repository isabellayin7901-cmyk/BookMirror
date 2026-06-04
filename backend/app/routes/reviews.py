"""读完反馈「三合一」：评分 + 书评 + 成长自评。

核心理念：不是评价书的好坏，而是记录「这本书有没有帮到这个人」。
- POST   /api/reviews          新建或覆盖自己对某本书的评价
- GET    /api/reviews          某本书的评价列表（书详情页展示，尊重匿名）
- GET    /api/reviews/mine     取自己对某本书的评价（回填表单）
- DELETE /api/reviews          删除自己对某本书的评价
- GET    /api/growth           跨书聚合的成长数据（成长曲线 + 解决的问题）
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.db import SessionLocal, BookReview, ReadingStatus, init_db
from app.models import Book, UserProfile
from app.services.book_filter import load_books
from app.services.mirror_score import compute_scores
from app.services import claude as claude_service

router = APIRouter()

init_db()

_BOOK_INDEX: dict[str, Book] = {b.id: b for b in load_books()}

# 成长维度（固定核心 5 项，跨书可比、可累加）
GROWTH_DIMENSIONS = ["expression", "emotion", "execution", "self_awareness", "relationship"]


# ---------- 模型 ----------

class GrowthPair(BaseModel):
    before: int = Field(..., ge=0, le=100)
    after: int = Field(..., ge=0, le=100)


class ReviewIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    book_id: str = Field(..., min_length=1, max_length=64)
    rating: int = Field(..., ge=1, le=5)
    difficulty: str = Field("just_right")  # too_easy / just_right / too_hard
    emotions: list[str] = Field(default_factory=list)
    text: str = Field("", max_length=2000)
    recommend_similar: bool = True
    anonymous: bool = False
    mbti: Optional[str] = None
    growth: dict[str, GrowthPair] = Field(default_factory=dict)
    helped_problems: list[str] = Field(default_factory=list)


class ReviewOut(BaseModel):
    id: int
    user_id: str
    book_id: str
    rating: int
    difficulty: str
    emotions: list[str]
    text: str
    recommend_similar: bool
    anonymous: bool
    mbti: Optional[str] = None
    growth: dict[str, dict[str, int]]
    helped_problems: list[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _to_out(r: BookReview) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        user_id=r.user_id,
        book_id=r.book_id,
        rating=r.rating,
        difficulty=r.difficulty,
        emotions=json.loads(r.emotions or "[]"),
        text=r.text or "",
        recommend_similar=bool(r.recommend_similar),
        anonymous=bool(r.anonymous),
        mbti=r.mbti,
        growth=json.loads(r.growth or "{}"),
        helped_problems=json.loads(r.helped_problems or "[]"),
        created_at=_iso(r.created_at),
        updated_at=_iso(r.updated_at),
    )


# ---------- 端点 ----------

@router.post("/reviews", response_model=ReviewOut)
def upsert_review(payload: ReviewIn):
    if payload.difficulty not in ("too_easy", "just_right", "too_hard"):
        payload.difficulty = "just_right"
    growth_json = json.dumps(
        {k: {"before": v.before, "after": v.after} for k, v in payload.growth.items()},
        ensure_ascii=False,
    )
    session = SessionLocal()
    try:
        row = session.execute(
            select(BookReview).where(
                BookReview.user_id == payload.user_id,
                BookReview.book_id == payload.book_id,
            )
        ).scalars().first()
        if row is None:
            row = BookReview(user_id=payload.user_id, book_id=payload.book_id)
            session.add(row)
        row.rating = payload.rating
        row.difficulty = payload.difficulty
        row.emotions = json.dumps(payload.emotions, ensure_ascii=False)
        row.text = payload.text.strip()
        row.recommend_similar = payload.recommend_similar
        row.anonymous = payload.anonymous
        row.mbti = payload.mbti
        row.growth = growth_json
        row.helped_problems = json.dumps(payload.helped_problems, ensure_ascii=False)
        session.commit()
        session.refresh(row)
        return _to_out(row)
    finally:
        session.close()


class UserReviewItem(BaseModel):
    book: Optional[Book] = None
    rating: int
    emotions: list[str]
    text: str
    created_at: Optional[str] = None


@router.get("/reviews/by-user", response_model=list[UserReviewItem])
def reviews_by_user(user_id: str, limit: int = 100):
    """某用户写过的所有书评（个人主页「ta 的书评」用），带书信息。"""
    session = SessionLocal()
    try:
        rows = session.execute(
            select(BookReview).where(BookReview.user_id == user_id)
            .order_by(BookReview.updated_at.desc())
            .limit(max(1, min(limit, 300)))
        ).scalars().all()
        return [
            UserReviewItem(
                book=_BOOK_INDEX.get(r.book_id),
                rating=r.rating,
                emotions=json.loads(r.emotions or "[]"),
                text=r.text or "",
                created_at=_iso(r.created_at),
            )
            for r in rows
        ]
    finally:
        session.close()


@router.get("/reviews", response_model=list[ReviewOut])
def list_reviews(book_id: str, limit: int = 50):
    session = SessionLocal()
    try:
        rows = session.execute(
            select(BookReview)
            .where(BookReview.book_id == book_id)
            .order_by(BookReview.updated_at.desc())
            .limit(max(1, min(limit, 200)))
        ).scalars().all()
        out = []
        for r in rows:
            o = _to_out(r)
            if o.anonymous:
                o.mbti = None      # 匿名则不暴露任何身份线索
                o.user_id = ""      # 也不暴露 user_id，避免被链接到个人主页
            out.append(o)
        return out
    finally:
        session.close()


@router.get("/reviews/mine", response_model=Optional[ReviewOut])
def my_review(user_id: str, book_id: str):
    session = SessionLocal()
    try:
        row = session.execute(
            select(BookReview).where(
                BookReview.user_id == user_id,
                BookReview.book_id == book_id,
            )
        ).scalars().first()
        return _to_out(row) if row else None
    finally:
        session.close()


@router.delete("/reviews")
def delete_review(user_id: str, book_id: str):
    session = SessionLocal()
    try:
        session.execute(
            delete(BookReview).where(
                BookReview.user_id == user_id,
                BookReview.book_id == book_id,
            )
        )
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()


class GrowthDimension(BaseModel):
    dimension: str
    total_delta: int          # 累计提升（Σ after-before）
    latest_after: int         # 最近一次的「现在」分
    count: int                # 有几本书评在这个维度上有记录
    points: list[dict[str, Any]]  # 时间线 [{book_id, before, after, created_at}]


class GrowthOut(BaseModel):
    dimensions: list[GrowthDimension]
    helped_problem_counts: dict[str, int]  # 各问题被「解决」的次数
    review_count: int


class MirrorScoreIn(BaseModel):
    profile: UserProfile
    book_ids: list[str] = Field(default_factory=list)
    user_id: str = ""


class MirrorScoreOut(BaseModel):
    scores: dict[str, int]  # book_id -> 0-100


@router.post("/mirror-score", response_model=MirrorScoreOut)
def mirror_score(payload: MirrorScoreIn):
    """为一批书算 Mirror Score（这本书有没有帮到这个人，0-100）。"""
    books = [_BOOK_INDEX[bid] for bid in payload.book_ids if bid in _BOOK_INDEX]
    if not books:
        return MirrorScoreOut(scores={})
    session = SessionLocal()
    try:
        scores = compute_scores(payload.profile, books, session, _BOOK_INDEX, payload.user_id)
        return MirrorScoreOut(scores=scores)
    finally:
        session.close()


class ShapingIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    mbti: Optional[str] = None
    language: str = "zh"


class ShapingOut(BaseModel):
    available: bool
    summary: str = ""
    strengthening: list[str] = []
    shifts: list[str] = []
    encouragement: str = ""
    finished_count: int = 0


@router.post("/shaping-report", response_model=ShapingOut)
def shaping_report(payload: ShapingIn):
    """阅读塑造报告：LLM 结合 MBTI + 阅读史 + 书评 + 成长，生成「你正在增强…」（不改 MBTI）。"""
    session = SessionLocal()
    try:
        finished = session.execute(
            select(ReadingStatus).where(
                ReadingStatus.user_id == payload.user_id,
                ReadingStatus.status == "finished",
            )
        ).scalars().all()
        reviews = session.execute(
            select(BookReview).where(BookReview.user_id == payload.user_id)
        ).scalars().all()

        # 数据太少就先不生成（至少读完 1 本 或 有 1 条反馈）
        if len(finished) == 0 and len(reviews) == 0:
            return ShapingOut(available=False, finished_count=0)

        finished_info = []
        for r in finished:
            b = _BOOK_INDEX.get(r.book_id)
            if b:
                finished_info.append({"title": b.title, "topics": b.topics})

        review_info = []
        growth_acc: dict[str, int] = {}
        for r in reviews:
            b = _BOOK_INDEX.get(r.book_id)
            review_info.append({
                "title": b.title if b else r.book_id,
                "rating": r.rating,
                "emotions": json.loads(r.emotions or "[]"),
                "helped": json.loads(r.helped_problems or "[]"),
            })
            for dim, pair in json.loads(r.growth or "{}").items():
                growth_acc[dim] = growth_acc.get(dim, 0) + (int(pair.get("after", 0)) - int(pair.get("before", 0)))

        data = {
            "mbti": payload.mbti,
            "finished": finished_info,
            "reviews": review_info,
            "growth": growth_acc,
        }
        try:
            rep = claude_service.generate_shaping_report(data, payload.language)
        except Exception:
            return ShapingOut(available=False, finished_count=len(finished))

        return ShapingOut(
            available=True,
            summary=rep.get("summary", ""),
            strengthening=rep.get("strengthening", []),
            shifts=rep.get("shifts", []),
            encouragement=rep.get("encouragement", ""),
            finished_count=len(finished),
        )
    finally:
        session.close()


@router.get("/growth", response_model=GrowthOut)
def growth(user_id: str):
    session = SessionLocal()
    try:
        rows = session.execute(
            select(BookReview)
            .where(BookReview.user_id == user_id)
            .order_by(BookReview.created_at.asc())
        ).scalars().all()

        dims: dict[str, dict[str, Any]] = {
            d: {"total_delta": 0, "latest_after": 0, "count": 0, "points": []}
            for d in GROWTH_DIMENSIONS
        }
        problem_counts: dict[str, int] = {}

        for r in rows:
            g = json.loads(r.growth or "{}")
            for dim, pair in g.items():
                if dim not in dims:
                    dims[dim] = {"total_delta": 0, "latest_after": 0, "count": 0, "points": []}
                before = int(pair.get("before", 0))
                after = int(pair.get("after", 0))
                dims[dim]["total_delta"] += (after - before)
                dims[dim]["latest_after"] = after
                dims[dim]["count"] += 1
                dims[dim]["points"].append({
                    "book_id": r.book_id,
                    "before": before,
                    "after": after,
                    "created_at": _iso(r.created_at),
                })
            for p in json.loads(r.helped_problems or "[]"):
                problem_counts[p] = problem_counts.get(p, 0) + 1

        dimensions = [
            GrowthDimension(
                dimension=d,
                total_delta=v["total_delta"],
                latest_after=v["latest_after"],
                count=v["count"],
                points=v["points"],
            )
            for d, v in dims.items()
            if v["count"] > 0
        ]
        return GrowthOut(
            dimensions=dimensions,
            helped_problem_counts=problem_counts,
            review_count=len(rows),
        )
    finally:
        session.close()
