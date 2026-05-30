from fastapi import APIRouter, HTTPException

from app.models import (
    UserProfile,
    RecommendationResponse,
    ProfileCard,
    BookRecommendation,
)
from app.services import claude as claude_service
from app.services.book_filter import shortlist_candidates

router = APIRouter()


@router.post("/recommend", response_model=RecommendationResponse)
def recommend(profile: UserProfile):
    # 扩大候选池到 40 本：5 给 Claude 精选 + 35 留给主页"更多好书"
    candidates = shortlist_candidates(profile, limit=40)
    if not candidates:
        raise HTTPException(
            status_code=503,
            detail="Book library is empty. Add books to backend/app/data/seed_books.json.",
        )

    # Claude 只看前 20 本（避免上下文过大）
    claude_candidates = candidates[:20]
    try:
        raw = claude_service.generate_recommendation(profile, claude_candidates)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude error: {e}")

    candidate_map = {b.id: b for b in candidates}
    recs_raw = raw.get("recommendations", [])

    valid_recs = [r for r in recs_raw if r["book_id"] in candidate_map]
    valid_recs.sort(key=lambda r: r["order"])

    # 如果 Claude 没返够 6 本，从候选池里拿评分最高的补齐
    selected_ids = {r["book_id"] for r in valid_recs}
    if len(valid_recs) < 6:
        extras_needed = 6 - len(valid_recs)
        next_order = max((r["order"] for r in valid_recs), default=0) + 1
        for b in candidates[:20]:
            if b.id in selected_ids:
                continue
            valid_recs.append({
                "book_id": b.id,
                "order": next_order,
                "why_for_you": "评分匹配度高的好书，根据你的画像精选。",
                "key_focus": b.key_chapters[:3] if b.key_chapters else ["核心章节 1", "核心章节 2", "核心章节 3"],
            })
            selected_ids.add(b.id)
            next_order += 1
            if len(valid_recs) >= 6:
                break

    books = [candidate_map[r["book_id"]] for r in valid_recs]
    more_books = [b for b in candidates if b.id not in selected_ids]

    return RecommendationResponse(
        profile=ProfileCard(**raw["profile"]),
        growth_gaps=raw["growth_gaps"],
        recommendations=[BookRecommendation(**r) for r in valid_recs],
        books=books,
        more_books=more_books,
    )
