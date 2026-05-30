from fastapi import APIRouter, HTTPException

from app.models import BookFitRequest, BookFitResponse
from app.services import claude as claude_service

router = APIRouter()


@router.post("/book-fit", response_model=BookFitResponse)
def book_fit(payload: BookFitRequest):
    """Explain why ONE specific book fits THIS user (MBTI × zodiac × needs)."""
    try:
        raw = claude_service.infer_book_fit(
            book_title=payload.book_title,
            book_author=payload.book_author,
            book_summary=payload.book_summary,
            book_topics=payload.book_topics,
            book_category=payload.book_category,
            book_difficulty=payload.book_difficulty,
            mbti=payload.mbti,
            sun_sign=payload.sun_sign,
            moon_sign=payload.moon_sign,
            rising_sign=payload.rising_sign,
            element=payload.element,
            goals=payload.goals,
            problems=payload.problems,
            preferences=payload.preferences,
            free_text=payload.free_text,
            language=payload.language,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Book fit error: {e}")
    return BookFitResponse(**raw)
