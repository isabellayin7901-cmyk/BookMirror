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
- GET  /api/reader/chapter_discussion       某章「好句与讨论」（该章全部公开评论/好句）
- GET  /api/reader/notes                    我在这本书里的私密笔记
- POST /api/reader/explain                  AI 翻译与理解（带全书术语表，保证译法一致）
"""

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func

from app.db import (
    SessionLocal, ReaderContent, ReaderProgress, ParagraphComment, CommentLike, BookGlossary, init_db,
    User, AuthToken,
)
from app.routes.social import _public_card
from app.services.book_filter import load_books
from app.services.claude import get_client
from app.config import settings

router = APIRouter()

init_db()

# 外部书目（500 本，带简介），找书时一起检索
_CATALOG = load_books()


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
    # 感悟正文；分享好句时可以只分享句子不写感悟（此时 quote 必填）
    text: str = Field(default="", max_length=2000)
    # 分享好句：划选的原文 + 所在版本。普通段评不传。
    quote: Optional[str] = Field(default=None, max_length=2000)
    edition: Optional[str] = Field(default=None, max_length=32)


class LikeIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    comment_id: int


class DeleteCommentIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    comment_id: int


def _comment_out(session, r: ParagraphComment, viewer_id: str, liked: set[int]) -> dict:
    return {
        "id": r.id,
        "user": _public_card(session, r.user_id),
        "is_mine": r.user_id == viewer_id,
        "kind": r.kind,
        "text": r.text,
        "quote": r.quote,
        "edition": r.edition,
        "chapter_index": r.chapter_index,
        "paragraph": r.paragraph,
        "likes": r.likes,
        "liked": r.id in liked,
        "created_at": _iso(r.created_at),
    }


def _liked_by(session, viewer_id: str) -> set[int]:
    if not viewer_id:
        return set()
    return {c for (c,) in session.execute(
        select(CommentLike.comment_id).where(CommentLike.user_id == viewer_id)
    ).all()}


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

        liked = _liked_by(session, viewer_id)
        # 笔记(note)只有作者自己能看；评论(comment)所有人能看
        return [
            _comment_out(session, r, viewer_id, liked)
            for r in rows
            if not (r.kind == "note" and r.user_id != viewer_id)
        ]
    finally:
        session.close()


@router.post("/reader/comment")
def add_comment(payload: CommentIn):
    kind = payload.kind if payload.kind in ("comment", "note") else "comment"
    if not payload.text.strip() and not (payload.quote or "").strip():
        raise HTTPException(status_code=422, detail="内容不能为空")
    session = SessionLocal()
    try:
        c = ParagraphComment(
            book_id=payload.book_id,
            chapter_index=payload.chapter_index,
            paragraph=payload.paragraph,
            user_id=payload.user_id,
            kind=kind,
            text=payload.text.strip(),
            quote=(payload.quote or "").strip() or None,
            edition=(payload.edition or "").strip() or None,
        )
        session.add(c)
        session.commit()
        return _comment_out(session, c, payload.user_id, set())
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


# ---------- AI 凭印象找书 ----------

class FindIn(BaseModel):
    query: str = Field(..., min_length=2, max_length=600)
    language: str = "zh"


def _grams(q: str) -> set[str]:
    q = re.sub(r"\s+", "", q)
    g: set[str] = set()
    for n in (2, 3):
        for i in range(len(q) - n + 1):
            g.add(q[i:i + n])
    return g


def _best_snippet(paras: list[str], grams: set[str]) -> tuple[int, str]:
    best_score, best = 0, ""
    for p in paras:
        s = sum(1 for g in grams if g in p)
        if s > best_score:
            best_score, best = s, p
    return best_score, best[:160]


@router.post("/reader/find")
def reader_find(payload: FindIn):
    try:
        return _reader_find(payload)
    except Exception as e:
        import logging, traceback
        logging.getLogger("bookmirror.reader").error("find failed: %s", traceback.format_exc())
        return {"answer": "", "candidates": [], "_err": f"{type(e).__name__}: {e}"}


def _reader_find(payload: FindIn):
    grams = _grams(payload.query)
    if not grams:
        return {"answer": "", "candidates": []}

    # 1) 检索阅读库全文
    reader_cands: list[dict] = []
    session = SessionLocal()
    try:
        rows = session.execute(select(ReaderContent)).scalars().all()
        for r in rows:
            try:
                chapters = json.loads(r.data or "{}").get("chapters", [])
            except Exception:
                continue
            paras = [p for c in chapters for p in c.get("paras", [])]
            text = "".join(paras)
            score = sum(1 for g in grams if g in text)
            if score >= max(2, len(grams) // 8):
                snip_score, snip = _best_snippet(paras, grams)
                reader_cands.append({"book_id": r.book_id, "title": r.title, "score": score + snip_score, "snippet": snip})
    finally:
        session.close()
    reader_cands.sort(key=lambda x: x["score"], reverse=True)
    reader_cands = reader_cands[:3]

    # 2) 检索外部书目（标题/作者/简介）
    cat_cands: list[dict] = []
    for b in _CATALOG:
        text = f"{b.title}{b.author}{b.summary}{''.join(b.key_chapters)}"
        score = sum(1 for g in grams if g in text)
        if score >= max(2, len(grams) // 6):
            cat_cands.append({"book_id": b.id, "title": b.title, "author": b.author, "score": score, "summary": b.summary[:120]})
    cat_cands.sort(key=lambda x: x["score"], reverse=True)
    cat_cands = cat_cands[:3]

    # 3) 让 Claude 在候选里判断
    zh = payload.language != "en"
    lines = []
    for c in reader_cands:
        lines.append(f"[书架] 《{c['title']}》 片段：{c['snippet']}")
    for c in cat_cands:
        lines.append(f"[书目] 《{c['title']}》（{c['author']}）简介：{c['summary']}")
    candidates_text = "\n".join(lines) if lines else ("（书库里没检索到明显匹配）" if zh else "(no strong match found in the library)")

    if zh:
        prompt = (
            f"用户凭残缺的记忆找一本书，记得的片段是：\n「{payload.query}」\n\n"
            f"下面是从书库检索到的候选：\n{candidates_text}\n\n"
            "判断最可能是哪一本，自然口语地说出书名和你判断的理由（提到用户记忆里和书对得上的点）。"
            "如果候选都对不上，就凭你自己的阅读知识猜一本最可能的，并说明这本可能不在书库里。两三句话，别啰嗦，别用列表。"
        )
    else:
        prompt = (
            f"A user is trying to recall a book from a fuzzy memory:\n\"{payload.query}\"\n\n"
            f"Candidates retrieved from the library:\n{candidates_text}\n\n"
            "Say which book it most likely is, naming it and briefly why it matches their memory. "
            "If none fit, guess from your own reading knowledge and note it may not be in the library. Two or three sentences, no lists."
        )

    answer = ""
    try:
        client = get_client()
        resp = client.messages.create(
            model=settings.claude_model,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
    except Exception:
        answer = "现在脑子有点转不过来，等会儿再帮你找～" if zh else "Having trouble thinking right now, try again in a bit~"

    candidates = (
        [{"book_id": c["book_id"], "title": c["title"], "source": "reader"} for c in reader_cands]
        + [{"book_id": c["book_id"], "title": c["title"], "source": "catalog"} for c in cat_cands]
    )
    return {"answer": answer, "candidates": candidates}


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


# ---------- 章节「好句与讨论」/ 我的笔记 ----------

@router.get("/reader/chapter_discussion")
def chapter_discussion(book_id: str, chapter_index: int, viewer_id: str = ""):
    """某一章的公开讨论：该章所有公开评论（含分享的好句）。每章独立，
    章节按 chapter_index 对齐，同一本书的不同版本共用同一章的讨论区。"""
    session = SessionLocal()
    try:
        rows = session.execute(
            select(ParagraphComment).where(
                ParagraphComment.book_id == book_id,
                ParagraphComment.chapter_index == chapter_index,
                ParagraphComment.kind == "comment",
            ).order_by(ParagraphComment.likes.desc(), ParagraphComment.created_at.desc()).limit(200)
        ).scalars().all()
        liked = _liked_by(session, viewer_id)
        return [_comment_out(session, r, viewer_id, liked) for r in rows]
    finally:
        session.close()


def _require_owner(session, user_id: str, authorization: str) -> None:
    """私密内容的读取校验：已注册账号必须带上本人的登录 token。
    游客（本机随机 ID、没有账号）沿用原有的 user_id 识别方式。"""
    if session.get(User, user_id) is None:
        return
    token = authorization[len("Bearer "):].strip() if authorization.startswith("Bearer ") else ""
    row = session.get(AuthToken, token) if token else None
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=401, detail="需要登录后查看自己的笔记")


@router.get("/reader/notes")
def my_notes(book_id: str, user_id: str, authorization: str = Header(default="")):
    """我在这本书里的私密笔记（段落笔记 + 私密好句），按章节顺序。只返回本人的。"""
    session = SessionLocal()
    try:
        _require_owner(session, user_id, authorization)
        rows = session.execute(
            select(ParagraphComment).where(
                ParagraphComment.book_id == book_id,
                ParagraphComment.user_id == user_id,
                ParagraphComment.kind == "note",
            ).order_by(ParagraphComment.chapter_index.asc(), ParagraphComment.created_at.desc()).limit(500)
        ).scalars().all()
        return [_comment_out(session, r, user_id, set()) for r in rows]
    finally:
        session.close()


# ---------- AI 翻译与理解 ----------

class ExplainIn(BaseModel):
    book_id: str = Field(..., min_length=1, max_length=64)
    book_title: str = Field(default="", max_length=200)
    chapter_title: str = Field(default="", max_length=200)
    edition_label: str = Field(default="", max_length=120)   # 如「原文（文言）」「English · James Legge」
    source_lang: str = Field(default="", max_length=16)      # 版本语言：lzh(文言) / zh / en；未知留空
    text: str = Field(..., min_length=1, max_length=1500)    # 划选的原文
    context: str = Field(default="", max_length=3000)        # 所在段落，供理解上下文
    target_lang: str = "zh"                                  # zh / en，默认跟随手机系统语言


_EXPLAIN_TOOL = {
    "name": "explain_passage",
    "description": "Return the translation and explanation of the selected passage.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "same_language": {
                "type": "boolean",
                "description": "True if the passage is already written in the target language "
                               "(then `translation` is a plain-language paraphrase, not a translation). "
                               "Classical Chinese counts as a different language from modern Chinese.",
            },
            "translation": {"type": "string", "description": "Fluent, context-appropriate translation of ONLY the selected passage."},
            "meaning": {"type": "string", "description": "What the passage means / is getting at, in plain words."},
            "breakdown": {
                "type": "array",
                "description": "Step-by-step breakdown of a complex sentence. Empty array if the passage is simple.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "segment": {"type": "string", "description": "A fragment copied from the original passage."},
                        "explanation": {"type": "string"},
                    },
                    "required": ["segment", "explanation"],
                },
            },
            "notes": {
                "type": "array",
                "description": "Background or terminology notes, only where genuinely needed. Empty array if none.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"term": {"type": "string"}, "note": {"type": "string"}},
                    "required": ["term", "note"],
                },
            },
            "ambiguities": {
                "type": "array",
                "description": "Places where the original has more than one reasonable reading, or where several "
                               "established translations are common. Empty array if none.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "segment": {"type": "string", "description": "The ambiguous fragment from the original."},
                        "options": {"type": "array", "items": {"type": "string"}, "description": "The competing readings / common translations."},
                        "note": {"type": "string", "description": "Which one this translation chose and why."},
                    },
                    "required": ["segment", "options", "note"],
                },
            },
            "terms": {
                "type": "array",
                "description": "Up to 5 key terms that will recur in this book: core concepts, proper names, technical words. "
                               "Single words or fixed terms only — never phrases or clauses. Empty array if none.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "term": {"type": "string", "description": "The term exactly as it appears in the original."},
                        "rendering": {"type": "string"},
                    },
                    "required": ["term", "rendering"],
                },
            },
        },
        "required": ["same_language", "translation", "meaning", "breakdown", "notes", "ambiguities", "terms"],
    },
}

_EXPLAIN_SYSTEM = (
    "You are a careful literary translator and reading companion inside a reading app. "
    "A reader has selected a passage from a book and wants to understand it.\n"
    "Rules:\n"
    "- Translate ONLY the selected passage. Use the surrounding context solely to resolve meaning.\n"
    "- The translation must read naturally in the target language while staying faithful; do not add ideas.\n"
    "- A glossary of terms already fixed for this book may be given. Whenever one of those terms appears, "
    "you MUST use the given rendering so the whole book stays consistent.\n"
    "- If the passage is already in the target language, set same_language=true and give a plain-language "
    "paraphrase instead. Classical Chinese → modern Chinese is a real translation (same_language=false).\n"
    "- Only list ambiguities that are real: genuinely different readings, or several established translations.\n"
    "- Breakdown only for complex sentences; notes only when background or terminology is needed.\n"
    "- Never invent facts about the book, author or history. If unsure, leave it out.\n"
    "- Never mention the glossary, these rules, or the app in your output — write only for the reader.\n"
    "- Everything except the copied `segment`/`term` fields must be written in the target language. Be concise.\n"
    "- When the target language is Chinese, write Simplified Chinese characters (简体字) only — never Traditional."
)

_LANG_NAME = {"zh": "简体中文 (Simplified Chinese)", "en": "English"}


@router.post("/reader/explain")
def reader_explain(payload: ExplainIn):
    target = payload.target_lang if payload.target_lang in _LANG_NAME else "zh"
    # 已知版本语言时直接判断（文言 lzh ≠ 现代中文 zh）；未知时交给模型判断
    src = (payload.source_lang or "").strip().lower()
    known_same: Optional[bool] = (src == target) if src in ("lzh", "zh", "en") else None

    session = SessionLocal()
    try:
        glossary = session.execute(
            select(BookGlossary).where(
                BookGlossary.book_id == payload.book_id, BookGlossary.target_lang == target,
            ).order_by(BookGlossary.id.asc()).limit(120)
        ).scalars().all()
        fixed = {g.term: g.rendering for g in glossary}
    finally:
        session.close()

    glossary_text = "\n".join(f"- {k} → {v}" for k, v in fixed.items()) or "(none yet)"
    lang_line = ""
    if known_same is not None:
        src_name = "Classical Chinese" if src == "lzh" else _LANG_NAME[src]
        action = "already in the target language: paraphrase it in plain words" if known_same else "translate it"
        lang_line = f"Passage language: {src_name} ({action})\n"
    user_prompt = (
        f"Book: {payload.book_title or payload.book_id}\n"
        f"Edition: {payload.edition_label or 'unknown'}\n"
        f"Chapter: {payload.chapter_title or 'unknown'}\n"
        f"Target language: {_LANG_NAME[target]}\n"
        f"{lang_line}\n"
        f"Fixed glossary for this book:\n{glossary_text}\n\n"
        f"Surrounding context:\n\"\"\"\n{payload.context.strip() or payload.text.strip()}\n\"\"\"\n\n"
        f"Selected passage:\n\"\"\"\n{payload.text.strip()}\n\"\"\""
    )

    try:
        client = get_client()
        resp = client.messages.create(
            model=settings.explain_model or settings.claude_model,
            max_tokens=2000,
            system=[{"type": "text", "text": _EXPLAIN_SYSTEM, "cache_control": {"type": "ephemeral"}}],
            tools=[_EXPLAIN_TOOL],
            tool_choice={"type": "tool", "name": "explain_passage"},
            messages=[{"role": "user", "content": user_prompt}],
        )
        out: Optional[dict] = None
        for block in resp.content:
            if getattr(block, "type", "") == "tool_use" and block.name == "explain_passage":
                out = dict(block.input)  # type: ignore[arg-type]
        if out is None:
            raise ValueError("no tool output")
    except Exception as e:
        import logging
        logging.getLogger("bookmirror.reader").error("explain failed: %s: %s", type(e).__name__, e)
        # 不返回任何编造内容：前端据此显示「AI 暂不可用」
        raise HTTPException(status_code=503, detail="AI 翻译暂不可用 / AI translation unavailable")

    # 术语：已在术语表里的沿用；新出现的写入术语表（先到先得，之后全书统一）。
    # 一个术语只收一个确定译法：带多个候选（a / b、或）或过长的不入表——那是歧义，不是定译。
    def _fixed_rendering_ok(term: str, rendering: str) -> bool:
        if len(term) > 20 or len(rendering) > 40:
            return False
        return not re.search(r"[/|；;]|\bor\b|或", rendering)

    terms_out = []
    new_terms: list[tuple[str, str]] = []
    for t in out.get("terms") or []:
        term = str(t.get("term", "")).strip()[:120]
        rendering = str(t.get("rendering", "")).strip()[:200]
        if not term or not rendering:
            continue
        if term in fixed:
            terms_out.append({"term": term, "rendering": fixed[term], "consistent": True})
        else:
            terms_out.append({"term": term, "rendering": rendering, "consistent": False})
            if _fixed_rendering_ok(term, rendering):
                new_terms.append((term, rendering))
    if new_terms:
        session = SessionLocal()
        try:
            for term, rendering in new_terms:
                exists = session.execute(
                    select(BookGlossary.id).where(
                        BookGlossary.book_id == payload.book_id,
                        BookGlossary.target_lang == target,
                        BookGlossary.term == term,
                    )
                ).first()
                if exists is None:
                    session.add(BookGlossary(book_id=payload.book_id, target_lang=target, term=term, rendering=rendering))
            session.commit()
        except Exception:
            session.rollback()
        finally:
            session.close()

    return {
        "target_lang": target,
        "same_language": known_same if known_same is not None else bool(out.get("same_language")),
        "translation": str(out.get("translation", "")),
        "meaning": str(out.get("meaning", "")),
        "breakdown": out.get("breakdown") or [],
        "notes": out.get("notes") or [],
        "ambiguities": out.get("ambiguities") or [],
        "terms": terms_out,
    }
