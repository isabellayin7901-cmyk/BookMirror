"""Step 3/3: enrich resolved weread books into full bilingual seed entries.

Run from backend/:  env -u ANTHROPIC_API_KEY python3.14 scripts/enrich_books.py

Takes scripts/resolved_books.json (real title/author/intro/cover/buy-link) and asks
Claude, in batches, to produce the tag metadata (category/difficulty/mbti_fit/topics/
problems_solved/stage/key_chapters), a concise zh summary, and all English fields.
Assigns new IDs continuing from the current max, appends to seed_books.json.

Idempotent: books already appended (matched by weread bookId) are skipped.
"""
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from anthropic import Anthropic
from app.config import settings
from app.data.tags import CATEGORIES, MBTI_TYPES, PROBLEMS, STAGES, TOPICS

ROOT = Path(__file__).resolve().parents[1]
RESOLVED = Path(__file__).resolve().parent / "resolved_books.json"
SEED = ROOT / "app" / "data" / "seed_books.json"
BATCH = 10

SYSTEM = (
    "You are a bilingual (Chinese/English) book-metadata editor for a reading-"
    "recommendation app. For each real book you receive (Chinese title, author, and "
    "publisher intro), produce structured tags drawn ONLY from the allowed vocabularies, "
    "plus a concise one-line Chinese summary, 3 key chapters/themes, and fluent English "
    "translations. Be accurate to the actual book; never invent facts. "
    "Return ONLY compact JSON, no prose."
)


def build_prompt(batch):
    items = [
        {
            "id": b["_tmpid"],
            "title": b["title"],
            "author": b["author"],
            "intro": (b.get("intro") or "")[:600],
            "hint_category": b.get("candidate_category", ""),
        }
        for b in batch
    ]
    return (
        "For each book, return a JSON object mapping id -> {\n"
        f'  "category": one of {CATEGORIES},\n'
        '  "difficulty": integer 1-5 (1=easy/popular, 5=dense/academic),\n'
        f'  "mbti_fit": 2-4 of {MBTI_TYPES} (types most drawn to this book),\n'
        f'  "topics": 1-3 of {TOPICS},\n'
        f'  "problems_solved": 1-4 of {PROBLEMS},\n'
        f'  "stage": 1-2 of {STAGES} (use "universal" if broadly applicable),\n'
        '  "summary": "一句话中文简介（不超过40字，基于真实内容）",\n'
        '  "key_chapters": ["中文主题1","主题2","主题3"],\n'
        '  "title_en": "natural English title (official translation if it exists)",\n'
        '  "author_en": "author name in English/pinyin",\n'
        '  "summary_en": "one concise natural English blurb sentence",\n'
        '  "key_chapters_en": ["theme1","theme2","theme3"]  (same count/order as key_chapters)\n'
        "}\n"
        "Use only the allowed values exactly as written. Respond with the JSON object only.\n\n"
        + json.dumps(items, ensure_ascii=False, indent=2)
    )


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    return json.loads(text.strip())


def clean_list(vals, allowed, lo=1, hi=4):
    out = [v for v in (vals or []) if v in allowed]
    return out[:hi] if out else []


def main():
    if not RESOLVED.exists():
        print("no resolved_books.json — run resolve_weread.py first")
        return
    resolved = json.loads(RESOLVED.read_text(encoding="utf-8"))
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    books = seed["books"]

    have_bookids = {
        b.get("purchase_links", {}).get("weread", "").rsplit("/", 1)[-1]
        for b in books
    }
    # map resolved -> its encoded tail to dedup against already-appended
    todo = []
    for r in resolved:
        tail = r["weread"].rsplit("/", 1)[-1]
        if tail in have_bookids:
            continue
        todo.append(r)
    print(f"{len(todo)} resolved books to enrich ({len(books)} already in seed)")
    if not todo:
        return

    max_id = max(int(re.sub(r"\D", "", b["id"]) or 0) for b in books)
    client = Anthropic(api_key=settings.anthropic_api_key)

    next_id = max_id + 1
    added = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        for b in batch:
            b["_tmpid"] = f"t{i}_{batch.index(b)}"
        try:
            resp = client.messages.create(
                model=settings.claude_model,
                max_tokens=6000,
                system=SYSTEM,
                messages=[{"role": "user", "content": build_prompt(batch)}],
            )
            parsed = extract_json(resp.content[0].text)
        except Exception as e:
            print(f"  batch {i} error: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(1.0)
            continue

        # Claude sometimes returns a list instead of an {id: {...}} object.
        if isinstance(parsed, list):
            mapping = {}
            for pos, item in enumerate(parsed):
                if not isinstance(item, dict):
                    continue
                key = item.get("id") or (batch[pos]["_tmpid"] if pos < len(batch) else None)
                if key:
                    mapping[key] = item
        elif isinstance(parsed, dict):
            mapping = parsed
        else:
            print(f"  batch {i}: unexpected JSON type {type(parsed).__name__}, skipping")
            continue

        for b in batch:
            m = mapping.get(b["_tmpid"])
            if not m:
                continue
            cat = m.get("category") if m.get("category") in CATEGORIES else (
                b.get("candidate_category") if b.get("candidate_category") in CATEGORIES else "non_fiction"
            )
            diff = m.get("difficulty")
            diff = diff if isinstance(diff, int) and 1 <= diff <= 5 else 2
            kc = [str(x).strip() for x in (m.get("key_chapters") or []) if str(x).strip()][:3]
            kce = [str(x).strip() for x in (m.get("key_chapters_en") or []) if str(x).strip()][:3]
            book = {
                "id": f"book_{next_id:03d}",
                "title": b["title"],
                "author": b["author"],
                "language": "zh",
                "category": cat,
                "difficulty": diff,
                "mbti_fit": clean_list(m.get("mbti_fit"), MBTI_TYPES, hi=4) or ["INFP", "INTJ"],
                "topics": clean_list(m.get("topics"), TOPICS, hi=3) or ["philosophy"],
                "problems_solved": clean_list(m.get("problems_solved"), PROBLEMS, hi=4) or ["overthinking"],
                "stage": clean_list(m.get("stage"), STAGES, hi=2) or ["universal"],
                "summary": (m.get("summary") or b.get("intro", "")[:40]).strip(),
                "key_chapters": kc,
                "purchase_links": {"weread": b["weread"]},
                "cover_url": b.get("cover", ""),
                "title_en": (m.get("title_en") or "").strip(),
                "author_en": (m.get("author_en") or "").strip(),
                "summary_en": (m.get("summary_en") or "").strip(),
                "key_chapters_en": kce,
            }
            books.append(book)
            next_id += 1
            added += 1

        seed["books"] = books
        SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  appended {added} (now {len(books)} total)")
        time.sleep(0.4)

    print(f"done. added {added} books -> {len(books)} total")


if __name__ == "__main__":
    main()
