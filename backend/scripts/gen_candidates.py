"""Step 1/3: generate real, well-known book-title candidates across all categories.

Run from backend/:  env -u ANTHROPIC_API_KEY python3.14 scripts/gen_candidates.py

Uses Claude to list real books (Chinese-market well-known titles + globally famous
foreign classics), balanced across the 7 categories. Dedups against the existing
seed library and against itself. Writes scripts/candidate_titles.json (resumable —
re-running tops up toward TARGET without losing prior candidates).
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anthropic import Anthropic
from app.config import settings

SEED = Path(__file__).resolve().parents[1] / "app" / "data" / "seed_books.json"
OUT = Path(__file__).resolve().parent / "candidate_titles.json"
TARGET = 1300  # over-generate; weread resolution + dedup will trim toward ~1000

CATEGORIES = ["novel", "non_fiction", "history", "psychology", "business", "philosophy", "biography"]

SYSTEM = (
    "You are a librarian with encyclopedic knowledge of books popular in the Chinese "
    "reading market (Douban / WeRead bestsellers and classics) as well as globally "
    "famous foreign works that have well-known Chinese translations. You only name "
    "REAL, published books — never invent titles. Return ONLY compact JSON."
)


def build_prompt(category, want, avoid):
    avoid_note = ""
    if avoid:
        # only send a sample of titles to avoid to keep the prompt small
        sample = avoid[:120]
        avoid_note = (
            "\n\nDo NOT include any of these already-collected titles:\n"
            + "、".join(sample)
        )
    return (
        f"List {want} REAL, well-known books in the category '{category}'. "
        "Mix Chinese-market bestsellers/classics with globally famous foreign works "
        "that have standard Chinese translations. Prefer books a thoughtful general "
        "reader would recognize. For each book give its common Chinese title and the "
        "author's name as commonly written in Chinese. "
        'Respond with a JSON array of {"title": "中文书名", "author": "作者", '
        f'"category": "{category}"}}. No duplicates.' + avoid_note
    )


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    return json.loads(text.strip())


def main():
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    existing = {b["title"].strip() for b in seed["books"]}

    have = []
    seen = set(existing)
    if OUT.exists():
        have = json.loads(OUT.read_text(encoding="utf-8"))
        seen |= {c["title"].strip() for c in have}
        print(f"resuming with {len(have)} existing candidates")

    client = Anthropic(api_key=settings.anthropic_api_key)
    ci = 0
    stale_rounds = 0
    while len(have) < TARGET and stale_rounds < 6:
        category = CATEGORIES[ci % len(CATEGORIES)]
        ci += 1
        before = len(have)
        resp = client.messages.create(
            model=settings.claude_model,
            max_tokens=4000,
            system=SYSTEM,
            messages=[{"role": "user", "content": build_prompt(category, 60, sorted(seen))}],
        )
        try:
            items = extract_json(resp.content[0].text)
        except Exception as e:
            print(f"  parse error ({category}): {e}")
            continue
        for it in items:
            title = (it.get("title") or "").strip()
            if not title or title in seen:
                continue
            seen.add(title)
            have.append(
                {
                    "title": title,
                    "author": (it.get("author") or "").strip(),
                    "category": it.get("category") or category,
                }
            )
        added = len(have) - before
        stale_rounds = stale_rounds + 1 if added == 0 else 0
        print(f"  [{category}] +{added} -> {len(have)}/{TARGET}")
        OUT.write_text(json.dumps(have, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(0.4)

    print(f"done. {len(have)} candidates in {OUT.name}")


if __name__ == "__main__":
    main()
