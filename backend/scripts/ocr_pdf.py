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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--book-id", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--chapter-size", type=int, default=60)
    ap.add_argument("--max-pages", type=int, default=0, help="只 OCR 前 N 页（0=全部）")
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

    all_lines: list[str] = []
    for i in range(n):
        pix = doc[i].get_pixmap(dpi=args.dpi)
        res, _ = ocr(pix.tobytes("png"))
        if res:
            all_lines.extend(r[1] for r in res)
        if (i + 1) % 20 == 0 or i + 1 == n:
            print(f"  OCR {i + 1}/{n} 页…", flush=True)
    doc.close()

    paras = _lines_to_paras(all_lines)
    chapters = chapterize(paras, args.chapter_size)
    n_paras = sum(len(c["paras"]) for c in chapters)
    print(f"OCR 完成「{args.title}」：{len(chapters)} 章 / {n_paras} 段")
    for c in chapters[:8]:
        print(f"  [{c['index']}] {c['title']} ({len(c['paras'])} 段)")

    if args.dry or not args.api:
        print("（未上传）")
        return
    headers = {"Content-Type": "application/json"}
    if args.token:
        headers["X-App-Token"] = args.token
    r = httpx.post(
        f"{args.api.rstrip('/')}/api/reader/ingest",
        json={"book_id": args.book_id, "title": args.title, "data": {"chapters": chapters}, "secret": args.secret},
        headers=headers, timeout=120,
    )
    print("上传结果:", r.status_code, r.text[:200])


if __name__ == "__main__":
    main()
