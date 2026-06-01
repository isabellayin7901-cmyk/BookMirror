"""小镜子 (Little Mirror) chat endpoints with backend persistence."""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.db import SessionLocal, MirrorMessage, MirrorProfile, init_db
from app.models import Book
from app.services import mirror as mirror_service
from app.services.book_filter import load_books, shortlist_for_mirror

router = APIRouter()

# Make sure tables exist (idempotent).
init_db()

# 书库索引（id -> Book），用于把推荐的 book_id 水合成完整书卡。模块加载时建一次。
_BOOK_INDEX: dict[str, Book] = {b.id: b for b in load_books()}

# How many past turns to feed Claude, and how often to refresh the portrait.
HISTORY_WINDOW = 24
PROFILE_EVERY = 4  # re-distill the portrait every N user messages


class ChatRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    message: str = Field(..., min_length=1, max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    language: str = "zh"


class ChatResponse(BaseModel):
    reply: str
    book: Optional[Book] = None  # 小镜子此刻推荐的真实书（可点书卡），多数为 None


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None  # ISO 时间，前端用来画时间线分割
    book: Optional[Book] = None       # 这条消息附带的推荐书卡


class HistoryResponse(BaseModel):
    messages: list[MessageOut]


class ProfileResponse(BaseModel):
    summary: str = ""
    traits: list[str] = []
    keywords: list[str] = []
    message_count: int = 0


def _load_history(session, user_id: str, limit: int) -> list[dict[str, Any]]:
    rows = session.execute(
        select(MirrorMessage)
        .where(MirrorMessage.user_id == user_id)
        .order_by(MirrorMessage.id.desc())
        .limit(limit)
    ).scalars().all()
    rows.reverse()
    return [
        {"role": r.role, "content": r.content, "created_at": r.created_at}
        for r in rows
    ]


def _minutes_since_last(history: list[dict[str, Any]]) -> Optional[float]:
    """距离最后一条历史消息过去了多少分钟。用来让小镜子判断新消息要不要接着上文。

    SQLite 存的是 naive UTC，所以这里也用 naive UTC 比较，避免时区报错。
    """
    if not history:
        return None
    last = history[-1].get("created_at")
    if not isinstance(last, datetime):
        return None
    if last.tzinfo is not None:
        last = last.replace(tzinfo=None)
    delta = datetime.utcnow() - last
    return max(0.0, delta.total_seconds() / 60.0)


@router.post("/mirror/chat", response_model=ChatResponse)
def mirror_chat(payload: ChatRequest):
    session = SessionLocal()
    try:
        history = _load_history(session, payload.user_id, HISTORY_WINDOW)

        # Fold the stored psychological portrait into the context.
        prof = session.get(MirrorProfile, payload.user_id)
        context = dict(payload.context or {})
        if prof and prof.summary:
            context["portrait"] = prof.summary

        # 基于画像，从真实书库挑候选书（供小镜子精准荐书，杜绝编造）。
        # 已推荐过的书排除，避免重复；聊了至少一轮后才开始备选。
        candidates = []
        if prof and (prof.message_count or 0) >= 1:
            recommended_ids = {
                r[0] for r in session.execute(
                    select(MirrorMessage.book_id).where(
                        MirrorMessage.user_id == payload.user_id,
                        MirrorMessage.book_id.isnot(None),
                    )
                ).all()
            }
            terms: list[str] = []
            try:
                terms += json.loads(prof.keywords or "[]")
            except Exception:
                pass
            try:
                terms += json.loads(prof.traits or "[]")
            except Exception:
                pass
            candidates = shortlist_for_mirror(
                terms, language=payload.language, exclude_ids=recommended_ids, limit=12,
            )

        try:
            result = mirror_service.chat(
                history=history,
                user_message=payload.message,
                context=context,
                language=payload.language,
                minutes_since_last=_minutes_since_last(history),
                candidate_books=candidates,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Mirror chat error: {e}")

        reply = result["reply"]
        rec_book_id = result.get("book_id")
        rec_book = _BOOK_INDEX.get(rec_book_id) if rec_book_id else None

        # Persist both turns（推荐的书 id 存在助手那条消息上，历史可回放书卡）。
        session.add(MirrorMessage(user_id=payload.user_id, role="user", content=payload.message))
        session.add(MirrorMessage(
            user_id=payload.user_id, role="assistant", content=reply,
            book_id=rec_book_id if rec_book else None,
        ))

        # Track user message count; refresh the portrait every PROFILE_EVERY turns.
        if prof is None:
            prof = MirrorProfile(user_id=payload.user_id)
            session.add(prof)
        prof.message_count = (prof.message_count or 0) + 1
        should_refresh = prof.message_count % PROFILE_EVERY == 0
        session.commit()

        if should_refresh:
            try:
                full = _load_history(session, payload.user_id, HISTORY_WINDOW)
                distilled = mirror_service.extract_profile(
                    history=full,
                    existing_summary=prof.summary or "",
                    language=payload.language,
                )
                prof = session.get(MirrorProfile, payload.user_id)
                prof.summary = distilled.get("summary", prof.summary)
                prof.traits = json.dumps(distilled.get("traits", []), ensure_ascii=False)
                prof.keywords = json.dumps(distilled.get("keywords", []), ensure_ascii=False)
                session.commit()
            except Exception:
                session.rollback()  # portrait refresh is best-effort

        return ChatResponse(reply=reply, book=rec_book)
    finally:
        session.close()


@router.get("/mirror/history", response_model=HistoryResponse)
def mirror_history(user_id: str, limit: int = 200):
    session = SessionLocal()
    try:
        rows = session.execute(
            select(MirrorMessage)
            .where(MirrorMessage.user_id == user_id)
            .order_by(MirrorMessage.id.asc())
            .limit(max(1, min(limit, 500)))
        ).scalars().all()
        return HistoryResponse(messages=[
            MessageOut(
                role=r.role,
                content=r.content,
                # created_at 存的是 naive UTC，补上 UTC 时区再序列化，
                # 前端 new Date() 才能正确解析并按设备本地时区显示。
                created_at=(
                    r.created_at.replace(tzinfo=timezone.utc).isoformat()
                    if r.created_at else None
                ),
                book=_BOOK_INDEX.get(r.book_id) if getattr(r, "book_id", None) else None,
            )
            for r in rows
        ])
    finally:
        session.close()


@router.get("/mirror/profile", response_model=ProfileResponse)
def mirror_profile(user_id: str):
    session = SessionLocal()
    try:
        prof = session.get(MirrorProfile, user_id)
        if not prof:
            return ProfileResponse()
        return ProfileResponse(
            summary=prof.summary or "",
            traits=json.loads(prof.traits or "[]"),
            keywords=json.loads(prof.keywords or "[]"),
            message_count=prof.message_count or 0,
        )
    finally:
        session.close()


@router.delete("/mirror/history")
def mirror_reset(user_id: str):
    session = SessionLocal()
    try:
        session.execute(delete(MirrorMessage).where(MirrorMessage.user_id == user_id))
        session.execute(delete(MirrorProfile).where(MirrorProfile.user_id == user_id))
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()
