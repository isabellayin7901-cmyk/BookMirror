"""从 Standard Ebooks（standardebooks.org，全公版 CC0 精校 EPUB）批量导入。

合法可分发。爬公开书目页 → 下载每本 EPUB → 解析章节 → 入库。
用法：
  python scripts/ingest_standardebooks.py --api ... --token ... --limit 80
依赖：pip install httpx ebooklib beautifulsoup4 lxml
"""

import argparse
import re
import time

import httpx

from scripts.epub_ingest import epub_to_chapters, upload

BASE = "https://standardebooks.org"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"}


def _list_books(max_books: int) -> list[str]:
    """翻书目页，收集 /ebooks/作者/书 路径。"""
    paths: list[str] = []
    seen = set()
    page = 1
    while len(paths) < max_books and page <= 60:
        r = httpx.get(f"{BASE}/ebooks/?page={page}&per-page=48", timeout=60, follow_redirects=True, headers=UA)
        if r.status_code != 200:
            break
        found = re.findall(r'href="(/ebooks/[a-z0-9\-]+/[a-z0-9\-]+)"', r.text)
        new = [p for p in dict.fromkeys(found) if p not in seen]
        if not new:
            break
        for p in new:
            seen.add(p)
            paths.append(p)
        page += 1
        time.sleep(1)
    return paths[:max_books]


def _epub_url(book_path: str) -> str:
    # /ebooks/jane-austen/pride-and-prejudice → .../downloads/jane-austen_pride-and-prejudice.epub
    parts = book_path.strip("/").split("/")  # ['ebooks', author, title]
    author, title = parts[1], parts[2]
    return f"{BASE}{book_path}/downloads/{author}_{title}.epub"


def _book_id(book_path: str) -> str:
    parts = book_path.strip("/").split("/")
    bid = f"se_{parts[1]}_{parts[2]}".replace("-", "")
    return bid[:64]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="")
    ap.add_argument("--token", default="")
    ap.add_argument("--secret", default="")
    ap.add_argument("--limit", type=int, default=60)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    books = _list_books(args.limit)
    print(f"书目共收集 {len(books)} 本，开始下载解析…", flush=True)
    ok = 0
    for i, bp in enumerate(books):
        try:
            url = _epub_url(bp)
            r = httpx.get(url, timeout=120, follow_redirects=True, headers=UA)
            if r.status_code != 200 or len(r.content) < 5000:
                print(f"[{i+1}/{len(books)}] 下载失败 {bp} ({r.status_code})", flush=True)
                time.sleep(2)
                continue
            title, author, chapters = epub_to_chapters(bytes(r.content))
            n = sum(len(c["paras"]) for c in chapters)
            disp = f"{title}（{author}）" if author else title
            print(f"[{i+1}/{len(books)}] {disp}: {len(chapters)}章/{n}段", flush=True)
            if not args.dry and args.api and chapters:
                upload(args.api, args.token, args.secret, _book_id(bp), title, chapters)
            time.sleep(2)
        except Exception as e:
            print(f"[{i+1}/{len(books)}] 出错 {bp}: {type(e).__name__} {e}", flush=True)
            time.sleep(2)
    print("完成。", flush=True)


if __name__ == "__main__":
    main()
