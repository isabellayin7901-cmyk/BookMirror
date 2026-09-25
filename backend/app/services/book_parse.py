"""把用户上传的电子书解析成「章节 + 段落」，供私人书架在线阅读。

支持：
- EPUB：按书脊（spine）顺序，每个正文文件一章，章名取文件里的第一个标题
- TXT：认「第X章 / Chapter N / Chapitre N …」这类标题切章；认不出时按篇幅均分
- PDF（文字版）：用 pypdf 抽文字层；扫描版（没有文字层）不支持
  （不用 PyMuPDF：它是 AGPL 许可证，放在对外服务的服务器上有开源义务）

同时粗略判断正文语言（zh / en / fr / de / ja / other），给多版本阅读和 AI 翻译用。
"""

import io
import os
import re
import tempfile
from typing import Optional

_SKIP = re.compile(r"(titlepage|imprint|colophon|uncopyright|halftitle|cover|toc|loi|endnotes|copyright)", re.I)
_HEADING = re.compile(
    r"^\s*("
    r"第\s*[0-9一二三四五六七八九十百千零〇两]+\s*[章节回卷部篇]"
    r"|(chapter|chapitre|kapitel|part|partie|livre|book)\s+([0-9]+|[ivxlcdm]+|[a-z]+)\b"
    r")",
    re.I,
)
MAX_CHAPTER_CHARS = 30000     # 认不出章节时，按这个篇幅切
MAX_PARA_CHARS = 3000         # 过长的段落再拆一下，免得一段占好几页


class ParseError(ValueError):
    """给用户看的解析失败原因。"""


def _split_long(p: str) -> list[str]:
    if len(p) <= MAX_PARA_CHARS:
        return [p]
    out, cur = [], ""
    for sent in re.split(r"(?<=[。！？.!?])\s*", p):
        if cur and len(cur) + len(sent) > MAX_PARA_CHARS:
            out.append(cur)
            cur = ""
        cur += sent
    if cur:
        out.append(cur)
    return out


def _chapterize(paras: list[str]) -> list[dict]:
    """按标题行切章；一个标题都没有就按篇幅均分。"""
    chapters: list[dict] = []
    cur: Optional[dict] = None
    for p in paras:
        if len(p) <= 60 and _HEADING.match(p):
            cur = {"title": p.strip(), "paras": []}
            chapters.append(cur)
            continue
        if cur is None:
            cur = {"title": "", "paras": []}
            chapters.append(cur)
        cur["paras"].extend(_split_long(p))
    chapters = [c for c in chapters if c["paras"]]
    if len(chapters) <= 1:
        allp = [x for c in chapters for x in c["paras"]]
        chapters, cur, size = [], None, 0
        for p in allp:
            if cur is None or size + len(p) > MAX_CHAPTER_CHARS:
                cur = {"title": "", "paras": []}
                chapters.append(cur)
                size = 0
            cur["paras"].append(p)
            size += len(p)
    for i, c in enumerate(chapters):
        c["title"] = c["title"] or f"第 {i + 1} 部分"
    return chapters


def _parse_epub(data: bytes) -> tuple[str, str, list[dict]]:
    from bs4 import BeautifulSoup
    from ebooklib import epub, ITEM_DOCUMENT

    fd, tmp = tempfile.mkstemp(suffix=".epub")
    try:
        os.write(fd, data)
        os.close(fd)
        try:
            book = epub.read_epub(tmp)
        except Exception as e:
            raise ParseError("EPUB 文件无法读取，可能已损坏或有加密（DRM）") from e
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)

    meta_t = book.get_metadata("DC", "title")
    meta_a = book.get_metadata("DC", "creator")
    title = meta_t[0][0] if meta_t else ""
    author = meta_a[0][0] if meta_a else ""

    id_to_item = {it.get_id(): it for it in book.get_items()}
    chapters: list[dict] = []
    for spine_id, _ in book.spine:
        item = id_to_item.get(spine_id)
        if item is None or item.get_type() != ITEM_DOCUMENT or _SKIP.search(item.get_name() or ""):
            continue
        soup = BeautifulSoup(item.get_content(), "lxml")
        for tag in soup(["script", "style"]):
            tag.decompose()
        h = soup.find(["h1", "h2", "h3"])
        paras: list[str] = []
        for p in soup.find_all(["p", "blockquote", "li"]):
            if p.find_parent(["p", "blockquote", "li"]) is not None:
                continue
            t = p.get_text(" ", strip=True)
            if t:
                paras.extend(_split_long(t))
        if paras:
            chapters.append({"title": h.get_text(" ", strip=True) if h else "", "paras": paras})
    for i, c in enumerate(chapters):
        c["title"] = c["title"] or f"第 {i + 1} 章"
    return title, author, chapters


