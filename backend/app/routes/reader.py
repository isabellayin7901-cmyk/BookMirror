"""阅读器：正文（章节/段落）+ 阅读进度（服务器锚点）+ 段落评论/笔记。

- GET  /api/reader/books                    可读书目（内测用）
- GET  /api/reader/toc?book_id=             目录（章节标题 + 段数）
- GET  /api/reader/chapter?book_id=&index=  某章正文：段落 + 每段评论数
- GET  /api/reader/progress                 取阅读进度
- POST /api/reader/progress                 存阅读进度（读到第几章第几段）
- GET  /api/reader/comments                 某段的评论列表
- POST /api/reader/comment                  发评论/笔记
- POST /api/reader/comment/like             点赞/取消（公开评论）
- POST /api/reader/comment/delete           删自己的评论
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func

from app.db import (
    SessionLocal, ReaderContent, ReaderProgress, ParagraphComment, CommentLike, init_db,
)
from app.routes.social import _public_card

router = APIRouter()

init_db()


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _load(session, book_id: str) -> Optional[dict]:
    row = session.get(ReaderContent, book_id)
    if row is None:
        return None
    try:
        data = json.loads(row.data or "{}")
    except Exception:
        data = {}
    data["title"] = row.title
    return data


# ---------- 入库（内测：本地抽好 PDF → POST 上来） ----------

class IngestIn(BaseModel):
    book_id: str = Field(..., min_length=1, max_length=64)
    title: str = Field(default="", max_length=200)
    data: dict[str, Any] = Field(default_factory=dict)  # {"chapters":[...]}
    secret: str = ""


@router.post("/reader/ingest")
def reader_ingest(payload: IngestIn):
    admin = os.getenv("READER_ADMIN_SECRET", "").strip()
    if admin and payload.secret != admin:
        raise HTTPException(status_code=403, detail="无权写入书库")
    chapters = payload.data.get("chapters", [])
    if not chapters:
        raise HTTPException(status_code=400, detail="没有章节内容")
    session = SessionLocal()
    try:
        row = session.get(ReaderContent, payload.book_id)
        if row is None:
            row = ReaderContent(book_id=payload.book_id)
            session.add(row)
        row.title = payload.title
        row.data = json.dumps({"chapters": chapters}, ensure_ascii=False)
        session.commit()
        n = sum(len(c.get("paras", [])) for c in chapters)
        return {"ok": True, "chapters": len(chapters), "paras": n}
    finally:
        session.close()


# ---------- 目录 / 正文 ----------

@router.get("/reader/books")
def reader_books():
    session = SessionLocal()
    try:
        rows = session.execute(select(ReaderContent)).scalars().all()
        out = []
        for r in rows:
            try:
                n = len(json.loads(r.data or "{}").get("chapters", []))
            except Exception:
                n = 0
            out.append({"book_id": r.book_id, "title": r.title, "chapters": n})
        return out
    finally:
        session.close()


@router.get("/reader/toc")
def reader_toc(book_id: str):
    session = SessionLocal()
    try:
        data = _load(session, book_id)
        if data is None:
            raise HTTPException(status_code=404, detail="书不存在")
        chapters = data.get("chapters", [])
        return {
            "book_id": book_id,
            "title": data.get("title", ""),
            "chapters": [
                {"index": c.get("index", i), "title": c.get("title", f"第{i + 1}章"), "paras": len(c.get("paras", []))}
                for i, c in enumerate(chapters)
            ],
        }
    finally:
        session.close()


@router.get("/reader/chapter")
def reader_chapter(book_id: str, index: int):
    session = SessionLocal()
    try:
        data = _load(session, book_id)
        if data is None:
            raise HTTPException(status_code=404, detail="书不存在")
        chapters = data.get("chapters", [])
        if index < 0 or index >= len(chapters):
            raise HTTPException(status_code=404, detail="章节不存在")
        ch = chapters[index]
        paras = ch.get("paras", [])

        # 这一章每段的公开评论数，一次查出来给气泡用
        rows = session.execute(
            select(ParagraphComment.paragraph, func.count())
            .where(
                ParagraphComment.book_id == book_id,
                ParagraphComment.chapter_index == index,
                ParagraphComment.kind == "comment",
            )
            .group_by(ParagraphComment.paragraph)
        ).all()
        counts = {p: int(n) for (p, n) in rows}

        return {
            "book_id": book_id,
            "index": index,
            "title": ch.get("title", f"第{index + 1}章"),
            "total": len(chapters),
            "paras": [{"i": i, "text": tx, "comments": counts.get(i, 0)} for i, tx in enumerate(paras)],
        }
    finally:
        session.close()


# ---------- 阅读进度 ----------

class ProgressIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    book_id: str = Field(..., min_length=1, max_length=64)
    chapter_index: int = 0
    paragraph: int = 0
    percent: int = 0


@router.get("/reader/progress")
def get_progress(user_id: str, book_id: str):
    session = SessionLocal()
    try:
        row = session.execute(
            select(ReaderProgress).where(
                ReaderProgress.user_id == user_id, ReaderProgress.book_id == book_id
            )
        ).scalars().first()
        if row is None:
            return {"chapter_index": 0, "paragraph": 0, "percent": 0, "started": False}
        return {
            "chapter_index": row.chapter_index,
            "paragraph": row.paragraph,
            "percent": row.percent,
            "started": True,
        }
    finally:
        session.close()


@router.post("/reader/progress")
def set_progress(payload: ProgressIn):
    session = SessionLocal()
    try:
        row = session.execute(
            select(ReaderProgress).where(
                ReaderProgress.user_id == payload.user_id, ReaderProgress.book_id == payload.book_id
            )
        ).scalars().first()
        if row is None:
            row = ReaderProgress(user_id=payload.user_id, book_id=payload.book_id)
            session.add(row)
        row.chapter_index = payload.chapter_index
        row.paragraph = payload.paragraph
        row.percent = max(0, min(100, payload.percent))
        session.commit()
        return {"ok": True}
    finally:
        session.close()


# ---------- 段落评论 / 笔记 ----------

class CommentIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    book_id: str = Field(..., min_length=1, max_length=64)
    chapter_index: int
    paragraph: int
    kind: str = "comment"  # comment / note
    text: str = Field(..., min_length=1, max_length=2000)


class LikeIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    comment_id: int


class DeleteCommentIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    comment_id: int


@router.get("/reader/comments")
def list_comments(book_id: str, chapter_index: int, paragraph: int, viewer_id: str = ""):
    session = SessionLocal()
    try:
        rows = session.execute(
            select(ParagraphComment).where(
                ParagraphComment.book_id == book_id,
                ParagraphComment.chapter_index == chapter_index,
                ParagraphComment.paragraph == paragraph,
            ).order_by(ParagraphComment.likes.desc(), ParagraphComment.created_at.asc())
        ).scalars().all()

        # 我点过赞的评论
        liked: set[int] = set()
        if viewer_id:
            liked = {c for (c,) in session.execute(
                select(CommentLike.comment_id).where(CommentLike.user_id == viewer_id)
            ).all()}

        out = []
        for r in rows:
            # 笔记(note)只有作者自己能看；评论(comment)所有人能看
            if r.kind == "note" and r.user_id != viewer_id:
                continue
            out.append({
                "id": r.id,
                "user": _public_card(session, r.user_id),
                "is_mine": r.user_id == viewer_id,
                "kind": r.kind,
                "text": r.text,
                "likes": r.likes,
                "liked": r.id in liked,
                "created_at": _iso(r.created_at),
            })
        return out
    finally:
        session.close()


@router.post("/reader/comment")
def add_comment(payload: CommentIn):
    kind = payload.kind if payload.kind in ("comment", "note") else "comment"
    session = SessionLocal()
    try:
        c = ParagraphComment(
            book_id=payload.book_id,
            chapter_index=payload.chapter_index,
            paragraph=payload.paragraph,
            user_id=payload.user_id,
            kind=kind,
            text=payload.text.strip(),
        )
        session.add(c)
        session.commit()
        return {
            "id": c.id,
            "user": _public_card(session, c.user_id),
            "is_mine": True,
            "kind": c.kind,
            "text": c.text,
            "likes": 0,
            "liked": False,
            "created_at": _iso(c.created_at),
        }
    finally:
        session.close()


@router.post("/reader/comment/like")
def like_comment(payload: LikeIn):
    session = SessionLocal()
    try:
        c = session.get(ParagraphComment, payload.comment_id)
        if c is None:
            raise HTTPException(status_code=404, detail="评论不存在")
        existing = session.execute(
            select(CommentLike).where(
                CommentLike.comment_id == payload.comment_id, CommentLike.user_id == payload.user_id
            )
        ).scalars().first()
        if existing is None:
            session.add(CommentLike(comment_id=payload.comment_id, user_id=payload.user_id))
            c.likes = (c.likes or 0) + 1
            liked = True
        else:
            session.delete(existing)
            c.likes = max(0, (c.likes or 0) - 1)
            liked = False
        session.commit()
        return {"ok": True, "liked": liked, "likes": c.likes}
    finally:
        session.close()


@router.post("/reader/comment/delete")
def delete_comment(payload: DeleteCommentIn):
    session = SessionLocal()
    try:
        c = session.get(ParagraphComment, payload.comment_id)
        if c is None or c.user_id != payload.user_id:
            return {"ok": False}
        session.execute(delete(CommentLike).where(CommentLike.comment_id == payload.comment_id))
        session.delete(c)
        session.commit()
        return {"ok": True}
    finally:
        session.close()
