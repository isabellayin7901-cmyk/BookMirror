from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models import ZodiacReading
from app.services import claude as claude_service

router = APIRouter()


class AstrologyRequest(BaseModel):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    day: int = Field(ge=1, le=31)
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59, default=0)
    # 可选：出生地经纬度，用于精确算上升星座
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    language: str = "zh"


@router.post("/astrology", response_model=ZodiacReading)
def analyze(payload: AstrologyRequest):
    try:
        raw = claude_service.infer_zodiac(
            payload.year, payload.month, payload.day,
            payload.hour, payload.minute,
            latitude=payload.latitude,
            longitude=payload.longitude,
            language=payload.language,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Astrology error: {e}")
    return ZodiacReading(**raw)
