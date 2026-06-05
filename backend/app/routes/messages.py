"""好友一对一私信（DM）。

- POST /api/dm/send           给好友发消息（必须互相关注）
- GET  /api/dm/history        拉取与某人的会话，并把对方发来的标记为已读
- GET  /api/dm/conversations  好友会话列表（最后一条 + 未读数），好友=互关
- GET  /api/dm/incoming       轮询新收到的消息（给弹窗横幅用），不标记已读
- POST /api/dm/read           手动标记与某人的会话已读
"""

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_

from app.db import SessionLocal, DirectMessage, Follow, init_db, _now
from app.routes.social import _public_card, _remark_of
from app.routes.push import notify_new_dm

router = APIRouter()

init_db()


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _pair_key(a: str, b: str) -> str:
    return "|".join(sorted([a, b]))


def _are_mutual(session, a: str, b: str) -> bool:
    a_follows_b = session.execute(
        select(Follow).where(Follow.follower_id == a, Follow.followee_id == b)
    ).scalars().first() is not None
    b_follows_a = session.execute(
        select(Follow).where(Follow.follower_id == b, Follow.followee_id == a)
    ).scalars().first() is not None
    return a_follows_b and b_follows_a


# ---------- 模型 ----------

class SendIn(BaseModel):
    sender_id: str = Field(..., min_length=1, max_length=64)
    receiver_id: str = Field(..., min_length=1, max_length=64)
    content: str = Field(default="", max_length=4000)
    image_url: Optional[str] = Field(default=None, max_length=255)


class MessageOut(BaseModel):
    id: int
    from_me: bool
    content: str
    image_url: Optional[str] = None
    created_at: Optional[str] = None
    read: bool = False


class ConversationItem(BaseModel):
    peer: dict[str, Any]
    remark: str = ""
    last_content: str = ""
    last_image: bool = False
    last_from_me: bool = False
    last_at: Optional[str] = None
    unread: int = 0


class IncomingItem(BaseModel):
    id: int
    sender: dict[str, Any]
    content: str
    image_url: Optional[str] = None
    created_at: Optional[str] = None


class ReadIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    peer_id: str = Field(..., min_length=1, max_length=64)


# ---------- 端点 ----------

@router.post("/dm/send", response_model=MessageOut)
def send_message(payload: SendIn, background: BackgroundTasks):
    if payload.sender_id == payload.receiver_id:
        raise HTTPException(status_code=400, detail="不能给自己发消息")
    content = (payload.content or "").strip()
    image_url = (payload.image_url or "").strip() or None
    if not content and not image_url:
        raise HTTPException(status_code=400, detail="消息不能为空")
    session = SessionLocal()
    try:
        if not _are_mutual(session, payload.sender_id, payload.receiver_id):
            raise HTTPException(status_code=403, detail="只能和互相关注的好友聊天")
        msg = DirectMessage(
            pair_key=_pair_key(payload.sender_id, payload.receiver_id),
            sender_id=payload.sender_id,
            receiver_id=payload.receiver_id,
            content=content,
            image_url=image_url,
        )
        session.add(msg)
        session.commit()
        out = MessageOut(
            id=msg.id, from_me=True, content=msg.content, image_url=msg.image_url,
            created_at=_iso(msg.created_at), read=False,
        )
        # 后台给收信人发推送（不阻塞发送响应）
        background.add_task(notify_new_dm, payload.receiver_id, payload.sender_id, content, bool(image_url))
        return out
    finally:
        session.close()


@router.get("/dm/history", response_model=list[MessageOut])
def history(user_id: str, peer_id: str, after_id: int = 0, limit: int = 200):
    session = SessionLocal()
    try:
        pk = _pair_key(user_id, peer_id)
        rows = session.execute(
            select(DirectMessage)
            .where(DirectMessage.pair_key == pk, DirectMessage.id > after_id)
            .order_by(DirectMessage.id.asc())
            .limit(max(1, min(limit, 500)))
        ).scalars().all()

        # 把对方发给我、还没读的标为已读
        now = _now()
        changed = False
        for m in rows:
            if m.receiver_id == user_id and m.read_at is None:
                m.read_at = now
                changed = True
        if changed:
            session.commit()

        return [
            MessageOut(
                id=m.id,
                from_me=(m.sender_id == user_id),
                content=m.content,
                image_url=m.image_url,
                created_at=_iso(m.created_at),
                read=(m.read_at is not None),
            )
            for m in rows
        ]
    finally:
        session.close()


@router.get("/dm/conversations", response_model=list[ConversationItem])
def conversations(user_id: str):
    """好友（互关）会话列表，带最后一条消息 + 未读数，按最近活动排序。"""
    session = SessionLocal()
    try:
        my_following = {r for (r,) in session.execute(
            select(Follow.followee_id).where(Follow.follower_id == user_id)
        ).all()}
        my_followers = {r for (r,) in session.execute(
            select(Follow.follower_id).where(Follow.followee_id == user_id)
        ).all()}
        friends = my_following & my_followers

        items: list[ConversationItem] = []
        for fid in friends:
            pk = _pair_key(user_id, fid)
            last = session.execute(
                select(DirectMessage).where(DirectMessage.pair_key == pk)
                .order_by(DirectMessage.id.desc()).limit(1)
            ).scalars().first()
            unread = session.execute(
                select(func.count()).select_from(DirectMessage).where(
                    DirectMessage.pair_key == pk,
                    DirectMessage.receiver_id == user_id,
                    DirectMessage.read_at.is_(None),
                )
            ).scalar() or 0
            items.append(ConversationItem(
                peer=_public_card(session, fid),
                remark=_remark_of(session, user_id, fid),
                last_content=last.content if last else "",
                last_image=bool(last.image_url) if last else False,
                last_from_me=(last.sender_id == user_id) if last else False,
                last_at=_iso(last.created_at) if last else None,
                unread=int(unread),
            ))

        # 有消息的排前面，按最后消息时间倒序；没消息的按好友排后面
        items.sort(key=lambda it: (it.last_at or ""), reverse=True)
        return items
    finally:
        session.close()


@router.get("/dm/incoming", response_model=list[IncomingItem])
def incoming(user_id: str, after_id: int = 0, limit: int = 20):
    """轮询：拿到 id > after_id 的、别人发给我的新消息（给弹窗横幅用），不标记已读。"""
    session = SessionLocal()
    try:
        rows = session.execute(
            select(DirectMessage)
            .where(DirectMessage.receiver_id == user_id, DirectMessage.id > after_id)
            .order_by(DirectMessage.id.asc())
            .limit(max(1, min(limit, 50)))
        ).scalars().all()
        return [
            IncomingItem(
                id=m.id,
                sender=_public_card(session, m.sender_id),
                content=m.content,
                image_url=m.image_url,
                created_at=_iso(m.created_at),
            )
            for m in rows
        ]
    finally:
        session.close()


@router.post("/dm/read")
def mark_read(payload: ReadIn):
    session = SessionLocal()
    try:
        pk = _pair_key(payload.user_id, payload.peer_id)
        rows = session.execute(
            select(DirectMessage).where(
                DirectMessage.pair_key == pk,
                DirectMessage.receiver_id == payload.user_id,
                DirectMessage.read_at.is_(None),
            )
        ).scalars().all()
        now = _now()
        for m in rows:
            m.read_at = now
        session.commit()
        return {"ok": True, "marked": len(rows)}
    finally:
        session.close()
