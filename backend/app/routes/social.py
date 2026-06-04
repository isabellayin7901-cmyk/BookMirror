"""社交系统：关注 / 粉丝 / 朋友（互关）/ 访客 + 公开个人主页 + 收藏同步。

理念：让用户能看到别人的主页、关注感兴趣的人、形成朋友关系。
- POST   /api/social/follow          关注
- POST   /api/social/unfollow        取消关注
- GET    /api/social/profile         看某人的公开主页（含计数、与我的关系，按隐私过滤）
- GET    /api/social/relations       某人的四项计数（粉丝/关注/朋友/访客）
- GET    /api/social/followers       粉丝列表
- GET    /api/social/following       关注列表
- GET    /api/social/friends         朋友列表（互关）
- GET    /api/social/visitors        访客列表（看过我主页的人）
- POST   /api/social/privacy         保存隐私设置
- POST   /api/social/favorites/sync  同步我的收藏 book_ids（供别人查看）
- GET    /api/social/favorites       某人公开的收藏 book_ids

身份沿用现有惯例：前端持有 user_id 直接传参（与 reviews/account-profile 一致）。
"""

import json
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func

from app.db import (
    SessionLocal, Follow, ProfileVisit, UserFavorite, UserHandle, AccountProfile, init_db, _now,
)

router = APIRouter()

init_db()


# ---------- 工具 ----------

def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _account_data(session, user_id: str) -> dict[str, Any]:
    row = session.get(AccountProfile, user_id)
    if row is None:
        return {}
    try:
        return json.loads(row.data or "{}")
    except Exception:
        return {}


# 生成用 ID 的字符集：去掉易混字符（0/o/1/l/i）。
_HANDLE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
_HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{4,20}$")


def _gen_handle(session) -> str:
    """生成一个唯一的 9 位字母数字 ID。"""
    for _ in range(20):
        h = "".join(secrets.choice(_HANDLE_ALPHABET) for _ in range(9))
        exists = session.execute(
            select(UserHandle).where(UserHandle.handle_lower == h.lower())
        ).scalars().first()
        if exists is None:
            return h
    # 极小概率走到这里，再加一位兜底
    return "".join(secrets.choice(_HANDLE_ALPHABET) for _ in range(10))


def _ensure_handle(session, user_id: str) -> str:
    """取用户 ID，没有就自动生成并落库。"""
    row = session.get(UserHandle, user_id)
    if row is not None:
        return row.handle
    h = _gen_handle(session)
    session.add(UserHandle(user_id=user_id, handle=h, handle_lower=h.lower()))
    session.commit()
    return h


def assign_handle(user_id: str) -> str:
    """供登录流程调用：登录后自动给账号分配 ID（已有则原样返回）。"""
    session = SessionLocal()
    try:
        return _ensure_handle(session, user_id)
    finally:
        session.close()


def _handle_of(session, user_id: str) -> str:
    """只读取已有 ID（不自动生成），用于列表/主页展示。"""
    row = session.get(UserHandle, user_id)
    return row.handle if row else ""


def _privacy(data: dict[str, Any]) -> dict[str, bool]:
    p = data.get("privacy") or {}
    return {
        "hideSignature": bool(p.get("hideSignature")),
        "hideInfo": bool(p.get("hideInfo")),
        "hideReviews": bool(p.get("hideReviews")),
        "hideFavorites": bool(p.get("hideFavorites")),
        "hideVisitors": bool(p.get("hideVisitors")),
    }


def _public_card(session, user_id: str) -> dict[str, Any]:
    """列表里的一张用户卡片（尊重对方的隐藏资料/签名设置）。"""
    data = _account_data(session, user_id)
    priv = _privacy(data)
    return {
        "user_id": user_id,
        "handle": _handle_of(session, user_id),
        "username": (data.get("username") or "").strip(),
        "signature": "" if priv["hideSignature"] else (data.get("signature") or "").strip(),
        "avatar_url": data.get("avatar_url") or None,
        "mbti": None if priv["hideInfo"] else (data.get("mbti") or None),
    }


