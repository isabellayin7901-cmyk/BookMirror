import type { Book, Language } from '../types';

/** 英文模式下优先显示英文书名/作者，缺失时回退到中文原文。 */
export function bookTitle(book: Pick<Book, 'title' | 'title_en'>, lang: Language): string {
  if (lang === 'en' && book.title_en) return book.title_en;
  return book.title;
}

export function bookAuthor(book: Pick<Book, 'author' | 'author_en'>, lang: Language): string {
  if (lang === 'en' && book.author_en) return book.author_en;
  return book.author;
}

/** 英文模式下优先显示英文简介，缺失时回退到中文原文。 */
export function bookSummary(book: Pick<Book, 'summary' | 'summary_en'>, lang: Language): string {
  if (lang === 'en' && book.summary_en) return book.summary_en;
  return book.summary;
}

/** 英文模式下优先显示英文章节主题，缺失时回退到中文原文。 */
export function bookChapters(
  book: Pick<Book, 'key_chapters' | 'key_chapters_en'>,
  lang: Language,
): string[] {
  if (lang === 'en' && book.key_chapters_en && book.key_chapters_en.length > 0) {
    return book.key_chapters_en;
  }
  return book.key_chapters ?? [];
}
