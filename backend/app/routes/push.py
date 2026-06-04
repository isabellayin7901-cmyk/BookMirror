"""推送通知：设备上报 Expo push token，好友来消息时通过 Expo Push 服务下发。

说明：
- 走 Expo 的推送服务（https://exp.host/--/api/v2/push/send），服务端不需要 APNs/FCM 密钥。
- 但要真正送达：Android 需要在 EAS 配好 FCM 凭证；iOS 需要 APNs（需付费开发者账号）。
- 这里只负责存 token + 触发下发；送达取决于客户端构建是否配好上述凭证。
"""

import json
import logging

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.db import SessionLocal, PushToken, AccountProfile, UserHandle, init_db

logger = logging.getLogger("bookmirror.push")

router = APIRouter()

init_db()

_EXPO_URL = "https://exp.host/--/api/v2/push/send"


class RegisterIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    token: str = Field(..., min_length=8, max_length=255)
    platform: str = Field(default="")


class UnregisterIn(BaseModel):
    token: str = Field(..., min_length=8, max_length=255)


@router.post("/push/register")
def register(payload: RegisterIn):
    session = SessionLocal()
    try:
        row = session.get(PushToken, payload.token)
        if row is None:
            row = PushToken(token=payload.token, user_id=payload.user_id, platform=payload.platform)
            session.add(row)
        else:
            row.user_id = payload.user_id
            row.platform = payload.platform
        session.commit()
        return {"ok": True}
    finally:
        session.close()


@router.post("/push/unregister")
def unregister(payload: UnregisterIn):
    session = SessionLocal()
    try:
        session.execute(delete(PushToken).where(PushToken.token == payload.token))
        session.commit()
        return {"ok": True}
    finally:
        session.close()


def _display_name(session, user_id: str) -> str:
    row = session.get(AccountProfile, user_id)
    if row is not None:
        try:
            name = (json.loads(row.data or "{}").get("username") or "").strip()
            if name:
                return name
        except Exception:
            pass
    h = session.get(UserHandle, user_id)
    return f"@{h.handle}" if h else "好友"


def send_push_to_user(user_id: str, title: str, body: str, data: dict | None = None) -> None:
    """给某用户的所有设备发推送（best-effort）。"""
    session = SessionLocal()
    try:
        tokens = [r for (r,) in session.execute(
            select(PushToken.token).where(PushToken.user_id == user_id)
        ).all()]
    finally:
        session.close()
    if not tokens:
        return
    messages = [
        {"to": tk, "title": title, "body": body, "data": data or {}, "sound": "default"}
        for tk in tokens
    ]
    try:
        httpx.post(_EXPO_URL, json=messages, timeout=8.0, headers={"Content-Type": "application/json"})
    except Exception:
        logger.warning("发送推送失败 user_id=%s", user_id, exc_info=True)


def notify_new_dm(receiver_id: str, sender_id: str, content: str, has_image: bool) -> None:
    """好友私信到达时触发的推送（在后台任务里调用）。"""
    session = SessionLocal()
    try:
        title = _display_name(session, sender_id)
    finally:
        session.close()
    body = content.strip() if content.strip() else ("[图片]" if has_image else "")
    if not body:
        body = "[图片]"
    send_push_to_user(receiver_id, title, body, data={"type": "dm", "peerId": sender_id})
