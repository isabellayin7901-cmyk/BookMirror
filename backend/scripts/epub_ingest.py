"""EPUB → 章节/段落 → 入库。用于公版 EPUB 或用户自有授权 EPUB。

用法（单个本地文件）：
  python scripts/epub_ingest.py book.epub --book-id mybook --title "书名" --api ... --token ...
依赖：pip install ebooklib beautifulsoup4 lxml httpx
"""

import argparse
import io
import re

import httpx
from bs4 import BeautifulSoup
from ebooklib import epub, ITEM_DOCUMENT

# 跳过的非正文文件（封面/版权/题献等）
_SKIP = re.compile(r"(titlepage|imprint|colophon|uncopyright|halftitle|cover|toc|loi|endnotes|copyright)", re.I)


def epub_to_chapters(path_or_bytes) -> tuple[str, str, list[dict]]:
    """返回 (标题, 作者, 章节列表)。章节列表 = [{index,title,paras}]。"""
    if isinstance(path_or_bytes, (bytes, bytearray)):
        # ebooklib 只吃文件路径，落临时文件
        import tempfile, os
        fd, tmp = tempfile.mkstemp(suffix=".epub")
        os.write(fd, path_or_bytes); os.close(fd)
        try:
            book = epub.read_epub(tmp)
        finally:
            os.remove(tmp)
    else:
        book = epub.read_epub(path_or_bytes)

    meta_t = book.get_metadata("DC", "title")
    meta_a = book.get_metadata("DC", "creator")
    title = meta_t[0][0] if meta_t else ""
    author = meta_a[0][0] if meta_a else ""

    id_to_item = {it.get_id(): it for it in book.get_items()}
    chapters: list[dict] = []
    for spine_id, _ in book.spine:
        item = id_to_item.get(spine_id)
        if item is None or item.get_type() != ITEM_DOCUMENT:
            continue
        name = item.get_name() or ""
        if _SKIP.search(name):
            continue
        soup = BeautifulSoup(item.get_content(), "lxml")
        for tag in soup(["script", "style"]):
            tag.decompose()
        h = soup.find(["h1", "h2", "h3"])
        ch_title = h.get_text(" ", strip=True) if h else ""
        paras = []
        for p in soup.find_all("p"):
            t = p.get_text(" ", strip=True)
            if t:
                paras.append(t)
        if not paras:
            continue
        chapters.append({"index": len(chapters), "title": ch_title or f"第 {len(chapters) + 1} 章", "paras": paras})
    return title, author, chapters


def upload(api, token, secret, book_id, title, chapters):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-App-Token"] = token
    n = sum(len(c["paras"]) for c in chapters)
    r = httpx.post(
        f"{api.rstrip('/')}/api/reader/ingest",
        json={"book_id": book_id, "title": title, "data": {"chapters": chapters}, "secret": secret},
        headers=headers, timeout=180,
    )
    print(f"  上传 {book_id}「{title}」 {len(chapters)}章/{n}段 → {r.status_code} {r.text[:120]}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("epub")
    ap.add_argument("--book-id", required=True)
    ap.add_argument("--title", default="")
    ap.add_argument("--api", default="")
    ap.add_argument("--token", default="")
    ap.add_argument("--secret", default="")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    title, author, chapters = epub_to_chapters(args.epub)
    title = args.title or title
    n = sum(len(c["paras"]) for c in chapters)
    print(f"《{title}》 {author}：{len(chapters)} 章 / {n} 段")
    for c in chapters[:6]:
        print(f"  [{c['index']}] {c['title']} ({len(c['paras'])}段)")
    if args.dry or not args.api:
        return
    upload(args.api, args.token, args.secret, args.book_id, title, chapters)


if __name__ == "__main__":
    main()