def _counts(session, user_id: str) -> dict[str, int]:
    fans = session.execute(
        select(func.count()).select_from(Follow).where(Follow.followee_id == user_id)
    ).scalar() or 0
    following = session.execute(
        select(func.count()).select_from(Follow).where(Follow.follower_id == user_id)
    ).scalar() or 0
    # 朋友 = 我关注的人里，也关注我的（互关）
    my_following = {r for (r,) in session.execute(
        select(Follow.followee_id).where(Follow.follower_id == user_id)
    ).all()}
    my_followers = {r for (r,) in session.execute(
        select(Follow.follower_id).where(Follow.followee_id == user_id)
    ).all()}
    friends = len(my_following & my_followers)
    visitors = session.execute(
        select(func.count()).select_from(ProfileVisit).where(ProfileVisit.owner_id == user_id)
    ).scalar() or 0
    return {"fans": int(fans), "following": int(following), "friends": int(friends), "visitors": int(visitors)}


# ---------- 模型 ----------

class FollowIn(BaseModel):
    follower_id: str = Field(..., min_length=1, max_length=64)
    followee_id: str = Field(..., min_length=1, max_length=64)


class FollowOut(BaseModel):
    following: bool
    mutual: bool


class RelationsOut(BaseModel):
    fans: int
    following: int
    friends: int
    visitors: int


class UserCard(BaseModel):
    user_id: str
    handle: str = ""
    username: str = ""
    signature: str = ""
    avatar_url: Optional[str] = None
    mbti: Optional[str] = None


class PublicProfileOut(BaseModel):
    user_id: str
    handle: str = ""
    username: str = ""
    signature: str = ""
    avatar_url: Optional[str] = None
    mbti: Optional[str] = None
    zodiac_sun: Optional[str] = None
    zodiac_element: Optional[str] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    major: Optional[str] = None
    counts: RelationsOut
    is_following: bool = False
    is_mutual: bool = False
    is_self: bool = False
    show_reviews: bool = True
    show_favorites: bool = True


class PrivacyIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    hideSignature: bool = False
    hideInfo: bool = False
    hideReviews: bool = False
    hideFavorites: bool = False
    hideVisitors: bool = False


class FavoritesSyncIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    book_ids: list[str] = Field(default_factory=list)


# ---------- 关注 / 取关 ----------

@router.post("/social/follow", response_model=FollowOut)
def follow(payload: FollowIn):
    if payload.follower_id == payload.followee_id:
        raise HTTPException(status_code=400, detail="不能关注自己")
    session = SessionLocal()
    try:
        exists = session.execute(
            select(Follow).where(
                Follow.follower_id == payload.follower_id,
                Follow.followee_id == payload.followee_id,
            )
        ).scalars().first()
        if exists is None:
            session.add(Follow(follower_id=payload.follower_id, followee_id=payload.followee_id))
            session.commit()
        mutual = session.execute(
            select(Follow).where(
                Follow.follower_id == payload.followee_id,
                Follow.followee_id == payload.follower_id,
            )
        ).scalars().first() is not None
        return FollowOut(following=True, mutual=mutual)
    finally:
        session.close()


@router.post("/social/unfollow", response_model=FollowOut)
def unfollow(payload: FollowIn):
    session = SessionLocal()
    try:
        session.execute(
            delete(Follow).where(
                Follow.follower_id == payload.follower_id,
                Follow.followee_id == payload.followee_id,
            )
        )
        session.commit()
        return FollowOut(following=False, mutual=False)
    finally:
        session.close()


# ---------- 计数 / 公开主页 ----------

@router.get("/social/relations", response_model=RelationsOut)
def relations(user_id: str):
    session = SessionLocal()
    try:
        return RelationsOut(**_counts(session, user_id))
    finally:
        session.close()


