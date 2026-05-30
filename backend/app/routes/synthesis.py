from fastapi import APIRouter, HTTPException

from app.models import SynthesisProfile, SynthesisRequest
from app.services import claude as claude_service

router = APIRouter()


@router.post("/synthesis", response_model=SynthesisProfile)
def synthesize(payload: SynthesisRequest):
    """Fuse the user's MBTI and zodiac into one combined persona portrait."""
    try:
        raw = claude_service.infer_synthesis(
            mbti=payload.mbti,
            sun_sign=payload.sun_sign,
            element=payload.element,
            moon_sign=payload.moon_sign,
            rising_sign=payload.rising_sign,
            language=payload.language,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Synthesis error: {e}")
    return SynthesisProfile(**raw)
