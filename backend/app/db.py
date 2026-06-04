"""SQLAlchemy persistence for the 小镜子 (Little Mirror) chat.

Storage is configurable via DATABASE_URL. Defaults to a local SQLite file.
On Render, mount a persistent disk and point DATABASE_URL at it
(e.g. sqlite:////data/mirror.db) so conversations survive redeploys.
Swappable to Postgres later by changing DATABASE_URL only.
"""

import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, Integer, Boolean, DateTime, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    # local default: ./data/mirror.db (relative to backend working dir)
    db_path = os.path.join(os.getcwd(), "data", "mirror.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return f"sqlite:///{db_path}"


DATABASE_URL = _database_url()

# For file-backed SQLite, ensure the parent directory exists.
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    pass  # relative path dir already created in _database_url
elif DATABASE_URL.startswith("sqlite:////"):
    abs_path = "/" + DATABASE_URL[len("sqlite:////"):]
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MirrorMessage(Base):
    """One turn in a user's conversation with 小镜子."""

    __tablename__ = "mirror_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # 'user' | 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    # 小镜子在这条消息里推荐的真实书 id（来自书库），用于渲染可点书卡。多数消息为空。
    book_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 所属对话 id（多对话）。旧消息为空 = 归到该用户的默认对话。
    conversation_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)


class Conversation(Base):
    """一段独立的小镜子对话（用户可建多段、可分类、可重命名/删除）。"""

    __tablename__ = "mirror_conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), default="")
    project_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class MirrorProject(Base):
    """对话的分类「项目/文件夹」。"""

    __tablename__ = "mirror_projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)


class BookReview(Base):
    """读完一本书的「三合一」反馈：评分 + 书评 + 成长自评。

    核心理念：不是评价书好坏，而是记录「这本书有没有帮到这个人」。
    一个用户对一本书一条评价（可覆盖更新）。
    """

    __tablename__ = "book_reviews"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_review_user_book"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    book_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)          # 1-5 星
    difficulty: Mapped[str] = mapped_column(String(16), default="just_right")  # too_easy/just_right/too_hard
    emotions: Mapped[str] = mapped_column(Text, default="[]")             # JSON list[str] 情绪词条
    text: Mapped[str] = mapped_column(Text, default="")                   # 想说的心里话
    recommend_similar: Mapped[bool] = mapped_column(Boolean, default=True)  # 是否推荐给相似人格
    anonymous: Mapped[bool] = mapped_column(Boolean, default=False)       # 是否匿名展示
    mbti: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # 快照，给相似人格匹配用
    # 成长自评：{"expression": {"before": 40, "after": 72}, ...}（百分制，可选维度）
    growth: Mapped[str] = mapped_column(Text, default="{}")
    # 这本书帮自己解决了哪些问题：JSON list[str]（内耗/焦虑/拖延…）
    helped_problems: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class ReadingStatus(Base):
    """每本书的阅读状态 + 进度。读完(finished)才解锁三合一反馈。

    因为读书发生在别的 App（微信读书/番茄/Kindle 等，无法读取进度），
    所以由用户自报状态/进度；读完一键标记。
    """

    __tablename__ = "reading_status"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_reading_user_book"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    book_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="want")  # want / reading / finished
    current_page: Mapped[int] = mapped_column(Integer, default=0)
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class AccountProfile(Base):
    """账号档案同步：性别/星座/MBTI/用户名/职业等，按账号存，跨设备恢复。

    存为 JSON，字段跟前端 UserProfile 对齐（不含设备本地的头像 URI）。
    """

    __tablename__ = "account_profiles"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class MirrorProfile(Base):
    """A rolling psychological portrait distilled from the conversation."""

    __tablename__ = "mirror_profiles"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # JSON-encoded list[str]
    traits: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    keywords: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    # 增强记忆 JSON：{cares_about:[], mood_recent:"", reading_now:[], long_term:""}
    details: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class Follow(Base):
    """关注关系：follower 关注 followee。互相关注 = 朋友。"""

    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("follower_id", "followee_id", name="uq_follow"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    follower_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    followee_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)


class ProfileVisit(Base):
    """访客记录：visitor 看了 owner 的主页。一对(visitor,owner)只留最新一次。"""

    __tablename__ = "profile_visits"
    __table_args__ = (UniqueConstraint("visitor_id", "owner_id", name="uq_visit"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visitor_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    owner_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class UserFavorite(Base):
    """用户收藏的书（book_id）。前端收藏本地存全量 Book，这里只同步 id，
    供别人查看「ta 的收藏」。一对(user,book)唯一。"""

    __tablename__ = "user_favorites"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_user_favorite"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    book_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)


class UserHandle(Base):
    """用户可搜索的 ID（handle）。一个账号(user_id)绑定一个唯一 ID。
    系统先自动生成 9 位字母数字，用户可自定义修改。handle_lower 用于
    大小写无关的唯一性与搜索。"""

    __tablename__ = "user_handles"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    handle: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    handle_lower: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class User(Base):
    """A registered account. user_id doubles as the mirror conversation key."""

    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # phone is the login identity for now; null for social-only accounts later.
    phone: Mapped[Optional[str]] = mapped_column(String(32), unique=True, index=True, nullable=True)
    country_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # e.g. "+86"
    # social provider linkage (apple/google/wechat) — reserved for later.
    provider: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    provider_uid: Mapped[Optional[str]] = mapped_column(String(128), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    last_login: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)


class AuthToken(Base):
    """An opaque bearer token handed to a logged-in client."""

    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)


class PhoneOtp(Base):
    """A pending SMS verification code for a phone number."""

    __tablename__ = "phone_otps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # full E.164-ish identity: country_code + phone, e.g. "+8613800138000"
    phone_key: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(8), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)


def _ensure_columns() -> None:
    """轻量迁移：create_all 不会给已存在的表加新列。
    这里手动检查并补列，保证线上旧库平滑升级（幂等）。"""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    try:
        msg_cols = {c["name"] for c in inspector.get_columns("mirror_messages")}
        with engine.begin() as conn:
            if "book_id" not in msg_cols:
                conn.execute(text("ALTER TABLE mirror_messages ADD COLUMN book_id VARCHAR(64)"))
            if "conversation_id" not in msg_cols:
                conn.execute(text("ALTER TABLE mirror_messages ADD COLUMN conversation_id VARCHAR(64)"))
    except Exception:
        pass
    try:
        prof_cols = {c["name"] for c in inspector.get_columns("mirror_profiles")}
        if "details" not in prof_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE mirror_profiles ADD COLUMN details TEXT DEFAULT '{}'"))
    except Exception:
        pass


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
