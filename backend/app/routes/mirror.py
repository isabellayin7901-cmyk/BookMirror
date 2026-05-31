"""小镜子 (Little Mirror) chat endpoints with backend persistence."""

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.db import SessionLocal, MirrorMessage, MirrorProfile, init_db
from app.services import mirror as mirror_service

router = APIRouter()

# Make sure tables exist (idempotent).
init_db()

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


class MessageOut(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    messages: list[MessageOut]


class ProfileResponse(BaseModel):
    summary: str = ""
    traits: list[str] = []
    keywords: list[str] = []
    message_count: int = 0


def _load_history(session, user_id: str, limit: int) -> list[dict[str, str]]:
    rows = session.execute(
        select(MirrorMessage)
        .where(MirrorMessage.user_id == user_id)
        .order_by(MirrorMessage.id.desc())
        .limit(limit)
    ).scalars().all()
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows]


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

        try:
            reply = mirror_service.chat(
                history=history,
                user_message=payload.message,
                context=context,
                language=payload.language,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Mirror chat error: {e}")

        # Persist both turns.
        session.add(MirrorMessage(user_id=payload.user_id, role="user", content=payload.message))
        session.add(MirrorMessage(user_id=payload.user_id, role="assistant", content=reply))

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

        return ChatResponse(reply=reply)
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
        return HistoryResponse(messages=[MessageOut(role=r.role, content=r.content) for r in rows])
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
