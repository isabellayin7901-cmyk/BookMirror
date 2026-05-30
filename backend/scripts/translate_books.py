"""One-off: fill title_en / author_en for every seed book via Claude.

Run from backend/:  python3.14 scripts/translate_books.py
Idempotent — only books missing title_en are sent. Writes back in place.
"""
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anthropic import Anthropic
from app.config import settings

SEED = Path(__file__).resolve().parents[1] / "app" / "data" / "seed_books.json"
BATCH = 25

SYSTEM = (
    "You translate Chinese book titles and author names into their canonical "
    "English form. For foreign works translated into Chinese, return the ORIGINAL "
    "English title and the author's name in its native Latin spelling. For "
    "Chinese-original works, give the standard published English title (or a "
    "faithful translation) and the author's name in pinyin (Given-name order, "
    "e.g. 'Yu Hua'). Return ONLY compact JSON, no prose."
)


def build_prompt(batch):
    lines = [f'{b["id"]}\t{b["title"]}\t{b["author"]}' for b in batch]
    return (
        "Translate each line (id<TAB>title<TAB>author). Respond with a JSON object "
        'mapping id -> {"title_en": "...", "author_en": "..."}.\n\n'
        + "\n".join(lines)
    )


def main():
    data = json.loads(SEED.read_text(encoding="utf-8"))
    books = data["books"]
    by_id = {b["id"]: b for b in books}
    todo = [b for b in books if not b.get("title_en")]
    print(f"{len(todo)}/{len(books)} books need translation")
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
                by_id[bid]["title_en"] = vals.get("title_en", "").strip()
                by_id[bid]["author_en"] = vals.get("author_en", "").strip()
        done += len(batch)
        print(f"  translated {done}/{len(todo)}")
        SEED.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        time.sleep(0.5)

    missing = [b["id"] for b in books if not b.get("title_en")]
    print(f"done. still missing: {len(missing)}")


if __name__ == "__main__":
    main()
