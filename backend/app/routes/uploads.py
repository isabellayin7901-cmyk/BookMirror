"""图片上传：客户端传 base64，存到（持久化）磁盘，返回相对地址 /uploads/xxx。

聊天图片、将来的头像都可以走这里。/uploads 由 main.py 用 StaticFiles 挂载对外提供。
"""

import os
import base64
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


def _upload_dir() -> str:
    env = os.getenv("UPLOAD_DIR", "").strip()
    if env:
        d = env
    else:
        url = os.getenv("DATABASE_URL", "").strip()
        if url.startswith("sqlite:////"):
            base = os.path.dirname("/" + url[len("sqlite:////"):])
        else:
            base = os.path.join(os.getcwd(), "data")
        d = os.path.join(base, "uploads")
    os.makedirs(d, exist_ok=True)
    return d


UPLOAD_DIR = _upload_dir()

_EXT = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
_MAX_BYTES = 8 * 1024 * 1024  # 8MB

router = APIRouter()


class UploadIn(BaseModel):
    data: str = Field(..., min_length=4)          # base64（不含 data: 前缀）
    media_type: str = Field(default="image/jpeg")


class UploadOut(BaseModel):
    url: str


@router.post("/upload", response_model=UploadOut)
def upload_image(payload: UploadIn):
    ext = _EXT.get(payload.media_type.lower())
    if not ext:
        raise HTTPException(status_code=400, detail="不支持的图片类型")
    try:
        raw = base64.b64decode(payload.data, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="图片数据无效")
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="图片太大了，换张小一点的")
    name = f"{secrets.token_hex(16)}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
        f.write(raw)
    return UploadOut(url=f"/uploads/{name}")
