"""账号系统：手机号验证码登录/注册（mock 短信）+ 社交登录占位。

闭环：
  POST /api/auth/request-code  发送验证码（mock 模式仅记录日志，可回传 code）
  POST /api/auth/verify-code   校验验证码，自动注册或登录，返回 {token, user_id, is_new}
  GET  /api/auth/me            用 Bearer token 取当前账号信息

social（apple/google/wechat）目前只占位，待接入真实凭证后实现。
"""

import logging
import secrets
import re
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete

from app.config import settings
from app.db import SessionLocal, User, AuthToken, PhoneOtp, init_db, _now


def _utcnow_naive() -> datetime:
    """Naive UTC now. SQLite stores datetimes without tzinfo, so we must
    compare OTP expiry against a naive value to avoid aware/naive TypeError."""
    return datetime.utcnow()

logger = logging.getLogger("bookmirror.auth")

router = APIRouter()

# 确保账号相关表存在（幂等）。
init_db()

_PHONE_RE = re.compile(r"^\d{4,15}$")
_CC_RE = re.compile(r"^\+\d{1,4}$")


# ---------- request / response 模型 ----------

class RequestCodeIn(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=8)   # "+86"
    phone: str = Field(..., min_length=4, max_length=15)         # 纯数字，不含国号


class RequestCodeOut(BaseModel):
    sent: bool = True
    # 仅 mock + otp_dev_echo 时回传，方便开发自测；生产为 None。
    dev_code: str | None = None


class VerifyCodeIn(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=8)
    phone: str = Field(..., min_length=4, max_length=15)
    code: str = Field(..., min_length=4, max_length=8)


class GoogleIn(BaseModel):
    id_token: str = Field(..., min_length=20)


class AuthOut(BaseModel):
    token: str
    user_id: str
    is_new: bool


class MeOut(BaseModel):
    user_id: str
    phone: str | None = None
    country_code: str | None = None
    provider: str | None = None


# ---------- 工具 ----------

def _phone_key(country_code: str, phone: str) -> str:
    return f"{country_code}{phone}"


def _validate_phone(country_code: str, phone: str) -> None:
    if not _CC_RE.match(country_code):
        raise HTTPException(status_code=400, detail="国号格式不正确")
    if not _PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="手机号格式不正确")


def _send_sms(phone_key: str, code: str) -> None:
    """发送短信。mock 模式只记录日志；接入真实服务商时在此实现。"""
    if settings.sms_provider == "mock":
        logger.info("[MOCK SMS] %s -> 验证码 %s", phone_key, code)
        return
    # TODO: 接入 twilio / 阿里云短信等
    logger.warning("未配置真实短信服务商(%s)，回退 mock", settings.sms_provider)


# ---------- 端点 ----------

@router.post("/auth/request-code", response_model=RequestCodeOut)
def request_code(payload: RequestCodeIn):
    _validate_phone(payload.country_code, payload.phone)
    phone_key = _phone_key(payload.country_code, payload.phone)
    code = f"{secrets.randbelow(1000000):06d}"

    session = SessionLocal()
    try:
        # 同一号码旧的待验证码作废，避免堆积。
        session.execute(delete(PhoneOtp).where(PhoneOtp.phone_key == phone_key))
        session.add(PhoneOtp(
            phone_key=phone_key,
            code=code,
            expires_at=_utcnow_naive() + timedelta(seconds=settings.otp_ttl_seconds),
        ))
        session.commit()
    finally:
        session.close()

    _send_sms(phone_key, code)
    dev_code = code if (settings.sms_provider == "mock" and settings.otp_dev_echo) else None
    return RequestCodeOut(sent=True, dev_code=dev_code)


@router.post("/auth/verify-code", response_model=AuthOut)
def verify_code(payload: VerifyCodeIn):
    _validate_phone(payload.country_code, payload.phone)
    phone_key = _phone_key(payload.country_code, payload.phone)

    session = SessionLocal()
    try:
        otp = session.execute(
            select(PhoneOtp)
            .where(PhoneOtp.phone_key == phone_key)
            .order_by(PhoneOtp.id.desc())
        ).scalars().first()

        if otp is None:
            raise HTTPException(status_code=400, detail="请先获取验证码")
        if otp.expires_at < _utcnow_naive():
            session.execute(delete(PhoneOtp).where(PhoneOtp.phone_key == phone_key))
            session.commit()
            raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
        if otp.attempts >= settings.otp_max_attempts:
            session.execute(delete(PhoneOtp).where(PhoneOtp.phone_key == phone_key))
            session.commit()
            raise HTTPException(status_code=429, detail="尝试次数过多，请重新获取验证码")
        if payload.code != otp.code:
            otp.attempts += 1
            session.commit()
            raise HTTPException(status_code=400, detail="验证码不正确")

        # 验证通过：作废验证码。
        session.execute(delete(PhoneOtp).where(PhoneOtp.phone_key == phone_key))

        # 查账号，没有就注册。
        user = session.execute(
            select(User).where(User.phone == phone_key)
        ).scalars().first()
        is_new = user is None
        if is_new:
            user = User(
                user_id=f"u_{secrets.token_hex(10)}",
                phone=phone_key,
                country_code=payload.country_code,
            )
            session.add(user)
        else:
            user.last_login = _now()

        token = secrets.token_urlsafe(36)
        session.add(AuthToken(token=token, user_id=user.user_id))
        session.commit()

        return AuthOut(token=token, user_id=user.user_id, is_new=is_new)
    finally:
        session.close()


@router.post("/auth/google", response_model=AuthOut)
def google_login(payload: GoogleIn):
    allowed = settings.google_client_ids_list
    if not allowed:
        raise HTTPException(status_code=503, detail="Google 登录未配置")

    # 用 Google 官方 tokeninfo 端点校验 id_token（验签名+有效期），再核对 aud / iss。
    try:
        resp = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": payload.id_token},
            timeout=8.0,
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"无法连接 Google: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Google 凭证无效")
    info = resp.json()

    if info.get("aud") not in allowed:
        raise HTTPException(status_code=401, detail="Google 凭证不属于本应用")
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Google 凭证来源不可信")
    sub = info.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Google 凭证缺少用户标识")

    session = SessionLocal()
    try:
        user = session.execute(
            select(User).where(User.provider == "google", User.provider_uid == sub)
        ).scalars().first()
        is_new = user is None
        if is_new:
            user = User(
                user_id=f"u_{secrets.token_hex(10)}",
                provider="google",
                provider_uid=sub,
            )
            session.add(user)
        else:
            user.last_login = _now()

        token = secrets.token_urlsafe(36)
        session.add(AuthToken(token=token, user_id=user.user_id))
        session.commit()
        return AuthOut(token=token, user_id=user.user_id, is_new=is_new)
    finally:
        session.close()


@router.get("/auth/me", response_model=MeOut)
def me(authorization: str = Header(default="")):
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="缺少登录凭证")
    token = authorization[len(prefix):].strip()

    session = SessionLocal()
    try:
        row = session.get(AuthToken, token)
        if row is None:
            raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
        user = session.get(User, row.user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="账号不存在")
        return MeOut(
            user_id=user.user_id,
            phone=user.phone,
            country_code=user.country_code,
            provider=user.provider,
        )
    finally:
        session.close()
