"""
用微信读书公开 web 搜索接口，为 seed_books.json 里每本书补 weread 直链。

数据源：https://weread.qq.com/web/search/global?keyword=书名
  返回 JSON，含 bookId / title / author / cover。

写入：
  - purchase_links["weread"] = https://weread.qq.com/web/bookDetail/{hash}
    （bookId → 书页 hash 用微信读书通用算法转换）
  - cover_url（仅当原来为空时补上）

特性：
  - 断点续传：每本书处理完立刻存盘，已有 weread 链接的跳过
  - 严格匹配：书名归一化相等/包含 + 作者重叠，避免配错书
  - 礼貌延迟 + 限流退避

用法：
  python3 scripts/fetch_weread_ids.py
"""

from __future__ import annotations

import hashlib
import json
import random
import re
import time
from pathlib import Path

import httpx

SEED_PATH = Path(__file__).parent.parent / "backend" / "app" / "data" / "seed_books.json"
SEARCH_URL = "https://weread.qq.com/web/search/global"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"


def weread_url_hash(book_id: str) -> str:
    """微信读书通用 bookId → 书页 hash 算法。"""
    s = str(book_id)
    h = hashlib.md5(s.encode()).hexdigest()
    f, j = h[:3], h[-2:]
    if s.isdigit():
        chunks = [format(int(s[i:i + 9]), "x") for i in range(0, len(s), 9)]
        arr = ("3", chunks)
    else:
        hexstr = "".join(format(ord(c), "x") for c in s)
        arr = ("4", [hexstr])
    res = f + arr[0] + "2" + j
    parts = arr[1]
    for i, sub in enumerate(parts):
        lh = format(len(sub), "x")
        if len(lh) == 1:
            lh = "0" + lh
        res += lh + sub
        if i < len(parts) - 1:
            res += "g"
    if len(res) < 20:
        res += h[:20 - len(res)]
    res += hashlib.md5(res.encode()).hexdigest()[:3]
    return res


def norm(s: str) -> str:
    return re.sub(r"[\s（）()【】《》「」\[\]:：·\-—,，。、！？!?\"'’“”]", "", (s or "")).lower()


def best_match(title: str, author: str, candidates: list[dict]) -> dict | None:
    nt, na = norm(title), norm(author)
    first_author = norm((author or "").split("、")[0].split(",")[0].split("，")[0])
    for bi in candidates:
        rt, ra = norm(bi.get("title")), norm(bi.get("author"))
        if not rt:
            continue
        title_ok = rt == nt or (nt and nt in rt) or (rt and rt in nt and len(rt) >= 2)
        if not title_ok:
            continue
        author_ok = (
            not first_author
            or first_author in ra
            or ra in first_author
            or (len(first_author) >= 2 and first_author[:2] in ra)
        )
        if author_ok:
            return bi
    return None


def search(client: httpx.Client, keyword: str) -> list[dict]:
    for attempt in range(4):
        try:
            r = client.get(SEARCH_URL, params={"keyword": keyword, "maxIdx": 0, "fragmentSize": 1, "count": 5})
            if r.status_code == 200:
                return [b.get("bookInfo", {}) for b in r.json().get("books", [])]
            # 限流/异常 → 退避
            time.sleep(5 + attempt * 5 + random.uniform(0, 3))
        except Exception:
            time.sleep(3 + attempt * 3)
    return []


def main() -> None:
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    books = data["books"]
    total = len(books)
    found = skipped = missed = 0
    print(f"📚 共 {total} 本；开始补微信读书直链\n")

    with httpx.Client(headers={"User-Agent": UA, "Referer": "https://weread.qq.com/"},
                      timeout=20, follow_redirects=True) as client:
        for i, book in enumerate(books, 1):
            links = book.setdefault("purchase_links", {})
            title = book["title"]
            author = book.get("author", "")

            if links.get("weread"):
                skipped += 1
                continue

            cands = search(client, title)
            match = best_match(title, author, cands)
            if match and match.get("bookId"):
                url = f"https://weread.qq.com/web/bookDetail/{weread_url_hash(match['bookId'])}"
                links["weread"] = url
                if not book.get("cover_url") and match.get("cover"):
                    book["cover_url"] = match["cover"].replace("/s_", "/t9_")
                found += 1
                tag = f"weread={match['bookId']}"
            else:
                missed += 1
                tag = "×"

            print(f"[{i:3}/{total}] {title[:20]:20} {tag}")
            SEED_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(random.uniform(0.8, 1.8))

    print(f"\n=== 完成 ===  找到 {found}  跳过 {skipped}  未匹配 {missed}")


if __name__ == "__main__":
    main()
