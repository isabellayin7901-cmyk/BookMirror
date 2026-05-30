/**
 * 各阅读 / 购书 / 评分平台的跳转配置
 *
 * 工作流：
 *  - 用户点平台按钮 → 尝试唤起对应 APP
 *  - APP 没装 → 自动跳 App Store
 *  - 长按 → 浏览器打开网页
 *
 * 智能筛选：每个平台有 matchesBook() 函数，根据书的语言/分类决定要不要显示。
 *   例：番茄小说只对中文小说显示，Goodreads 只对英文书显示
 */

import { Alert, Linking } from 'react-native';
import type { Book, Language } from '../types';
import { storage, type SearchEngine } from './storage';
import { t as translate } from './i18n';
import { bookTitle, bookAuthor } from './bookDisplay';

// ===== 联盟 / 跟踪 ID（申请到了改这里即可） =====
const AFFILIATE = {
  jd: '',           // 京东联盟：https://union.jd.com
  taobao: '',       // 淘宝联盟（阿里妈妈）：https://pub.alimama.com
  dangdang: '',     // 当当联盟：https://union.dangdang.com
  amazonUS: '',     // Amazon Associates US：https://associates.amazon.com
} as const;

const enc = (s: string) => encodeURIComponent(s);
const q = (book: Book) => book.isbn || book.title;

export interface PlatformConfig {
  id: string;
  name: string;
  nameEn: string;
  iconChar: string;
  iconColor: string;
  category: 'read' | 'buy' | 'rating';
  buildDeepLink: (b: Book) => string;
  appStoreUrl: string;
  buildWebUrl: (b: Book) => string;
  matchesBook: (b: Book) => boolean;
  /**
   * 可选：实时查询 API 拿这本书的直接链接（如 Apple Books 直接跳书页）。
   * 返回 null 或 throw 时回退到 buildDeepLink/buildWebUrl。
   */
  resolveDirectUrl?: (b: Book) => Promise<string | null>;
}

// ===== 工具：判断书的类型 =====
const isChinese = (b: Book) => b.language === 'zh';
const isEnglish = (b: Book) => b.language === 'en';
const isNovel = (b: Book) => b.category === 'novel';

/**
 * 番茄小说覆盖范围 —— 主营网文/通俗读物：
 * - 所有中文小说（网文 + 经典文学他们也都有）
 * - 通俗非虚构（成功学、励志类）：难度 ≤ 2
 * - 不包含：哲学、严肃心理学、学术历史、商业管理
 */
const isFanqieLikely = (b: Book) =>
  isChinese(b) && (
    isNovel(b) ||
    b.category === 'biography' ||
    (b.category === 'non_fiction' && b.difficulty <= 2)
  );

/**
 * QQ 阅读覆盖范围 —— 主要是阅文系（起点中文网）网文 + 部分出版书：
 * 比番茄略广，也覆盖一些中等难度的非虚构
 */
const isQQReaderLikely = (b: Book) =>
  isChinese(b) && (
    isNovel(b) ||
    b.category === 'biography' ||
    (b.category === 'non_fiction' && b.difficulty <= 3)
  );

