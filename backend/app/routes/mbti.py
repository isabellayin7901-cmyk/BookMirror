from fastapi import APIRouter, HTTPException

from app.models import MbtiInferenceRequest, MbtiInferenceResponse
from app.services import claude as claude_service

router = APIRouter()


@router.post("/mbti", response_model=MbtiInferenceResponse)
def infer(payload: MbtiInferenceRequest):
    if not payload.answers:
        raise HTTPException(status_code=400, detail="answers must not be empty")
    try:
        raw = claude_service.infer_mbti(
            [a.model_dump() for a in payload.answers],
            language=payload.language,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude error: {e}")
    return MbtiInferenceResponse(**raw)
