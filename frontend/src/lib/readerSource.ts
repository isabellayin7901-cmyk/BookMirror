/**
 * 阅读内容来源：阅读页只和这里打交道，不关心书是示例还是书库里的。
 *
 *  - 示例书（data/demoBooks.ts）：本地数据，带多个版本，用于演示多语言阅读。
 *  - 书库书（后端 /api/reader/*）：现有接口，目前每本只有一个版本。
 *
 * 【以后接入真实多版本书籍】后端增加：
 *    GET /api/reader/editions?book_id=          → BookEdition[] + chapter_source
 *    GET /api/reader/toc?book_id=&edition=      → 该版本目录（章节按 index 与原文对齐）
 *    GET /api/reader/chapter?book_id=&index=&edition=
 *  然后把下面 loadReaderBook / loadChapter 里的书库分支换成带 edition 的请求即可，
 *  阅读页、好句与讨论、AI 翻译都不用改（讨论区按 chapter_index 共享，好句记录 edition）。
 */
import {
  fetchReaderChapter, fetchReaderToc, fetchPrivateEditions, type ReaderChapter, type ReaderToc,
} from './api';
import { getDemoBook } from '../data/demoBooks';
import type { BookEdition, ChapterSource, ContentLanguagePref, EditionLang, Language } from '../types';

/** 私人书架的书（用户上传，只有本人能读）的 ID 前缀 */
export const isPrivateBook = (bookId: string) => bookId.startsWith('pv_');
const KNOWN_LANGS: EditionLang[] = ['lzh', 'zh', 'en', 'fr', 'de', 'ja'];

export interface ReaderBookInfo {
  bookId: string;
  title: string;
  isDemo: boolean;
  /** 私人书架的书：只能写私人笔记，不开放公开讨论 */
  isPrivate: boolean;
  /** 章节信息来源；书库书目前不确定（入库脚本自动切章），留空不展示 */
  chapterSource?: ChapterSource;
  /** 可选版本；书库书目前为空数组（= 只有一个版本，不显示版本切换） */
  editions: BookEdition[];
}

export async function loadReaderBook(bookId: string, editionId: string | null, userId = ''): Promise<{ info: ReaderBookInfo; toc: ReaderToc } | null> {
  const demo = getDemoBook(bookId);
  if (demo) {
    const ed = editionId && demo.chapters[editionId] ? editionId : demo.editions[0].id;
    const chapters = demo.chapters[ed];
    return {
      info: { bookId, title: demo.title, isDemo: true, isPrivate: false, chapterSource: demo.chapterSource, editions: demo.editions },
      toc: { book_id: bookId, title: demo.title, chapters: chapters.map((c, i) => ({ index: i, title: c.title, paras: c.paras.length })) },
    };
  }
  if (isPrivateBook(bookId)) {
    const [eds, toc] = await Promise.all([
      fetchPrivateEditions(bookId, userId),
      fetchReaderToc(bookId, { userId, edition: editionId }),
    ]);
    if (!toc) return null;
    const editions: BookEdition[] = eds.map((e) => ({
      id: e.id,
      lang: (KNOWN_LANGS as string[]).includes(e.lang) ? (e.lang as EditionLang) : 'other',
      kind: 'uploaded',
      label: e.label,
      labelEn: e.label_en,
      source: e.source,
    }));
    return { info: { bookId, title: toc.title, isDemo: false, isPrivate: true, editions }, toc };
  }
  const toc = await fetchReaderToc(bookId);
  if (!toc) return null;
  return { info: { bookId, title: toc.title, isDemo: false, isPrivate: false, editions: [] }, toc };
}

export async function loadChapter(bookId: string, index: number, editionId: string | null, userId = ''): Promise<ReaderChapter | null> {
  const demo = getDemoBook(bookId);
  if (demo) {
    const ed = editionId && demo.chapters[editionId] ? editionId : demo.editions[0].id;
    const chapters = demo.chapters[ed];
    const ch = chapters[Math.max(0, Math.min(index, chapters.length - 1))];
    const i = chapters.indexOf(ch);
    // 示例书的段评角标由阅读页按讨论数据另算，这里先置 0
    return { book_id: bookId, index: i, title: ch.title, total: chapters.length, paras: ch.paras.map((t, k) => ({ i: k, text: t, comments: 0 })) };
  }
  if (isPrivateBook(bookId)) return fetchReaderChapter(bookId, index, { userId, edition: editionId });
  return fetchReaderChapter(bookId, index);
}

/**
 * 打开一本书时选哪个版本：
 *  1. 这本书上次选过的版本
 *  2. 设置里的「阅读内容语言」：原文优先 / 中文优先 / 英文优先（没有该语言就退回原文）
 */
export function pickEdition(
  editions: BookEdition[], remembered: string | null, pref: ContentLanguagePref,
): BookEdition | null {
  if (editions.length === 0) return null;
  const hit = remembered && editions.find((e) => e.id === remembered);
  if (hit) return hit;
  if (pref === 'zh' || pref === 'en') {
    const byLang = editions.find((e) => e.lang === pref);
    if (byLang) return byLang;
  }
  return editions.find((e) => e.kind === 'original') ?? editions[0];
}

export function editionLabel(e: BookEdition, lang: Language): string {
  return lang === 'en' ? e.labelEn : e.label;
}
