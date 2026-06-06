"""把一本 PDF 在本地抽成 章节/段落，POST 到后端写进书库。PDF 本身不上传、不入库。

用法：
  python scripts/ingest_pdf.py <pdf路径> --book-id mybook --title "书名" \
      --api https://bookmirror-api.onrender.com --token <X-App-Token> [--secret <admin密钥>]
  # 只导出 JSON 不上传：加 --dry 看抽取效果

章节切分是启发式的（认 “第N章 / Chapter N / 序 / 前言 / 后记” 这类标题行）；
认不出来就按段数兜底切。先 --dry 跑一遍看分章对不对，再正式上传。
"""

import argparse
import json
import re
import sys

import fitz  # PyMuPDF（本地装：pip install PyMuPDF）
import httpx

# 章节标题：抓段首的“第X章/卷/回/节”或英文 Chapter N。标题常和正文粘在一起
# （如“第一章被大火烧了…”），所以只把标题那个词剥出来当章名，剩下的归入正文。
_HEADING = re.compile(
    r"^\s*(第\s*[0-9一二三四五六七八九十百千零两]+\s*[章卷回节]"
    r"|chapter\s+[0-9ivxlcdm]+)",
    re.IGNORECASE,
)


def _clean(text: str) -> str:
    # 合并被 PDF 断开的连字，去掉行尾连字符换行
    text = text.replace("\r", "\n")
    text = re.sub(r"-\n(?=[a-z])", "", text)  # 英文断词
    return text


def _paragraphs(page_text: str) -> list[str]:
    """把一页文本切成段落：空行分段；无空行时按换行合并成自然段。"""
    page_text = _clean(page_text)
    # 先按空行分块
    blocks = re.split(r"\n\s*\n", page_text)
    paras: list[str] = []
    for b in blocks:
        lines = [ln.strip() for ln in b.split("\n") if ln.strip()]
        if not lines:
            continue
        # 同一块内的换行多数是排版换行，合并成一段（中文不留空格，英文留空格）
        merged = ""
        for ln in lines:
            if not merged:
                merged = ln
            elif re.search(r"[A-Za-z0-9,;:]$", merged):
                merged += " " + ln
            else:
                merged += ln
        paras.append(merged)
    return paras


def extract(pdf_path: str, chapter_size: int) -> list[dict]:
    """从文字版 PDF 抽段落 → 切章节。"""
    doc = fitz.open(pdf_path)
    all_paras: list[str] = []
    for page in doc:
        all_paras.extend(_paragraphs(page.get_text("text")))
    doc.close()
    return chapterize(all_paras, chapter_size)


def chapterize(all_paras: list[str], chapter_size: int) -> list[dict]:
    """把一串段落切成章节（认“第X章”标题，去重复页眉，太少则按段数兜底切）。"""
    # 去掉过短的页眉页脚噪声（纯页码等）
    all_paras = [p for p in all_paras if not re.fullmatch(r"[\d\s·.－-]+", p)]

    chapters: list[dict] = []
    cur = {"index": 0, "title": "正文", "paras": []}
    for p in all_paras:
        m = _HEADING.match(p)
        if m and len(m.group(0).strip()) <= 12:
            title = m.group(0).strip()
            body = p[m.end():].strip()
            # 手机版 PDF 常把章标题当页眉每页重复 → 标题没变就不另起一章，丢掉这行重复页眉
            if title == cur["title"]:
                if body:
                    cur["paras"].append(body)
                continue
            if cur["paras"] or cur["title"] != "正文":
                chapters.append(cur)
            cur = {"index": len(chapters), "title": title, "paras": ([body] if body else [])}
        else:
            cur["paras"].append(p)
    if cur["paras"] or cur["title"] != "正文":
        chapters.append(cur)

    # 真章节太少（标题不是“第X章”格式）→ 按 chapter_size 段兜底切
    real_titles = {c["title"] for c in chapters if c["title"] != "正文"}
    if len(real_titles) < 3 and chapter_size > 0:
        flat = [p for c in chapters for p in c["paras"]]
        chapters = []
        for i in range(0, len(flat), chapter_size):
            chapters.append({
                "index": len(chapters),
                "title": f"第 {len(chapters) + 1} 节",
                "paras": flat[i:i + chapter_size],
            })

    for i, c in enumerate(chapters):
        c["index"] = i
    return chapters


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--book-id", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--chapter-size", type=int, default=80, help="认不出章节时每章段数")
    ap.add_argument("--api", default="", help="后端地址，如 https://bookmirror-api.onrender.com")
    ap.add_argument("--token", default="", help="X-App-Token")
    ap.add_argument("--secret", default="", help="READER_ADMIN_SECRET（如后端配了）")
    ap.add_argument("--dry", action="store_true", help="只抽取看效果，不上传")
    args = ap.parse_args()

    chapters = extract(args.pdf, args.chapter_size)
    n_paras = sum(len(c["paras"]) for c in chapters)
    if n_paras == 0:
        print("⚠️ 没抽到文字——可能是扫描版 PDF（图片），需要 OCR。", file=sys.stderr)
        sys.exit(1)

    print(f"抽取「{args.title}」：{len(chapters)} 章 / {n_paras} 段")
    for c in chapters[:10]:
        print(f"  [{c['index']}] {c['title']}  ({len(c['paras'])} 段)")
    if len(chapters) > 10:
        print(f"  …共 {len(chapters)} 章")

    if args.dry:
        print("（--dry 仅预览，未上传）")
        return
    if not args.api:
        print("没给 --api，未上传。加 --api 和 --token 才会写进书库。", file=sys.stderr)
        return

    headers = {"Content-Type": "application/json"}
    if args.token:
        headers["X-App-Token"] = args.token
    r = httpx.post(
        f"{args.api.rstrip('/')}/api/reader/ingest",
        json={"book_id": args.book_id, "title": args.title, "data": {"chapters": chapters}, "secret": args.secret},
        headers=headers, timeout=60,
    )
    print("上传结果:", r.status_code, r.text[:200])


if __name__ == "__main__":
    main()