export const PLATFORMS: PlatformConfig[] = [
  // —— 阅读类（中文） ——
  {
    id: 'weread', name: '微信读书', nameEn: 'WeChat Read',
    iconChar: '微', iconColor: '#7BA88A',
    category: 'read',
    // 录了直链就直接进书页（universal link 装了 APP 会自动唤起），否则搜索
    buildDeepLink: (b) =>
      b.purchase_links?.weread || `weread://search?keyword=${enc(b.title)}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id984825182',
    buildWebUrl: (b) =>
      b.purchase_links?.weread ||
      `https://weread.qq.com/web/search/books?keyword=${enc(b.title)}`,
    // 中文书都覆盖；其它书只要录了微信读书直链也展示（很多译作/外文书也在）
    matchesBook: (b) => isChinese(b) || !!b.purchase_links?.weread,
  },
  {
    id: 'fanqie', name: '番茄小说', nameEn: 'Fanqie Novel',
    iconChar: '番', iconColor: '#D88A8A',
    category: 'read',
    buildDeepLink: (b) => `snssdk1112://search?keyword=${enc(b.title)}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id1462282900',
    // 番茄站内搜索失效，用 Baidu site: 定向搜索（点第一条会直接进 fanqienovel.com/page/ID）
    buildWebUrl: (b) =>
      `https://m.baidu.com/s?word=${enc(`site:fanqienovel.com ${b.title}`)}`,
    matchesBook: isFanqieLikely,
  },
  {
    id: 'qqreader', name: 'QQ阅读', nameEn: 'QQ Reading',
    iconChar: 'Q', iconColor: '#6A8FB5',
    category: 'read',
    buildDeepLink: (b) => `qqreader://search?keyword=${enc(b.title)}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id416176258',
    // QQ阅读站内搜索也限制多，同样用 Baidu site: 搜索
    buildWebUrl: (b) =>
      `https://m.baidu.com/s?word=${enc(`site:book.qq.com OR site:yuewen.com ${b.title}`)}`,
    matchesBook: isQQReaderLikely,
  },

  // —— 阅读类（国际） ——
  {
    id: 'applebooks', name: 'Apple Books', nameEn: 'Apple Books',
    iconChar: 'A', iconColor: '#D4A574',
    category: 'read',
    buildDeepLink: (b) =>
      `itms-books://itunes.apple.com/search?term=${enc(b.title)}&entity=ebook`,
    appStoreUrl: 'https://apps.apple.com/app/apple-books/id364709193',
    buildWebUrl: (b) => `https://books.apple.com/search?term=${enc(b.title)}&type=books`,
    matchesBook: () => true,
    // 实时调 iTunes Search API 拿到这本书的直接链接
    // 严格匹配：书名必须实质性匹配；找不到就 fallback 到搜索页
    resolveDirectUrl: async (b) => {
      const normalize = (s: string) =>
        (s || '')
          .toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[（）()【】《》「」\[\]:：·\-—]/g, '');
      const bookTitleNorm = normalize(b.title);
      // 第一作者（去掉合著者的影响）
      const firstAuthor = normalize((b.author || '').split(/[、，,/&]/)[0]);

      // 检查搜索结果是否真的匹配这本书
      function isGoodMatch(r: any): boolean {
        const rTitle = normalize(r.trackName || '');
        const rAuthor = normalize(r.artistName || '');
        if (!rTitle) return false;
        // 书名要么彼此包含（小幅误差允许），要么完全相等
        const titleOk =
          rTitle === bookTitleNorm ||
          (bookTitleNorm.length >= 3 && rTitle.includes(bookTitleNorm)) ||
          (rTitle.length >= 3 && bookTitleNorm.includes(rTitle));
        // 作者匹配作为加强信号（但不强制，因为 Apple 上作者名可能与中文版略不同）
        const authorOk =
          !firstAuthor ||
          rAuthor.includes(firstAuthor) ||
          firstAuthor.includes(rAuthor);
        // 书名完全相等：通过；书名包含 + 作者也匹配：通过
        return rTitle === bookTitleNorm || (titleOk && authorOk);
      }

      const countries = b.language === 'zh' ? ['cn', 'hk', 'tw'] : ['us', 'gb'];
      for (const country of countries) {
        try {
          // 优先用 ISBN（最精确）
          const term = b.isbn ? b.isbn : `${b.title} ${b.author}`;
          const apiUrl =
            `https://itunes.apple.com/search?term=${enc(term)}` +
            `&entity=ebook&limit=10&country=${country}`;
          const res = await fetch(apiUrl);
          if (!res.ok) continue;
          const data = await res.json();
          const results: any[] = data.results || [];
          if (results.length === 0) continue;

          // 严格匹配：必须实质匹配，否则跳过这个国家区
          const best = results.find(isGoodMatch);
          if (!best?.trackViewUrl) continue;

          // 把 https 转成 itms-books，强制在 Apple Books APP 中打开
          return best.trackViewUrl.replace(/^https:\/\//, 'itms-books://');
        } catch {
          continue;
        }
      }
      // 各国家区都找不到精确匹配 —— 返回 null，让 openPlatform 回落到搜索页
      return null;
    },
  },
  {
    id: 'kindle', name: 'Kindle', nameEn: 'Kindle',
    iconChar: 'K', iconColor: '#B89978',
    category: 'read',
    // Kindle 用 kindle:// 或 Amazon Universal Link
    buildDeepLink: (b) =>
      `kindle://search?keyword=${enc(b.title)}`,
    appStoreUrl: 'https://apps.apple.com/app/amazon-kindle/id302584613',
    buildWebUrl: (b) => `https://www.amazon.com/s?k=${enc(b.title)}&i=digital-text`,
    matchesBook: (b) => isEnglish(b) || b.difficulty >= 3,
  },

  // —— 购买类（中文） ——
  {
    id: 'jd', name: '京东', nameEn: 'JD.com',
    iconChar: '京', iconColor: '#C26565',
    category: 'buy',
    buildDeepLink: (b) =>
      `openapp.jdmobile://virtual?params=${enc(JSON.stringify({
        category: 'jump', des: 'productList', keyWord: q(b), source: 'BookMirror',
      }))}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id414245413',
    buildWebUrl: (b) => {
      const aff = AFFILIATE.jd ? `&unionId=${AFFILIATE.jd}` : '';
      return `https://search.jd.com/Search?keyword=${enc(q(b))}${aff}`;
    },
    matchesBook: isChinese,
  },
  {
    id: 'taobao', name: '淘宝', nameEn: 'Taobao',
    iconChar: '淘', iconColor: '#D88E5C',
    category: 'buy',
    buildDeepLink: (b) => `taobao://s.taobao.com/search?q=${enc(q(b))}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id387682726',
    buildWebUrl: (b) => {
      const aff = AFFILIATE.taobao ? `&pvid=${AFFILIATE.taobao}` : '';
      return `https://s.taobao.com/search?q=${enc(q(b))}${aff}`;
    },
    matchesBook: isChinese,
  },
  {
    id: 'dangdang', name: '当当', nameEn: 'Dangdang',
    iconChar: '当', iconColor: '#F0C963',
    category: 'buy',
    buildDeepLink: (b) => `dangdang://search?keyword=${enc(q(b))}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id387462048',
    buildWebUrl: (b) => `http://search.dangdang.com/?key=${enc(q(b))}&category_path=01.00.00.00.00.00`,
    matchesBook: isChinese,
  },

  // —— 购买类（国际） ——
  {
    id: 'amazon_us', name: 'Amazon', nameEn: 'Amazon',
    iconChar: 'a', iconColor: '#E5A36A',
    category: 'buy',
    buildDeepLink: (b) =>
      `com.amazon.mobile.shopping://www.amazon.com/s?k=${enc(q(b))}`,
    appStoreUrl: 'https://apps.apple.com/app/amazon-shopping/id297606951',
    buildWebUrl: (b) => {
      const tag = AFFILIATE.amazonUS ? `&tag=${AFFILIATE.amazonUS}` : '';
      return `https://www.amazon.com/s?k=${enc(q(b))}${tag}`;
    },
    matchesBook: () => true,  // 全球用户都可能用
  },

  // —— 评分类 ——
  {
    id: 'douban', name: '豆瓣', nameEn: 'Douban',
    iconChar: '豆', iconColor: '#5E8B5C',
    category: 'rating',
    buildDeepLink: (b) => `douban://book/search?q=${enc(q(b))}`,
    appStoreUrl: 'https://apps.apple.com/cn/app/id907002334',
    buildWebUrl: (b) => `https://book.douban.com/subject_search?search_text=${enc(q(b))}`,
    matchesBook: () => true,  // 豆瓣几乎覆盖所有书（中英都有）
  },
  {
    id: 'goodreads', name: 'Goodreads', nameEn: 'Goodreads',
    iconChar: 'GR', iconColor: '#9B7B5E',
    category: 'rating',
    buildDeepLink: (b) => `https://www.goodreads.com/search?q=${enc(b.title)}`,
    appStoreUrl: 'https://apps.apple.com/app/goodreads/id355833469',
    buildWebUrl: (b) => `https://www.goodreads.com/search?q=${enc(b.title)}`,
    matchesBook: (b) => isEnglish(b),  // 英文书才显示 Goodreads
  },
];

