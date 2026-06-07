"""扫描版（图片）PDF → OCR 取字 → 章节/段落 → POST 入库。本地跑，PDF 不上传。

用法：
  python scripts/ocr_pdf.py <pdf> --book-id rd_x --title "书名" \
      --api https://bookmirror-api.onrender.com --token <X-App-Token> [--dpi 150]

依赖（本地）：pip install rapidocr-onnxruntime PyMuPDF httpx
慢：约 1.5~2 秒/页。大部头（几千页）别用这个。
"""

import argparse
import re
import sys

import fitz
import httpx
from rapidocr_onnxruntime import RapidOCR

from scripts.ingest_pdf import chapterize

_END = re.compile(r"[。！？…”』」》）]$")
_NOISE = re.compile(r"^[\d\s·.－—-]+$")


def _lines_to_paras(lines: list[str]) -> list[str]:
    """OCR 出的是一行行，按句末标点合并成自然段。"""
    paras: list[str] = []
    buf = ""
    for ln in lines:
        ln = ln.strip()
        if not ln or _NOISE.match(ln):
            continue
        buf = buf + ln if buf else ln
        if _END.search(ln):
            paras.append(buf)
            buf = ""
    if buf:
        paras.append(buf)
    return paras


def _upload(api, token, secret, book_id, title, chapters):
    n_paras = sum(len(c["paras"]) for c in chapters)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-App-Token"] = token
    r = httpx.post(
        f"{api.rstrip('/')}/api/reader/ingest",
        json={"book_id": book_id, "title": title, "data": {"chapters": chapters}, "secret": secret},
        headers=headers, timeout=180,
    )
    print(f"上传 {book_id}「{title}」 {len(chapters)}章/{n_paras}段 → {r.status_code} {r.text[:120]}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--book-id", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--chapter-size", type=int, default=60)
    ap.add_argument("--max-pages", type=int, default=0, help="只 OCR 前 N 页（0=全部）")
    ap.add_argument("--split", type=int, default=1, help="按页均分成 N 本上传（大部头用，避免单个 JSON 过大）")
    ap.add_argument("--api", default="")
    ap.add_argument("--token", default="")
    ap.add_argument("--secret", default="")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    ocr = RapidOCR()
    doc = fitz.open(args.pdf)
    n = doc.page_count
    if args.max_pages > 0:
        n = min(n, args.max_pages)

    split = max(1, args.split)
    per = (n + split - 1) // split
    cur_lines: list[str] = []
    part = 0

    def flush_part():
        nonlocal cur_lines, part
        if not cur_lines:
            return
        paras = _lines_to_paras(cur_lines)
        chapters = chapterize(paras, args.chapter_size)
        bid = args.book_id if split == 1 else f"{args.book_id}_{part + 1:02d}"
        title = args.title if split == 1 else f"{args.title}·{part + 1}/{split}"
        print(f"== 第{part + 1}/{split}部分 OCR 完：{len(chapters)}章 ==", flush=True)
        if not args.dry and args.api:
            _upload(args.api, args.token, args.secret, bid, title, chapters)
        cur_lines = []
        part += 1

    for i in range(n):
        pix = doc[i].get_pixmap(dpi=args.dpi)
        res, _ = ocr(pix.tobytes("png"))
        if res:
            cur_lines.extend(r[1] for r in res)
        if (i + 1) % 50 == 0 or i + 1 == n:
            print(f"  OCR {i + 1}/{n} 页…", flush=True)
        # 到达本部分末尾就上传，边 OCR 边传、控内存
        if split > 1 and (i + 1) % per == 0:
            flush_part()
    flush_part()
    doc.close()
    print("全部完成。", flush=True)


if __name__ == "__main__":
    main()
