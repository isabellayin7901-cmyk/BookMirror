import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter

from app.models import FeedbackRequest

router = APIRouter()
logger = logging.getLogger("bookmirror.feedback")

# First version: append-only JSONL file. Move to DB once we have accounts.
FEEDBACK_LOG = Path(__file__).parent.parent / "data" / "feedback.jsonl"


@router.post("/feedback")
def submit_feedback(payload: FeedbackRequest):
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        **payload.model_dump(),
    }
    FEEDBACK_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(FEEDBACK_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    logger.info("feedback recorded: book=%s reaction=%s", payload.book_id, payload.reaction)
    return {"status": "ok"}