/** 返回当前书适用的平台（已经按 matchesBook 过滤好） */
export function getPlatformsForBook(book: Book): PlatformConfig[] {
  return PLATFORMS.filter((p) => p.matchesBook(book));
}

/** 平台名按界面语言显示：英文界面用 nameEn，中文界面用 name */
export function platformName(p: PlatformConfig, lang: Language): string {
  return lang === 'en' ? p.nameEn : p.name;
}

/**
 * 智能打开：先 APP，没装则浏览器（保证用户在任何地区都能用）。
 * 想下载 APP 用 openAppStore（长按触发）。
 */
/** 调试开关：设 true 会弹窗显示 lookup 结果，定位问题用 */
const DEBUG_LOOKUP = false;

/** 英文模式下用百度/Google 搜「英文书名 + 作者」 */
function buildEngineUrl(engine: 'baidu' | 'google', book: Book): string {
  const query = `${bookTitle(book, 'en')} ${bookAuthor(book, 'en')}`.trim();
  return engine === 'google'
    ? `https://www.google.com/search?q=${enc(query)}`
    : `https://www.baidu.com/s?wd=${enc(query)}`;
}

/**
 * 浏览器搜索：
 *  - 中文模式：用平台自带的网页搜索（站内/定向）
 *  - 英文模式：按设置的默认搜索引擎；'ask' 时弹窗让用户选百度/Google，
 *    然后用英文书名+作者去搜
 */
