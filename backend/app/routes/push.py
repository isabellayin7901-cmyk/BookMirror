"""推送通知：设备上报原生 FCM token，好友来消息时后端直连 FCM HTTP v1 下发。

说明：
- 直连 FCM（不经 Expo 中转）：用服务账号密钥换 OAuth token，POST 到
  https://fcm.googleapis.com/v1/projects/{project_id}/messages:send 。
- 服务账号 JSON 从环境变量 FCM_SERVICE_ACCOUNT_JSON 读（整段 JSON 字符串），
  绝不进 git。没配这个变量时，推送静默跳过（不影响其它功能）。
- iOS 需要 APNs（付费开发者账号），暂不支持；当前仅安卓。
"""

import json
import logging
import os
import threading

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.db import SessionLocal, PushToken, AccountProfile, UserHandle, init_db

logger = logging.getLogger("bookmirror.push")

router = APIRouter()

init_db()

_FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_cred_lock = threading.Lock()
_cred = None
_project_id = None


def _get_credentials():
    """懒加载服务账号凭证（缓存，自动刷新 token）。没配置则返回 None。"""
    global _cred, _project_id
    if _cred is not None:
        return _cred
    raw = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    with _cred_lock:
        if _cred is not None:
            return _cred
        try:
            from google.oauth2 import service_account
            info = json.loads(raw)
            _project_id = info.get("project_id")
            _cred = service_account.Credentials.from_service_account_info(info, scopes=[_FCM_SCOPE])
        except Exception:
            logger.warning("FCM 服务账号解析失败", exc_info=True)
            _cred = None
    return _cred


def _fcm_access_token() -> str | None:
    cred = _get_credentials()
    if cred is None:
        return None
    try:
        import google.auth.transport.requests
        cred.refresh(google.auth.transport.requests.Request())
        return cred.token
    except Exception:
        logger.warning("FCM token 刷新失败", exc_info=True)
        return None


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


def _delete_token(token: str) -> None:
    session = SessionLocal()
    try:
        session.execute(delete(PushToken).where(PushToken.token == token))
        session.commit()
    finally:
        session.close()


def send_push_to_user(user_id: str, title: str, body: str, data: dict | None = None) -> None:
    """给某用户的所有设备发推送，直连 FCM HTTP v1（best-effort）。"""
    access = _fcm_access_token()
    if access is None or not _project_id:
        return  # 没配 FCM 服务账号，静默跳过
    session = SessionLocal()
    try:
        tokens = [r for (r,) in session.execute(
            select(PushToken.token).where(PushToken.user_id == user_id)
        ).all()]
    finally:
        session.close()
    if not tokens:
        return

    url = f"https://fcm.googleapis.com/v1/projects/{_project_id}/messages:send"
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
    str_data = {k: str(v) for k, v in (data or {}).items()}
    for tk in tokens:
        message = {
            "message": {
                "token": tk,
                "notification": {"title": title, "body": body},
                "data": str_data,
                "android": {"priority": "high", "notification": {"channel_id": "default", "sound": "default"}},
            }
        }
        try:
            resp = httpx.post(url, json=message, headers=headers, timeout=8.0)
            if resp.status_code == 404 or (resp.status_code == 400 and "registration-token-not-registered" in resp.text.lower()):
                # token 失效了，清掉
                _delete_token(tk)
            elif resp.status_code >= 400:
                logger.warning("FCM 发送失败 %s: %s", resp.status_code, resp.text[:200])
        except Exception:
            logger.warning("FCM 发送异常 user_id=%s", user_id, exc_info=True)


@router.get("/push/test")
def push_test(handle: str):
    """按 @ID 给自己发一条测试推送，验证链路（调试用）。"""
    session = SessionLocal()
    try:
        row = session.execute(
            select(UserHandle).where(UserHandle.handle == handle)
        ).scalars().first()
        if row is None:
            return {"ok": False, "reason": "handle not found"}
        n_tokens = session.execute(
            select(PushToken).where(PushToken.user_id == row.user_id)
        ).scalars().all()
        uid = row.user_id
        ntok = len(n_tokens)
    finally:
        session.close()
    configured = _get_credentials() is not None
    send_push_to_user(uid, "雪宝", "推送通了 🎉", data={"type": "test"})
    return {"ok": True, "tokens": ntok, "fcm_configured": configured}


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
