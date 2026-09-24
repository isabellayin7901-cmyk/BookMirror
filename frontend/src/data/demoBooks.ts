/**
 * 示例书：只用于演示多版本阅读、划选菜单、好句与讨论、AI 翻译与理解。
 *
 * ⚠️ 这不是已接入的书库内容。正文全部来自公有领域文本，只做了排版处理（去掉章节头与
 *    段落编号、合并换行、繁体转简体），没有改动字句：
 *   - 原文：Project Gutenberg #7337《道德經》，繁转简（OpenCC t2s）
 *   - 英译：Project Gutenberg #216 The Tao Teh King, tr. James Legge (1891)
 *
 * 真实书籍接入后，这里的结构（BookEdition + 按 index 对齐的章节）就是后端
 * /api/reader/editions、/api/reader/chapter?edition= 要返回的形状，见 lib/readerSource.ts。
 */
import type { BookEdition, ChapterSource } from '../types';

export interface DemoChapter { title: string; paras: string[] }

export interface DemoBook {
  bookId: string;
  title: string;
  titleEn: string;
  /** 章节信息来源：本书章节来自原书 */
  chapterSource: ChapterSource;
  editions: BookEdition[];
  /** editionId → 章节列表（各版本按 index 对齐） */
  chapters: Record<string, DemoChapter[]>;
}

export const DEMO_DAODEJING: DemoBook = {
  bookId: 'demo_daodejing',
  title: '道德经（示例 · 第 1–3 章）',
  titleEn: 'Tao Te Ching (sample · ch. 1–3)',
  chapterSource: 'book',
  editions: [
    {
      id: 'orig-lzh',
      lang: 'lzh',
      kind: 'original',
      label: '原文（文言）',
      labelEn: 'Original (Classical Chinese)',
      source: 'Project Gutenberg #7337《道德經》，公有领域；繁体转简体',
    },
    {
      id: 'en-legge',
      lang: 'en',
      kind: 'translation',
      translator: 'James Legge',
      label: '英文译本 · 理雅各（1891）',
      labelEn: 'English · James Legge (1891)',
      source: 'Project Gutenberg #216, The Tao Teh King, tr. James Legge (1891)，公有领域',
    },
  ],
  chapters: {
    'orig-lzh': [
      {
        title: "第一章",
        paras: [
          "道可道，非常道。名可名，非常名。无，名天地之始；有，名万物之母。故常无，欲以观其妙；常有，欲以观其徼。此两者，同出而异名，同谓之玄。玄之又玄，众妙之门。"
        ]
      },
      {
        title: "第二章",
        paras: [
          "天下皆知美之为美，斯恶矣；皆知善之为善，斯不善矣。故有无相生，难易相成，长短相形，高下相倾，音声相和，前后相随。是以圣人处「无为」之事，行「不言」之教。万物作焉而不辞，生而不有，为而不恃，功成而弗居。夫唯弗居，是以不去。"
        ]
      },
      {
        title: "第三章",
        paras: [
          "不尚贤，使民不争；不贵难得之货，使民不为盗；不见可欲，使民心不乱。是以「圣人」之治，虚其心，实其腹，弱其志，强其骨。常使民无知无欲。使夫智者不敢为也。为「无为」，则无不治。"
        ]
      }
    ],
    'en-legge': [
      {
        title: "Chapter 1",
        paras: [
          "The Tao that can be trodden is not the enduring and unchanging Tao. The name that can be named is not the enduring and unchanging name.",
          "(Conceived of as) having no name, it is the Originator of heaven and earth; (conceived of as) having a name, it is the Mother of all things.",
          "Always without desire we must be found,\nIf its deep mystery we would sound;\nBut if desire always within us be,\nIts outer fringe is all that we shall see.",
          "Under these two aspects, it is really the same; but as development takes place, it receives the different names. Together we call them the Mystery. Where the Mystery is the deepest is the gate of all that is subtle and wonderful."
        ]
      },
      {
        title: "Chapter 2",
        paras: [
          "All in the world know the beauty of the beautiful, and in doing this they have (the idea of) what ugliness is; they all know the skill of the skilful, and in doing this they have (the idea of) what the want of skill is.",
          "So it is that existence and non-existence give birth the one to (the idea of) the other; that difficulty and ease produce the one (the idea of) the other; that length and shortness fashion out the one the figure of the other; that (the ideas of) height and lowness arise from the contrast of the one with the other; that the musical notes and tones become harmonious through the relation of one with another; and that being before and behind give the idea of one following another.",
          "Therefore the sage manages affairs without doing anything, and conveys his instructions without the use of speech.",
          "All things spring up, and there is not one which declines to show itself; they grow, and there is no claim made for their ownership; they go through their processes, and there is no expectation (of a reward for the results). The work is accomplished, and there is no resting in it (as an achievement).",
          "The work is done, but how no one can see;\n'Tis this that makes the power not cease to be."
        ]
      },
      {
        title: "Chapter 3",
        paras: [
          "Not to value and employ men of superior ability is the way to keep the people from rivalry among themselves; not to prize articles which are difficult to procure is the way to keep them from becoming thieves; not to show them what is likely to excite their desires is the way to keep their minds from disorder.",
          "Therefore the sage, in the exercise of his government, empties their minds, fills their bellies, weakens their wills, and strengthens their bones.",
          "He constantly (tries to) keep them without knowledge and without desire, and where there are those who have knowledge, to keep them from presuming to act (on it). When there is this abstinence from action, good order is universal."
        ]
      }
    ],
  },
};

/** 书架上展示的示例书（目前只有这一本） */
export const DEMO_BOOKS: DemoBook[] = [DEMO_DAODEJING];

export function getDemoBook(bookId: string): DemoBook | null {
  return DEMO_BOOKS.find((b) => b.bookId === bookId) ?? null;
}
