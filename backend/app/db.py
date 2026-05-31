"""SQLAlchemy persistence for the 小镜子 (Little Mirror) chat.

Storage is configurable via DATABASE_URL. Defaults to a local SQLite file.
On Render, mount a persistent disk and point DATABASE_URL at it
(e.g. sqlite:////data/mirror.db) so conversations survive redeploys.
Swappable to Postgres later by changing DATABASE_URL only.
"""

import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Text, Integer, DateTime, create_engine
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


class MirrorProfile(Base):
    """A rolling psychological portrait distilled from the conversation."""

    __tablename__ = "mirror_profiles"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # JSON-encoded list[str]
    traits: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    keywords: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