@router.get("/social/profile", response_model=PublicProfileOut)
def public_profile(user_id: str, viewer_id: str = ""):
    session = SessionLocal()
    try:
        is_self = bool(viewer_id) and viewer_id == user_id
        # 记录访客（别人来看才记，自己看自己不记；访客开了「不留足迹」则不记）
        viewer_hides_footprint = bool(viewer_id) and _privacy(_account_data(session, viewer_id))["hideVisitors"]
        if viewer_id and not is_self and not viewer_hides_footprint:
            visit = session.execute(
                select(ProfileVisit).where(
                    ProfileVisit.visitor_id == viewer_id,
                    ProfileVisit.owner_id == user_id,
                )
            ).scalars().first()
            if visit is None:
                session.add(ProfileVisit(visitor_id=viewer_id, owner_id=user_id))
            else:
                visit.updated_at = _now()
            session.commit()

        data = _account_data(session, user_id)
        priv = _privacy(data)
        zod = data.get("zodiac") or {}

        is_following = False
        is_mutual = False
        if viewer_id and not is_self:
            is_following = session.execute(
                select(Follow).where(
                    Follow.follower_id == viewer_id, Follow.followee_id == user_id
                )
            ).scalars().first() is not None
            they_follow = session.execute(
                select(Follow).where(
                    Follow.follower_id == user_id, Follow.followee_id == viewer_id
                )
            ).scalars().first() is not None
            is_mutual = is_following and they_follow

        # 自己看自己不受隐私限制
        hide_info = priv["hideInfo"] and not is_self
        hide_sig = priv["hideSignature"] and not is_self

        return PublicProfileOut(
            user_id=user_id,
            handle=_handle_of(session, user_id),
            username=(data.get("username") or "").strip(),
            signature="" if hide_sig else (data.get("signature") or "").strip(),
            avatar_url=data.get("avatar_url") or None,
            mbti=None if hide_info else (data.get("mbti") or None),
            zodiac_sun=None if hide_info else (zod.get("sun_sign") or None),
            zodiac_element=None if hide_info else (zod.get("element") or None),
            gender=None if hide_info else (data.get("gender") or None),
            occupation=None if hide_info else (data.get("occupation") or None),
            major=None if hide_info else (data.get("major") or None),
            counts=RelationsOut(**_counts(session, user_id)),
            is_following=is_following,
            is_mutual=is_mutual,
            is_self=is_self,
            show_reviews=is_self or not priv["hideReviews"],
            show_favorites=is_self or not priv["hideFavorites"],
        )
    finally:
        session.close()


# ---------- 关系列表 ----------

def _cards_for(session, user_ids: list[str]) -> list[UserCard]:
    return [UserCard(**_public_card(session, uid)) for uid in user_ids]


@router.get("/social/followers", response_model=list[UserCard])
def followers(user_id: str, limit: int = 200):
    session = SessionLocal()
    try:
        ids = [r for (r,) in session.execute(
            select(Follow.follower_id).where(Follow.followee_id == user_id)
            .order_by(Follow.created_at.desc()).limit(max(1, min(limit, 500)))
        ).all()]
        return _cards_for(session, ids)
    finally:
        session.close()


@router.get("/social/following", response_model=list[UserCard])
def following_list(user_id: str, limit: int = 200):
    session = SessionLocal()
    try:
        ids = [r for (r,) in session.execute(
            select(Follow.followee_id).where(Follow.follower_id == user_id)
            .order_by(Follow.created_at.desc()).limit(max(1, min(limit, 500)))
        ).all()]
        return _cards_for(session, ids)
    finally:
        session.close()


@router.get("/social/friends", response_model=list[UserCard])
def friends_list(user_id: str):
    session = SessionLocal()
    try:
        my_following = {r for (r,) in session.execute(
            select(Follow.followee_id).where(Follow.follower_id == user_id)
        ).all()}
        my_followers = {r for (r,) in session.execute(
            select(Follow.follower_id).where(Follow.followee_id == user_id)
        ).all()}
        return _cards_for(session, sorted(my_following & my_followers))
    finally:
        session.close()


@router.get("/social/visitors", response_model=list[UserCard])
def visitors(user_id: str, limit: int = 200):
    session = SessionLocal()
    try:
        ids = [r for (r,) in session.execute(
            select(ProfileVisit.visitor_id).where(ProfileVisit.owner_id == user_id)
            .order_by(ProfileVisit.updated_at.desc()).limit(max(1, min(limit, 500)))
        ).all()]
        return _cards_for(session, ids)
    finally:
        session.close()


# ---------- 隐私设置 ----------

@router.post("/social/privacy")
def save_privacy(payload: PrivacyIn):
    session = SessionLocal()
    try:
        row = session.get(AccountProfile, payload.user_id)
        if row is None:
            row = AccountProfile(user_id=payload.user_id, data="{}")
            session.add(row)
        try:
            data = json.loads(row.data or "{}")
        except Exception:
            data = {}
        data["privacy"] = {
            "hideSignature": payload.hideSignature,
            "hideInfo": payload.hideInfo,
            "hideReviews": payload.hideReviews,
            "hideFavorites": payload.hideFavorites,
            "hideVisitors": payload.hideVisitors,
        }
        row.data = json.dumps(data, ensure_ascii=False)
        session.commit()
        return {"ok": True, "privacy": data["privacy"]}
    finally:
        session.close()