def _decode_text(data: bytes) -> str:
    for enc in ("utf-8-sig", "gb18030", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ParseError("文本编码无法识别")


def _parse_txt(data: bytes) -> list[dict]:
    text = _decode_text(data).replace("\r\n", "\n").replace("\r", "\n")
    paras = [ln.strip() for ln in text.split("\n") if ln.strip()]
    return _chapterize(paras)


def _pdf_page_paras(text: str) -> list[str]:
    text = re.sub(r"-\n(?=[a-zà-ÿ])", "", text)   # 英法文断词
    paras: list[str] = []
    for block in re.split(r"\n\s*\n", text):
        merged = ""
        for ln in (x.strip() for x in block.split("\n")):
            if not ln:
                continue
            if not merged:
                merged = ln
            elif re.search(r"[A-Za-zÀ-ÿ0-9,;:]$", merged):
                merged += " " + ln
            else:
                merged += ln
        # 去掉纯页码 / 页码装饰（如 “~ 144 ~”）
        if merged and not re.fullmatch(r"[\s\d~·.\-－–—]+", merged):
            paras.append(merged)
    return paras


def _parse_pdf(data: bytes) -> tuple[str, str, list[dict]]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ParseError("PDF 有加密，无法读取")
        pages = [page.extract_text() or "" for page in reader.pages]
    except ParseError:
        raise
    except Exception as e:
        raise ParseError("PDF 文件无法读取") from e
    if sum(len(p.strip()) for p in pages) < 200:
        raise ParseError("这个 PDF 没有文字层（可能是扫描版），暂不支持")
    meta = reader.metadata or {}
    paras = [p for page in pages for p in _pdf_page_paras(page)]
    return str(meta.get("/Title") or ""), str(meta.get("/Author") or ""), _chapterize(paras)


def detect_lang(chapters: list[dict]) -> str:
    """粗判正文语言：看汉字 / 假名比例和常见虚词。"""
    sample = " ".join(p for c in chapters[:3] for p in c["paras"][:40])[:20000]
    if not sample:
        return "other"
    kana = len(re.findall(r"[぀-ヿ]", sample))
    han = len(re.findall(r"[一-鿿]", sample))
    if kana > 50:
        return "ja"
    if han > len(sample) * 0.3:
        return "zh"
    words = re.findall(r"[a-zàâçéèêëîïôûùüÿœæäöß']+", sample.lower())
    score = {
        "en": sum(w in {"the", "and", "of", "to", "is", "that", "which", "with"} for w in words),
        "fr": sum(w in {"le", "la", "les", "des", "est", "et", "une", "qui", "dans", "du"} for w in words),
        "de": sum(w in {"der", "die", "das", "und", "ist", "nicht", "ein", "eine", "zu", "mit"} for w in words),
    }
    best = max(score, key=score.get)
    return best if score[best] >= 5 else "other"


def parse_upload(filename: str, data: bytes) -> dict:
    """返回 {title, author, lang, chapters:[{title, paras}]}；解析失败抛 ParseError。"""
    name = (filename or "").lower()
    title, author = "", ""
    if name.endswith(".epub") or data[:2] == b"PK":
        title, author, chapters = _parse_epub(data)
    elif name.endswith(".pdf") or data[:5] == b"%PDF-":
        title, author, chapters = _parse_pdf(data)
    elif name.endswith(".txt"):
        chapters = _parse_txt(data)
    else:
        raise ParseError("只支持 EPUB、TXT 和文字版 PDF")
    if not chapters:
        raise ParseError("没有读到正文内容")
    base = os.path.splitext(os.path.basename(filename or ""))[0]
    return {
        "title": (title or base or "未命名").strip()[:200],
        "author": (author or "").strip()[:200],
        "lang": detect_lang(chapters),
        "chapters": chapters,
    }
