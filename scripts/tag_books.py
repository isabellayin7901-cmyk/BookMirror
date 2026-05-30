"""Batch-tag books for BookMirror seed library.

Pipeline:
  1. Read raw_books.txt — one book per line: `title|author|isbn?|language?`
  2. For each book, fetch metadata + cover from Google Books API.
  3. Ask Claude to tag it (mbti_fit, topics, problems_solved, etc.) using
     the canonical tag dictionaries.
  4. Write a unified seed_books.json compatible with backend/app/data/seed_books.json.

Usage:
  ANTHROPIC_API_KEY=sk-ant-... python tag_books.py \\
      --input raw_books.txt \\
      --output ../backend/app/data/seed_books.json

Tip: review the result and hand-fix the ~20% Claude gets wrong.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional

import httpx
from anthropic import Anthropic


# ---------- Canonical tag vocabulary (mirror of backend/app/data/tags.py) ----------

MBTI_TYPES = [
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
]
TOPICS = [
    "expression", "emotion", "career", "power", "relationship",
    "learning", "finance", "romance", "self_discipline", "philosophy", "creativity",
]
PROBLEMS = [
    "overthinking", "low_execution", "people_pleasing", "poor_expression",
    "idealism", "procrastination", "anxiety", "no_action",
    "low_confidence", "poor_boundary", "emotional_volatile",
]
CATEGORIES = [
    "novel", "non_fiction", "history", "psychology",
    "business", "philosophy", "biography",
]
STAGES = ["student", "early_career", "mid_career", "life_transition", "universal"]


# ---------- Google Books ----------

def fetch_google_books(query: str) -> Optional[dict[str, Any]]:
    url = "https://www.googleapis.com/books/v1/volumes"
    try:
        r = httpx.get(url, params={"q": query, "maxResults": 1}, timeout=10)
        r.raise_for_status()
        items = r.json().get("items", [])
        return items[0] if items else None
    except Exception as e:
        print(f"  google books error: {e}", file=sys.stderr)
        return None


def metadata_from_google(item: dict[str, Any]) -> dict[str, Any]:
    info = item.get("volumeInfo", {})
    isbn = ""
    for ident in info.get("industryIdentifiers", []):
        if ident.get("type") in ("ISBN_13", "ISBN_10"):
            isbn = ident.get("identifier", "")
            break
    return {
        "isbn": isbn,
        "cover_url": info.get("imageLinks", {}).get("thumbnail", "").replace("http://", "https://"),
        "description": info.get("description", ""),
    }


# ---------- Claude tagging ----------

TAG_TOOL = {
    "name": "tag_book",
    "description": "Return structured tags for a book",
    "input_schema": {
        "type": "object",
        "required": [
            "category", "difficulty", "mbti_fit", "topics",
            "problems_solved", "stage", "summary", "key_chapters",
        ],
        "properties": {
            "category": {"type": "string", "enum": CATEGORIES},
            "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
            "mbti_fit": {
                "type": "array",
                "items": {"type": "string", "enum": MBTI_TYPES},
                "description": "Up to 6 MBTI types this book especially resonates with. Empty array = universal.",
            },
            "topics": {
                "type": "array",
                "items": {"type": "string", "enum": TOPICS},
                "minItems": 1, "maxItems": 4,
            },
            "problems_solved": {
                "type": "array",
                "items": {"type": "string", "enum": PROBLEMS},
                "minItems": 1, "maxItems": 4,
            },
            "stage": {
                "type": "array",
                "items": {"type": "string", "enum": STAGES},
                "minItems": 1,
            },
            "summary": {"type": "string", "description": "≤ 50 字 / 30 words"},
            "key_chapters": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3, "maxItems": 3,
            },
        },
    },
}

SYSTEM = (
    "你是图书标签专家。给定书名、作者和简介，按 schema 输出标签。"
    "标签必须从给定枚举值中选择。summary 必须 50 字以内（中文书用中文，英文书用英文）。"
)


def tag_with_claude(
    client: Anthropic,
    model: str,
    title: str,
    author: str,
    description: str,
    language: str,
) -> dict[str, Any]:
    user = (
        f"书名：{title}\n"
        f"作者：{author}\n"
        f"语言：{language}\n"
        f"简介：{description[:1500] or '(无)'}\n\n"
        f"请调用 tag_book 工具返回标签。"
    )
    resp = client.messages.create(
        model=model,
        max_tokens=800,
        system=SYSTEM,
        tools=[TAG_TOOL],
        tool_choice={"type": "tool", "name": "tag_book"},
        messages=[{"role": "user", "content": user}],
    )
    for block in resp.content:
        if block.type == "tool_use" and block.name == "tag_book":
            return block.input
    raise RuntimeError("Claude did not call tag_book tool")


# ---------- Pipeline ----------

def parse_line(line: str) -> Optional[dict[str, str]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    parts = [p.strip() for p in line.split("|")]
    if len(parts) < 2:
        return None
    return {
        "title": parts[0],
        "author": parts[1],
        "isbn": parts[2] if len(parts) > 2 else "",
        "language": parts[3] if len(parts) > 3 else "zh",
    }


def process(input_path: Path, output_path: Path, model: str) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("ANTHROPIC_API_KEY not set")
    client = Anthropic(api_key=api_key)

    raw_lines = input_path.read_text(encoding="utf-8").splitlines()
    entries = [e for e in (parse_line(line) for line in raw_lines) if e]
    print(f"Processing {len(entries)} books…")

    books: list[dict[str, Any]] = []
    for i, entry in enumerate(entries, 1):
        bid = f"b{i:03d}"
        print(f"[{i}/{len(entries)}] {entry['title']} — {entry['author']}")

        query = f"isbn:{entry['isbn']}" if entry["isbn"] else f"{entry['title']} {entry['author']}"
        gb = fetch_google_books(query)
        meta = metadata_from_google(gb) if gb else {"isbn": entry["isbn"], "cover_url": "", "description": ""}

        try:
            tags = tag_with_claude(
                client, model,
                title=entry["title"], author=entry["author"],
                description=meta["description"], language=entry["language"],
            )
        except Exception as e:
            print(f"  ⚠ tagging failed: {e}", file=sys.stderr)
            continue

        books.append({
            "id": bid,
            "title": entry["title"],
            "author": entry["author"],
            "isbn": meta["isbn"] or entry["isbn"],
            "cover_url": meta["cover_url"],
            "language": entry["language"],
            **tags,
            "purchase_links": {},
        })
        time.sleep(0.3)  # be polite to APIs

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "_schema_version": "0.1.0",
                "_note": "Generated by scripts/tag_books.py — review before shipping.",
                "books": books,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n✔ Wrote {len(books)} books to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch-tag books for BookMirror")
    parser.add_argument("--input", required=True, type=Path, help="raw_books.txt path")
    parser.add_argument("--output", required=True, type=Path, help="seed_books.json output path")
    parser.add_argument("--model", default="claude-haiku-4-5-20251001")
    args = parser.parse_args()
    process(args.input, args.output, args.model)


if __name__ == "__main__":
    main()
