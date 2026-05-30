"""Step 2/3: resolve candidate titles to REAL weread data (no fabricated URLs).

Run from backend/:  python3.14 scripts/resolve_weread.py

For each candidate title, queries the public weread search API and keeps the best
title match. Extracts the real bookId, cover image URL, author and intro, and
encodes the real bookDetail purchase link (algorithm validated against the existing
library). Books not found on weread, or whose best match is too dissimilar, are
skipped — so every resolved book has a genuine cover + buy link.

Resumable: checkpoints to scripts/resolved_books.json after every hit.
"""
import json
import re
import ssl
import sys
import time
import socket
import hashlib
import urllib.parse
import urllib.request
from pathlib import Path
from difflib import SequenceMatcher

ROOT = Path(__file__).resolve().parents[1]
CAND = Path(__file__).resolve().parent / "candidate_titles.json"
OUT = Path(__file__).resolve().parent / "resolved_books.json"
SEED = ROOT / "app" / "data" / "seed_books.json"

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE
socket.setdefaulttimeout(15)


def encode_book_id(book_id: str) -> str:
    """WeRead bookId -> bookDetail hash. Validated: 35551088 -> 66832530721e777066806c9."""
    book_id = str(book_id)
    h = hashlib.md5(book_id.encode()).hexdigest()
    pre = h[0:3]
    if book_id.isdigit():
        ary = [format(int(book_id[i : i + 9]), "x") for i in range(0, len(book_id), 9)]
        fmt = "3"
    else:
        fmt = "4"
        ary = ["".join(format(ord(c), "x") for c in book_id)]
    s = pre + fmt + "2" + h[-2:]
    for i, a in enumerate(ary):
        la = format(len(a), "x")
        la = "0" + la if len(la) == 1 else la
        s += la + a
        if i < len(ary) - 1:
            s += "g"
    if len(s) < 20:
        s += h[0 : 20 - len(s)]
    s += hashlib.md5(s.encode()).hexdigest()[0:3]
    return s


def norm(t: str) -> str:
    return re.sub(r"[\s（）()【】\[\]：:·、,，.。!！?？\"'’“”]", "", t or "").lower()


def search(q: str):
    url = (
        "https://weread.qq.com/web/search/global?keyword="
        + urllib.parse.quote(q)
        + "&maxIdx=0&fragmentSize=120&count=5"
    )
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh)", "Referer": "https://weread.qq.com/"},
    )
    raw = urllib.request.urlopen(req, context=_ctx).read().decode()
    return json.loads(raw).get("books", [])


def best_match(title: str, books):
    nt = norm(title)
    best, best_score = None, 0.0
    for entry in books:
        bi = entry.get("bookInfo", {})
        cand = norm(bi.get("title", ""))
        if not cand:
            continue
        score = SequenceMatcher(None, nt, cand).ratio()
        if nt and (nt in cand or cand in nt):
            score = max(score, 0.9)
        if score > best_score:
            best, best_score = bi, score
    return best, best_score


def main():
    if not CAND.exists():
        print("no candidate_titles.json yet — run gen_candidates.py first")
        return
    candidates = json.loads(CAND.read_text(encoding="utf-8"))
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    existing_titles = {norm(b["title"]) for b in seed["books"]}

    resolved = []
    done_titles = set(existing_titles)
    done_bookids = {
        (b.get("purchase_links", {}).get("weread") or "") for b in seed["books"]
    }
    if OUT.exists():
        resolved = json.loads(OUT.read_text(encoding="utf-8"))
        done_titles |= {norm(r["title"]) for r in resolved}
        done_bookids |= {r["bookId"] for r in resolved}
        print(f"resuming with {len(resolved)} resolved")

    hits = 0
    for idx, c in enumerate(candidates):
        title = c["title"].strip()
        if norm(title) in done_titles:
            continue
        try:
            books = search(title)
        except Exception as e:
            print(f"  search err '{title}': {type(e).__name__}")
            time.sleep(1.0)
            continue
        bi, score = best_match(title, books)
        if not bi or score < 0.62:
            done_titles.add(norm(title))
            continue
        bid = str(bi.get("bookId", ""))
        if not bid or bid in done_bookids or norm(bi.get("title", "")) in done_titles:
            done_titles.add(norm(title))
            continue
        resolved.append(
            {
                "candidate_title": title,
                "candidate_category": c.get("category", ""),
                "title": bi.get("title", title).strip(),
                "author": (bi.get("author") or c.get("author") or "").strip(),
                "intro": (bi.get("intro") or "").strip(),
                "cover": (bi.get("cover") or "").replace("/s_", "/t9_"),
                "bookId": bid,
                "weread": "https://weread.qq.com/web/bookDetail/" + encode_book_id(bid),
            }
        )
        done_titles.add(norm(title))
        done_titles.add(norm(bi.get("title", "")))
        done_bookids.add(bid)
        hits += 1
        if hits % 10 == 0:
            OUT.write_text(json.dumps(resolved, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  resolved {hits} new (scanned {idx + 1}/{len(candidates)})")
        time.sleep(0.3)

    OUT.write_text(json.dumps(resolved, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done. {len(resolved)} total resolved in {OUT.name}")


if __name__ == "__main__":
    main()
