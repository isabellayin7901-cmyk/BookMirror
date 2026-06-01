"""每本书的阅读状态 + 进度（想读 / 在读 / 读完）。

读书发生在别的 App（微信读书/番茄/Kindle 等无法读取进度），所以用户自报。
读完(finished)才解锁三合一读后反馈。进度到顶自动判定读完。
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.db import SessionLocal, ReadingStatus, _now, init_db

router = APIRouter()

init_db()

VALID = ("want", "reading", "finished")


class ReadingIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    book_id: str = Field(..., min_length=1, max_length=64)
    status: Optional[str] = None              # want / reading / finished
    current_page: Optional[int] = Field(None, ge=0)
    total_pages: Optional[int] = Field(None, ge=0)


class ReadingOut(BaseModel):
    book_id: str
    status: str
    current_page: int
    total_pages: int
    progress: float                            # 0.0 - 1.0
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _to_out(r: ReadingStatus) -> ReadingOut:
    progress = 0.0
    if r.total_pages > 0:
        progress = min(1.0, r.current_page / r.total_pages)
    elif r.status == "finished":
        progress = 1.0
    return ReadingOut(
        book_id=r.book_id,
        status=r.status,
        current_page=r.current_page,
        total_pages=r.total_pages,
        progress=round(progress, 3),
        started_at=_iso(r.started_at),
        finished_at=_iso(r.finished_at),
    )


@router.post("/reading", response_model=ReadingOut)
def upsert_reading(payload: ReadingIn):
    session = SessionLocal()
    try:
        row = session.execute(
            select(ReadingStatus).where(
                ReadingStatus.user_id == payload.user_id,
                ReadingStatus.book_id == payload.book_id,
            )
        ).scalars().first()
        if row is None:
            row = ReadingStatus(user_id=payload.user_id, book_id=payload.book_id)
            session.add(row)

        if payload.total_pages is not None:
            row.total_pages = payload.total_pages
        if payload.current_page is not None:
            row.current_page = payload.current_page
        if payload.status in VALID:
            row.status = payload.status

        # 首次进入「在读」记开始时间
        if row.status == "reading" and row.started_at is None:
            row.started_at = _now()
        # 进度到顶自动判定读完
        if row.total_pages > 0 and row.current_page >= row.total_pages:
            row.status = "finished"
        # 标记读完记完成时间
        if row.status == "finished":
            if row.finished_at is None:
                row.finished_at = _now()
            if row.total_pages > 0:
                row.current_page = row.total_pages
        else:
            row.finished_at = None  # 回退状态时清掉完成时间

        session.commit()
        session.refresh(row)
        return _to_out(row)
    finally:
        session.close()


@router.get("/reading/book", response_model=Optional[ReadingOut])
def get_reading(user_id: str, book_id: str):
    session = SessionLocal()
    try:
        row = session.execute(
            select(ReadingStatus).where(
                ReadingStatus.user_id == user_id,
                ReadingStatus.book_id == book_id,
            )
        ).scalars().first()
        return _to_out(row) if row else None
    finally:
        session.close()


@router.get("/reading", response_model=list[ReadingOut])
def list_reading(user_id: str, status: Optional[str] = None):
    session = SessionLocal()
    try:
        q = select(ReadingStatus).where(ReadingStatus.user_id == user_id)
        if status in VALID:
            q = q.where(ReadingStatus.status == status)
        q = q.order_by(ReadingStatus.updated_at.desc())
        rows = session.execute(q).scalars().all()
        return [_to_out(r) for r in rows]
    finally:
        session.close()