@router.get("/social/privacy")
def get_privacy(user_id: str):
    session = SessionLocal()
    try:
        return _privacy(_account_data(session, user_id))
    finally:
        session.close()


# ---------- 收藏同步（供别人看「ta 的收藏」） ----------

@router.post("/social/favorites/sync")
def sync_favorites(payload: FavoritesSyncIn):
    session = SessionLocal()
    try:
        session.execute(delete(UserFavorite).where(UserFavorite.user_id == payload.user_id))
        seen = set()
        for bid in payload.book_ids:
            bid = (bid or "").strip()
            if not bid or bid in seen:
                continue
            seen.add(bid)
            session.add(UserFavorite(user_id=payload.user_id, book_id=bid))
        session.commit()
        return {"ok": True, "count": len(seen)}
    finally:
        session.close()


@router.get("/social/favorites")
def get_favorites(user_id: str, viewer_id: str = ""):
    session = SessionLocal()
    try:
        priv = _privacy(_account_data(session, user_id))
        is_self = bool(viewer_id) and viewer_id == user_id
        if priv["hideFavorites"] and not is_self:
            return {"book_ids": []}
        ids = [r for (r,) in session.execute(
            select(UserFavorite.book_id).where(UserFavorite.user_id == user_id)
            .order_by(UserFavorite.created_at.desc())
        ).all()]
        return {"book_ids": ids}
    finally:
        session.close()


# ---------- 用户 ID（可搜索的 handle）+ 找好友 ----------

class MyIdIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)
    handle: str = Field(..., min_length=4, max_length=20)


class MyIdOut(BaseModel):
    handle: str


@router.get("/social/my-id", response_model=MyIdOut)
def my_id(user_id: str):
    """取我的 ID；没有就自动生成一个 9 位字母数字。"""
    session = SessionLocal()
    try:
        return MyIdOut(handle=_ensure_handle(session, user_id))
    finally:
        session.close()


@router.post("/social/my-id", response_model=MyIdOut)
def set_my_id(payload: MyIdIn):
    """自定义我的 ID。校验格式 + 全局唯一（大小写无关）。"""
    h = payload.handle.strip()
    if not _HANDLE_RE.match(h):
        raise HTTPException(status_code=400, detail="ID 只能用 4-20 位字母、数字或下划线")
    session = SessionLocal()
    try:
        # 区分大小写：wren_test 和 WREN_TEST 是两个不同的 ID。
        taken = session.execute(
            select(UserHandle).where(UserHandle.handle == h)
        ).scalars().first()
        if taken is not None and taken.user_id != payload.user_id:
            raise HTTPException(status_code=409, detail="这个 ID 已经被别人用了，换一个试试")

        row = session.get(UserHandle, payload.user_id)
        if row is None:
            row = UserHandle(user_id=payload.user_id, handle=h, handle_lower=h.lower())
            session.add(row)
        else:
            row.handle = h
            row.handle_lower = h.lower()
        session.commit()
        return MyIdOut(handle=h)
    finally:
        session.close()


@router.get("/social/search", response_model=list[UserCard])
def search_users(q: str, viewer_id: str = "", limit: int = 30):
    """按 ID 或用户名搜索用户。"""
    s = (q or "").strip()
    if len(s) < 2:
        return []
    session = SessionLocal()
    try:
        found: list[str] = []
        seen: set[str] = set()

        # 1) 按 ID（handle）匹配
        for (uid,) in session.execute(
            select(UserHandle.user_id)
            .where(UserHandle.handle_lower.like(f"%{s.lower()}%"))
            .limit(limit)
        ).all():
            if uid not in seen:
                seen.add(uid)
                found.append(uid)

        # 2) 按用户名匹配（用户名存在 AccountProfile 的 JSON 里，无法直接 SQL 过滤，
        #    扫一遍在内存里筛；用户量大时再加倒排索引）。
        if len(found) < limit:
            ql = s.lower()
            rows = session.execute(select(AccountProfile.user_id, AccountProfile.data)).all()
            for uid, data_str in rows:
                if uid in seen:
                    continue
                try:
                    name = (json.loads(data_str or "{}").get("username") or "")
                except Exception:
                    name = ""
                if name and ql in name.lower():
                    seen.add(uid)
                    found.append(uid)
                    if len(found) >= limit:
                        break

        # 不把搜索者自己列进去
        cards = [
            UserCard(**_public_card(session, uid))
            for uid in found
            if not (viewer_id and uid == viewer_id)
        ]
        return cards
    finally:
        session.close()