async function browserSearch(p: PlatformConfig, book: Book): Promise<void> {
  const { language, searchEngine = 'ask' } = await storage.getSettings();
  if (language !== 'en') {
    Linking.openURL(p.buildWebUrl(book)).catch(() => {});
    return;
  }
  if (searchEngine === 'baidu' || searchEngine === 'google') {
    Linking.openURL(buildEngineUrl(searchEngine, book)).catch(() => {});
    return;
  }
  // ask each time
  Alert.alert(translate('engine.choose', 'en'), '', [
    { text: translate('platform.cancel', 'en'), style: 'cancel' },
    {
      text: translate('engine.baidu', 'en'),
      onPress: () => Linking.openURL(buildEngineUrl('baidu', book)).catch(() => {}),
    },
    {
      text: translate('engine.google', 'en'),
      onPress: () => Linking.openURL(buildEngineUrl('google', book)).catch(() => {}),
    },
  ]);
}

export async function openPlatform(p: PlatformConfig, book: Book): Promise<void> {
  const { language: lang } = await storage.getSettings();

  // 1) Apple Books 等支持直链查询的：直接进精确书页
  if (p.resolveDirectUrl) {
    try {
      const direct = await p.resolveDirectUrl(book);
      if (direct) {
        await Linking.openURL(direct);
        return;
      }
    } catch {
      /* fall through */
    }
  }

  // 2) 试着唤起 APP（搜索）
  const deepLink = p.buildDeepLink(book);

  // 2a) canOpenURL 在真机自定义构建里准确；但在 Expo Go 里，未写进
  //     LSApplicationQueriesSchemes 的 scheme 永远返回 false（即使装了 APP）。
  //     所以 canOpenURL 为 true 时直接开，为 false 时不能据此判定"没装"。
  try {
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    /* fall through */
  }

  // 2b) openURL 不受白名单限制：装了 APP 就能唤起，没装才会 reject。
  //     这样在 Expo Go 里也能直接跳转，绕过 canOpenURL 的误判。
  try {
    await Linking.openURL(deepLink);
    return;
  } catch {
    /* 真的打不开（没装）→ 进入下面的兜底弹窗 */
  }

  // 3) APP 没装 → 给用户选择：浏览器搜索 / 下载 APP
  Alert.alert(
    translate('platform.notInstalled', lang, { name: platformName(p, lang) }),
    translate('platform.whereToRead', lang),
    [
      { text: translate('platform.cancel', lang), style: 'cancel' },
      {
        text: translate('platform.browserSearch', lang),
        onPress: () => { browserSearch(p, book); },
      },
      {
        text: translate('platform.downloadApp', lang),
        onPress: () => Linking.openURL(p.appStoreUrl).catch(() => {}),
      },
    ],
  );
}

/** 长按用：明确想去 App Store 下 APP 时（注意地区限制） */
export async function openAppStore(p: PlatformConfig): Promise<void> {
  const { language: lang } = await storage.getSettings();
  Alert.alert(
    translate('platform.downloadTitle', lang, { name: platformName(p, lang) }),
    translate('platform.downloadHint', lang),
    [
      { text: translate('platform.cancel', lang), style: 'cancel' },
      {
        text: translate('platform.toAppStore', lang),
        onPress: () => Linking.openURL(p.appStoreUrl).catch(() => {}),
      },
    ],
  );
}
