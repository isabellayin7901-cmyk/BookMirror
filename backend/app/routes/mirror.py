"""小镜子 (Little Mirror) chat endpoints with backend persistence."""

import json
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.db import SessionLocal, MirrorMessage, MirrorProfile, Conversation, MirrorProject, _now, init_db
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
    message: str = Field("", max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    language: str = "zh"
    conversation_id: Optional[str] = None  # 当前对话；不给用默认对话
    # 可选：用户发来的图片（base64，不含 data: 前缀）+ 媒体类型，雪宝会看图。
    image_base64: Optional[str] = None
    image_media_type: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    book: Optional[Book] = None  # 小镜子此刻推荐的真实书（可点书卡），多数为 None
    conversation_id: Optional[str] = None


class MessageOut(BaseModel):
    id: Optional[int] = None          # 消息行 id，前端单条删除用
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


def _load_history(session, conversation_id: str, limit: int) -> list[dict[str, Any]]:
    rows = session.execute(
        select(MirrorMessage)
        .where(MirrorMessage.conversation_id == conversation_id)
        .order_by(MirrorMessage.id.desc())
        .limit(limit)
    ).scalars().all()
    rows.reverse()
    return [
        {"role": r.role, "content": r.content, "created_at": r.created_at}
        for r in rows
    ]


def _ensure_conversation(session, user_id: str, conversation_id: Optional[str]) -> str:
    """解析当前对话 id。给了就校验归属；没给就用/建该用户的默认对话，
    并把历史里没归属的旧消息收进默认对话（一次性平滑迁移）。"""
    if conversation_id:
        conv = session.get(Conversation, conversation_id)
        if conv and conv.user_id == user_id:
            return conv.id
        # 不存在就按这个 id 建一个
        conv = Conversation(id=conversation_id, user_id=user_id, title="")
        session.add(conv)
        session.flush()
        return conv.id
    # 默认对话：取该用户最近一个，没有就建
    conv = session.execute(
        select(Conversation).where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    ).scalars().first()
    if conv is None:
        conv = Conversation(id=f"c_{secrets.token_hex(10)}", user_id=user_id, title="")
        session.add(conv)
        session.flush()
        # 旧消息（conversation_id 为空）收进默认对话
        session.execute(
            MirrorMessage.__table__.update()
            .where(MirrorMessage.user_id == user_id, MirrorMessage.conversation_id.is_(None))
            .values(conversation_id=conv.id)
        )
    return conv.id


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
def mirror_chat(payload: ChatRequest, background_tasks: BackgroundTasks):
    if not payload.message and not payload.image_base64:
        raise HTTPException(status_code=400, detail="消息和图片不能都为空")
    session = SessionLocal()
    try:
        conv_id = _ensure_conversation(session, payload.user_id, payload.conversation_id)
        history = _load_history(session, conv_id, HISTORY_WINDOW)

        # Fold the stored psychological portrait into the context.
        prof = session.get(MirrorProfile, payload.user_id)
        context = dict(payload.context or {})
        if prof and prof.summary:
            context["portrait"] = prof.summary
        if prof and getattr(prof, "details", None):
            try:
                context["memory"] = json.loads(prof.details or "{}")
            except Exception:
                pass

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
                image_base64=payload.image_base64,
                image_media_type=payload.image_media_type,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Mirror chat error: {e}")

        reply = result["reply"]
        rec_book_id = result.get("book_id")
        rec_book = _BOOK_INDEX.get(rec_book_id) if rec_book_id else None

        # Persist both turns（推荐的书 id 存在助手那条消息上，历史可回放书卡）。
        # 入库存文字（图片不进 DB）；纯图片消息存个占位，方便历史回看。
        user_stored = payload.message or ("[图片]" if payload.image_base64 else "")
        session.add(MirrorMessage(user_id=payload.user_id, role="user", content=user_stored, conversation_id=conv_id))
        session.add(MirrorMessage(
            user_id=payload.user_id, role="assistant", content=reply,
            book_id=rec_book_id if rec_book else None, conversation_id=conv_id,
        ))

        # 对话：更新时间；首次用第一句自动起个标题。
        conv = session.get(Conversation, conv_id)
        if conv is not None:
            conv.updated_at = _now()
            if not conv.title and user_stored:
                conv.title = user_stored[:20]

        # Track user message count; refresh the portrait every PROFILE_EVERY turns.
        if prof is None:
            prof = MirrorProfile(user_id=payload.user_id)
            session.add(prof)
        prof.message_count = (prof.message_count or 0) + 1
        should_refresh = prof.message_count % PROFILE_EVERY == 0
        session.commit()

        # 画像提炼是额外一次 AI 调用，放到后台跑，不要卡住本次回复（否则每 4 轮明显变慢）。
        if should_refresh:
            background_tasks.add_task(
                _refresh_profile_bg, payload.user_id, conv_id, payload.language,
            )

        return ChatResponse(reply=reply, book=rec_book, conversation_id=conv_id)
    finally:
        session.close()


def _refresh_profile_bg(user_id: str, conversation_id: str, language: str) -> None:
    """后台提炼/更新记忆与心理画像（独立 session，best-effort）。"""
    session = SessionLocal()
    try:
        prof = session.get(MirrorProfile, user_id)
        if prof is None:
            return
        try:
            old_details = json.loads(prof.details or "{}")
        except Exception:
            old_details = {}
        full = _load_history(session, conversation_id, HISTORY_WINDOW)
        distilled = mirror_service.extract_profile(
            history=full,
            existing_summary=prof.summary or "",
            existing_long_term=old_details.get("long_term", ""),
            language=language,
        )
        prof.summary = distilled.get("summary", prof.summary)
        prof.traits = json.dumps(distilled.get("traits", []), ensure_ascii=False)
        prof.keywords = json.dumps(distilled.get("keywords", []), ensure_ascii=False)
        # 增强记忆：在乎谁/情绪走向/在读/长期画像（long_term 累积更新）
        new_details = {
            "cares_about": distilled.get("cares_about", old_details.get("cares_about", [])),
            "mood_recent": distilled.get("mood_recent", old_details.get("mood_recent", "")),
            "reading_now": distilled.get("reading_now", old_details.get("reading_now", [])),
            "long_term": distilled.get("long_term", old_details.get("long_term", "")),
        }
        prof.details = json.dumps(new_details, ensure_ascii=False)
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


@router.get("/mirror/history", response_model=HistoryResponse)
def mirror_history(user_id: str, conversation_id: Optional[str] = None, limit: int = 200):
    session = SessionLocal()
    try:
        conv_id = _ensure_conversation(session, user_id, conversation_id)
        session.commit()  # 持久化默认对话/旧消息迁移
        rows = session.execute(
            select(MirrorMessage)
            .where(MirrorMessage.conversation_id == conv_id)
            .order_by(MirrorMessage.id.asc())
            .limit(max(1, min(limit, 500)))
        ).scalars().all()
        return HistoryResponse(messages=[
            MessageOut(
                id=r.id,
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


class DeleteMessageIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    message_id: int


@router.post("/mirror/message/delete")
def mirror_delete_message(payload: DeleteMessageIn):
    """删除单条小镜子消息（只能删自己的）。"""
    session = SessionLocal()
    try:
        session.execute(
            delete(MirrorMessage).where(
                MirrorMessage.id == payload.message_id,
                MirrorMessage.user_id == payload.user_id,
            )
        )
        session.commit()
        return {"ok": True}
    finally:
        session.close()


@router.delete("/mirror/history")
def mirror_reset(user_id: str):
    session = SessionLocal()
    try:
        session.execute(delete(MirrorMessage).where(MirrorMessage.user_id == user_id))
        session.execute(delete(MirrorProfile).where(MirrorProfile.user_id == user_id))
        session.execute(delete(Conversation).where(Conversation.user_id == user_id))
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()


# ---------------- 多对话：对话与项目管理 ----------------

class ConversationOut(BaseModel):
    id: str
    title: str
    project_id: Optional[str] = None
    updated_at: Optional[str] = None
    preview: str = ""


class ProjectOut(BaseModel):
    id: str
    name: str


class ConversationsResponse(BaseModel):
    conversations: list[ConversationOut]
    projects: list[ProjectOut]


def _iso(dt) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@router.get("/mirror/conversations", response_model=ConversationsResponse)
def list_conversations(user_id: str):
    session = SessionLocal()
    try:
        # 确保至少有默认对话（含旧消息迁移）
        _ensure_conversation(session, user_id, None)
        session.commit()
        convs = session.execute(
            select(Conversation).where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
        ).scalars().all()
        out = []
        for c in convs:
            last = session.execute(
                select(MirrorMessage).where(MirrorMessage.conversation_id == c.id)
                .order_by(MirrorMessage.id.desc())
            ).scalars().first()
            out.append(ConversationOut(
                id=c.id, title=c.title or "", project_id=c.project_id,
                updated_at=_iso(c.updated_at),
                preview=(last.content[:30] if last else ""),
            ))
        projects = session.execute(
            select(MirrorProject).where(MirrorProject.user_id == user_id)
            .order_by(MirrorProject.created_at.asc())
        ).scalars().all()
        return ConversationsResponse(
            conversations=out,
            projects=[ProjectOut(id=p.id, name=p.name) for p in projects],
        )
    finally:
        session.close()


class CreateConversationIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    title: str = ""
    project_id: Optional[str] = None


@router.post("/mirror/conversations", response_model=ConversationOut)
def create_conversation(payload: CreateConversationIn):
    session = SessionLocal()
    try:
        conv = Conversation(
            id=f"c_{secrets.token_hex(10)}", user_id=payload.user_id,
            title=payload.title or "", project_id=payload.project_id,
        )
        session.add(conv)
        session.commit()
        return ConversationOut(id=conv.id, title=conv.title, project_id=conv.project_id, updated_at=_iso(conv.updated_at))
    finally:
        session.close()


class UpdateConversationIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    title: Optional[str] = None
    project_id: Optional[str] = None       # 传字符串=加入项目；传空字符串=移出项目


@router.patch("/mirror/conversations/{conv_id}")
def update_conversation(conv_id: str, payload: UpdateConversationIn):
    session = SessionLocal()
    try:
        conv = session.get(Conversation, conv_id)
        if conv is None or conv.user_id != payload.user_id:
            raise HTTPException(status_code=404, detail="对话不存在")
        if payload.title is not None:
            conv.title = payload.title[:120]
        if payload.project_id is not None:
            conv.project_id = payload.project_id or None
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()


@router.delete("/mirror/conversations/{conv_id}")
def delete_conversation(conv_id: str, user_id: str):
    session = SessionLocal()
    try:
        conv = session.get(Conversation, conv_id)
        if conv is None or conv.user_id != user_id:
            raise HTTPException(status_code=404, detail="对话不存在")
        session.execute(delete(MirrorMessage).where(MirrorMessage.conversation_id == conv_id))
        session.delete(conv)
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()


class CreateProjectIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=80)


@router.post("/mirror/projects", response_model=ProjectOut)
def create_project(payload: CreateProjectIn):
    session = SessionLocal()
    try:
        proj = MirrorProject(id=f"p_{secrets.token_hex(8)}", user_id=payload.user_id, name=payload.name)
        session.add(proj)
        session.commit()
        return ProjectOut(id=proj.id, name=proj.name)
    finally:
        session.close()


@router.delete("/mirror/projects/{proj_id}")
def delete_project(proj_id: str, user_id: str):
    session = SessionLocal()
    try:
        proj = session.get(MirrorProject, proj_id)
        if proj is None or proj.user_id != user_id:
            raise HTTPException(status_code=404, detail="项目不存在")
        # 项目下的对话移出项目（不删对话）
        session.execute(
            Conversation.__table__.update()
            .where(Conversation.project_id == proj_id).values(project_id=None)
        )
        session.delete(proj)
        session.commit()
        return {"status": "ok"}
    finally:
        session.close()
