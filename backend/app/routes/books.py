"""Book library browsing & search."""

from fastapi import APIRouter, Query

from app.models import Book
from app.services.book_filter import load_books

router = APIRouter()

# 整库在进程启动时加载一次（500 本，常驻内存即可）
_LIBRARY: list[Book] = load_books()


def _matches(book: Book, q: str) -> int:
    """返回匹配分（0 = 不匹配）；分越高越靠前。中英文都能搜。"""
    title = book.title.lower()
    title_en = (book.title_en or "").lower()
    author = book.author.lower()
    author_en = (book.author_en or "").lower()
    summary = (book.summary or "").lower()
    summary_en = (book.summary_en or "").lower()
    if q == title or q == title_en:
        return 100
    if title.startswith(q) or title_en.startswith(q):
        return 80
    if q in title or q in title_en:
        return 60
    if q in author or q in author_en:
        return 40
    if q in summary or q in summary_en or any(q in (c or "").lower() for c in book.key_chapters):
        return 20
    return 0


@router.get("/books/by-ids", response_model=list[Book])
def books_by_ids(
    ids: str = Query("", description="逗号分隔的 book id 列表"),
) -> list[Book]:
    """按 id 批量取书（用于收藏列表用最新数据重新水合，补上英文字段等）。"""
    wanted = [i.strip() for i in ids.split(",") if i.strip()]
    if not wanted:
        return []
    by_id = {b.id: b for b in _LIBRARY}
    return [by_id[i] for i in wanted if i in by_id]


@router.get("/books/search", response_model=list[Book])
def search_books(
    q: str = Query("", description="关键词：书名 / 作者 / 简介"),
    limit: int = Query(30, ge=1, le=100),
) -> list[Book]:
    query = q.strip().lower()
    if not query:
        return []
    scored = [(s, b) for b in _LIBRARY if (s := _matches(b, query)) > 0]
    scored.sort(key=lambda x: (-x[0], x[1].title))
    return [b for _, b in scored[:limit]]
