"""One-off: fill summary_en / key_chapters_en for every seed book via Claude.

Run from backend/:  env -u ANTHROPIC_API_KEY python3.14 scripts/translate_summaries.py
Idempotent — only books missing summary_en are sent. Writes back in place.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anthropic import Anthropic
from app.config import settings

SEED = Path(__file__).resolve().parents[1] / "app" / "data" / "seed_books.json"
BATCH = 12

SYSTEM = (
    "You translate Chinese book metadata into fluent, natural English. You receive "
    "a book's one-line summary and a list of key-chapter/theme labels. Translate the "
    "summary into one concise, natural English sentence (keep it short, like a book "
    "blurb), and translate each chapter/theme label into a short English phrase. "
    "Do NOT transliterate — produce idiomatic English. Return ONLY compact JSON, no prose."
)


def build_prompt(batch):
    items = [
        {"id": b["id"], "summary": b["summary"], "key_chapters": b.get("key_chapters", [])}
        for b in batch
    ]
    return (
        "Translate each book's summary and key_chapters into English. Respond with a "
        'JSON object mapping id -> {"summary_en": "...", "key_chapters_en": ["...", ...]}. '
        "key_chapters_en must have the same number of items, in the same order.\n\n"
        + json.dumps(items, ensure_ascii=False, indent=2)
    )


def main():
    data = json.loads(SEED.read_text(encoding="utf-8"))
    books = data["books"]
    by_id = {b["id"]: b for b in books}
    todo = [b for b in books if not b.get("summary_en")]
    print(f"{len(todo)}/{len(books)} books need summary translation")
    if not todo:
        return

    client = Anthropic(api_key=settings.anthropic_api_key)
    done = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        resp = client.messages.create(
            model=settings.claude_model,
            max_tokens=4000,
            system=SYSTEM,
            messages=[{"role": "user", "content": build_prompt(batch)}],
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip()
        mapping = json.loads(text)
        for bid, vals in mapping.items():
            if bid in by_id:
                by_id[bid]["summary_en"] = (vals.get("summary_en") or "").strip()
                by_id[bid]["key_chapters_en"] = [
                    (c or "").strip() for c in (vals.get("key_chapters_en") or [])
                ]
        done += len(batch)
        print(f"  translated {done}/{len(todo)}")
        SEED.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        time.sleep(0.5)

    missing = [b["id"] for b in books if not b.get("summary_en")]
    print(f"done. still missing: {len(missing)}")


if __name__ == "__main__":
    main()
