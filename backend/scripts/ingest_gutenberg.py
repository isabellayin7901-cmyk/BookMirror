"""从 Project Gutenberg（公有领域）下载纯文本书 → 章节/段落 → 入库。

公版书，合法可分发。中文多为繁体，用 OpenCC 转简体。
用法：
  python scripts/ingest_gutenberg.py --api https://bookmirror-api.onrender.com --token <X-App-Token> [--only 24264]
依赖（本地）：pip install httpx opencc-python-reimplemented
"""

import argparse
import re
import sys
import time

import httpx

from scripts.ingest_pdf import _paragraphs, chapterize

# (gutenberg_id, book_id, 标题, 是否繁→简)
BOOKS = [
    # 中文经典（繁→简）
    (24264, "gb_hongloumeng", "红楼梦", True),
    (23863, "gb_shuihu", "水浒传", True),
    (23962, "gb_xiyouji", "西游记", True),
    (23950, "gb_sanguo", "三国演义", True),
    (23839, "gb_lunyu", "论语", True),
    (7337, "gb_daodejing", "道德经", True),
    (24178, "gb_mengzi", "孟子", True),
    (23913, "gb_zhuangzi", "庄子的故事", True),
    (51828, "gb_liaozhai", "聊斋志异", True),
    (24032, "gb_rulin", "儒林外史", True),
    (24226, "gb_shiji", "史记", True),
    (23873, "gb_shijing", "诗经", True),
    (24169, "gb_libai", "李太白集", True),
    # 外文经典（英文原文）
    (1342, "gb_pride", "Pride and Prejudice", False),
    (84, "gb_frankenstein", "Frankenstein", False),
    (345, "gb_dracula", "Dracula", False),
    (1661, "gb_sherlock", "The Adventures of Sherlock Holmes", False),
    (11, "gb_alice", "Alice's Adventures in Wonderland", False),
    (98, "gb_twocities", "A Tale of Two Cities", False),
    (1260, "gb_janeeyre", "Jane Eyre", False),
    (768, "gb_wuthering", "Wuthering Heights", False),
    (2701, "gb_mobydick", "Moby Dick", False),
    (1232, "gb_prince", "The Prince", False),
    (2680, "gb_meditations", "Meditations", False),
    (132, "gb_artofwar", "The Art of War", False),
    (174, "gb_dorian", "The Picture of Dorian Gray", False),
]

_START = re.compile(r"\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG.*?\*\*\*", re.I | re.S)
_END = re.compile(r"\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG", re.I)


_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def _download(gid: int) -> str:
    urls = [
        f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt",
        f"https://www.gutenberg.org/files/{gid}/{gid}-0.txt",
        f"https://www.gutenberg.org/ebooks/{gid}.txt.utf-8",
    ]
    for u in urls:
        for attempt in range(4):
            try:
                r = httpx.get(u, timeout=60, follow_redirects=True, headers={"User-Agent": _UA})
                if r.status_code == 200 and len(r.text) > 2000:
                    r.encoding = "utf-8"
                    return r.text
                if r.status_code in (403, 429, 503):
                    time.sleep(4 * (attempt + 1))  # 被限流，退避重试
                    continue
                break  # 404 等：换下一个 url
            except Exception:
                time.sleep(3)
    return ""


def _strip_boilerplate(text: str) -> str:
    m = _START.search(text)
    if m:
        text = text[m.end():]
    m = _END.search(text)
    if m:
        text = text[:m.start()]
    return text.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="")
    ap.add_argument("--token", default="")
    ap.add_argument("--secret", default="")
    ap.add_argument("--only", type=int, default=0, help="只导某个 gutenberg id")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    converter = None
    headers = {"Content-Type": "application/json"}
    if args.token:
        headers["X-App-Token"] = args.token

    for gid, book_id, title, t2s in BOOKS:
        if args.only and gid != args.only:
            continue
        print(f"\n=== {title} (#{gid}) ===", flush=True)
        raw = _download(gid)
        if not raw:
            print("  下载失败，跳过", flush=True)
            continue
        body = _strip_boilerplate(raw)
        if t2s:
            if converter is None:
                import opencc
                converter = opencc.OpenCC("t2s")
            body = converter.convert(body)
        paras = _paragraphs(body)
        chapters = chapterize(paras, 80)
        n = sum(len(c["paras"]) for c in chapters)
        print(f"  {len(chapters)} 章 / {n} 段；前几章: {[c['title'] for c in chapters[:5]]}", flush=True)
        if args.dry or not args.api:
            continue
        r = httpx.post(
            f"{args.api.rstrip('/')}/api/reader/ingest",
            json={"book_id": book_id, "title": title, "data": {"chapters": chapters}, "secret": args.secret},
            headers=headers, timeout=120,
        )
        print(f"  上传 → {r.status_code} {r.text[:120]}", flush=True)
        time.sleep(3)  # 给 Gutenberg 喘口气，别触发限流


if __name__ == "__main__":
    main()
