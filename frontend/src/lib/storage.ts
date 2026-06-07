import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Book, Language, RecommendationResponse, SynthesisProfile, UserProfile } from '../types';

/**
 * 把会影响推荐的字段哈希成一个稳定字符串。
 * 任意一项变化都会让签名变 → 主页据此判断是否需要刷新。
 */
// 推荐 prompt 逻辑版本号：后端 prompt 改动（如英文画像生成）后递增，
// 让旧的缓存推荐结果失效、强制重新生成。
const RECOMMEND_PROMPT_VERSION = 'v2-en-profile';

export function profileSignature(p: UserProfile | null): string {
  if (!p) return '';
  const sortJoin = (arr: string[]) => [...arr].sort().join(',');
  return [
    RECOMMEND_PROMPT_VERSION,
    p.language,
    p.mbti,
    sortJoin(p.goals),
    sortJoin(p.problems),
    sortJoin(p.preferences),
    p.depth,
    p.gender ?? '',
    p.zodiac?.sun_sign ?? '',
    p.zodiac?.moon_sign ?? '',
    p.zodiac?.rising_sign ?? '',
    p.zodiac?.element ?? '',
    p.free_text ?? '',
  ].join('|');
}

const KEYS = {
  lastResult: '@bookmirror/last_result',
  userProfile: '@bookmirror/user_profile',
  settings: '@bookmirror/settings',
  feedbackLog: '@bookmirror/feedback_log',
  onboarded: '@bookmirror/onboarded',
  checkinLog: '@bookmirror/checkin_log',
  favorites: '@bookmirror/favorites',
  recommendSig: '@bookmirror/recommend_signature',
  synthesis: '@bookmirror/synthesis',
  bookFit: '@bookmirror/book_fit',
  userId: '@bookmirror/user_id',
  authToken: '@bookmirror/auth_token',
  savedSentences: '@bookmirror/saved_sentences',
  readerSettings: '@bookmirror/reader_settings',
} as const;

export interface ReaderSettings {
  fontSize: number;     // px
  lineHeight: number;   // 倍数
  theme: 'paper' | 'green' | 'dark' | 'white';
  margin: number;       // px
  fontFamily: 'system' | 'serif';
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 19, lineHeight: 1.85, theme: 'paper', margin: 22, fontFamily: 'system',
};

/** 匿名稳定设备/用户标识，用于后端持久化小镜子对话。首次生成后不变。 */
function genUserId(): string {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** 单本书「为什么适合你」的个性化文案（结合 MBTI×星座×需求），按 bookId+画像签名缓存。 */
export interface BookFit {
  why_for_you: string;
  key_focus: string[];
}

/** 综合画像缓存签名：MBTI + 星座 + 性别 + 语言任一变化就重新生成。 */
export function synthesisSignature(p: UserProfile | null): string {
  if (!p || !p.zodiac) return '';
  return [
    p.language,
    p.mbti,
    p.zodiac.sun_sign,
    p.zodiac.moon_sign ?? '',
    p.zodiac.rising_sign ?? '',
    p.zodiac.element,
    p.gender ?? '',
  ].join('|');
}

interface SynthesisCache {
  sig: string;
  profile: SynthesisProfile;
}

export interface CheckinDay {
  date: string;        // 'YYYY-MM-DD'
  pages: number;
}

export type SearchEngine = 'ask' | 'baidu' | 'google';

export interface Settings {
  language: Language;
  searchEngine?: SearchEngine;
}

const defaultSettings: Settings = { language: 'zh', searchEngine: 'ask' };

/** 本地时区的 'YYYY-MM-DD'。不能用 toISOString（那是 UTC，UTC+8 凌晨会算成昨天，
 *  导致打卡记录的日期和日历按本地时间画的格子对不上、绿点不显示）。 */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getSettings: () => getJSON<Settings>(KEYS.settings, defaultSettings),
  setSettings: (s: Settings) => setJSON(KEYS.settings, s),

  getLastResult: () => getJSON<RecommendationResponse | null>(KEYS.lastResult, null),
  setLastResult: (r: RecommendationResponse) => setJSON(KEYS.lastResult, r),

  // 推荐生成时同时存当时的 profile 签名；之后用来判断是否过期
  getRecommendSignature: () => getJSON<string>(KEYS.recommendSig, ''),
  setRecommendSignature: (sig: string) => setJSON(KEYS.recommendSig, sig),

  getUserProfile: () => getJSON<UserProfile | null>(KEYS.userProfile, null),
  setUserProfile: async (p: UserProfile) => {
    await setJSON(KEYS.userProfile, p);
    // 写档案时顺手同步到账号（跨设备恢复）；失败忽略，不阻塞本地。
    import('./api').then((m) => m.uploadAccountProfile(p)).catch(() => {});
  },

  /** 取（必要时生成）匿名用户 ID，用于小镜子后端持久化。登录后会被账号 user_id 覆盖。 */
  getUserId: async (): Promise<string> => {
    const existing = await AsyncStorage.getItem(KEYS.userId);
    if (existing) return existing;
    const id = genUserId();
    await AsyncStorage.setItem(KEYS.userId, id);
    return id;
  },
  /** 登录成功后用账号 user_id 覆盖匿名 ID，让对话/画像跟随账号。 */
  setUserId: (id: string) => AsyncStorage.setItem(KEYS.userId, id),

  // ---------- 账号登录态 ----------
  getAuthToken: () => AsyncStorage.getItem(KEYS.authToken),
  setAuthToken: (token: string) => AsyncStorage.setItem(KEYS.authToken, token),
  /** 已登录账号？（有 token 即视为已登录） */
  isAuthed: async (): Promise<boolean> => !!(await AsyncStorage.getItem(KEYS.authToken)),
  clearAuth: () => AsyncStorage.removeItem(KEYS.authToken),

  // 综合画像（MBTI × 星座）：缓存并按签名判断是否过期
  getSynthesis: async (sig: string): Promise<SynthesisProfile | null> => {
    const cached = await getJSON<SynthesisCache | null>(KEYS.synthesis, null);
    return cached && cached.sig === sig ? cached.profile : null;
  },
  setSynthesis: (sig: string, profile: SynthesisProfile) =>
    setJSON<SynthesisCache>(KEYS.synthesis, { sig, profile }),

  // 单本书个性化「为什么适合你」：按 bookId + 画像签名缓存，画像变了自动失效
  getBookFit: async (bookId: string, sig: string): Promise<BookFit | null> => {
    const map = await getJSON<Record<string, BookFit>>(KEYS.bookFit, {});
    return map[`${bookId}::${sig}`] ?? null;
  },
  setBookFit: async (bookId: string, sig: string, fit: BookFit): Promise<void> => {
    const map = await getJSON<Record<string, BookFit>>(KEYS.bookFit, {});
    map[`${bookId}::${sig}`] = fit;
    await setJSON(KEYS.bookFit, map);
  },

  appendFeedback: async (entry: Record<string, unknown>) => {
    const log = await getJSON<Record<string, unknown>[]>(KEYS.feedbackLog, []);
    log.push({ ts: new Date().toISOString(), ...entry });
    await setJSON(KEYS.feedbackLog, log);
  },

  // ---------- 首次启动标记 ----------
  getOnboarded: () => getJSON<boolean>(KEYS.onboarded, false),
  setOnboarded: (v: boolean) => setJSON(KEYS.onboarded, v),

  // ---------- 签到打卡 ----------
  getCheckinLog: () => getJSON<CheckinDay[]>(KEYS.checkinLog, []),
  getTodayCheckin: async (): Promise<CheckinDay | null> => {
    const today = localToday();
    const log = await getJSON<CheckinDay[]>(KEYS.checkinLog, []);
    return log.find((d) => d.date === today) ?? null;
  },
  /** 在 App 内点开书阅读时自动打卡：今天若还没打卡，记 1 页（标记为已读一天）。 */
  ensureTodayCheckin: async (): Promise<CheckinDay> => {
    const today = localToday();
    const log = await getJSON<CheckinDay[]>(KEYS.checkinLog, []);
    let day = log.find((d) => d.date === today);
    if (!day) {
      day = { date: today, pages: 1 };
      log.push(day);
      await setJSON(KEYS.checkinLog, log);
    }
    return day;
  },
  addPages: async (pages: number): Promise<CheckinDay> => {
    const today = localToday();
    const log = await getJSON<CheckinDay[]>(KEYS.checkinLog, []);
    const existing = log.find((d) => d.date === today);
    if (existing) {
      existing.pages += pages;
    } else {
      log.push({ date: today, pages });
    }
    await setJSON(KEYS.checkinLog, log);
    return log.find((d) => d.date === today)!;
  },

  // ---------- 阅读器设置 ----------
  getReaderSettings: () => getJSON<ReaderSettings>(KEYS.readerSettings, DEFAULT_READER_SETTINGS),
  setReaderSettings: (s: ReaderSettings) => setJSON(KEYS.readerSettings, s),

  // ---------- 收藏的句子（小镜子聊天里收藏的话） ----------
  getSavedSentences: () => getJSON<string[]>(KEYS.savedSentences, []),
  saveSentence: async (text: string): Promise<void> => {
    const t = text.trim();
    if (!t) return;
    const list = await getJSON<string[]>(KEYS.savedSentences, []);
    if (list.includes(t)) return;
    await setJSON(KEYS.savedSentences, [t, ...list].slice(0, 500));
  },

  // ---------- 收藏（存整本书，任意来源的书都能收藏） ----------
  getFavorites: () => getJSON<Book[]>(KEYS.favorites, []),
  /** 覆盖收藏列表（用于用最新书数据重新水合，补上英文字段等） */
  setFavorites: (list: Book[]) => setJSON(KEYS.favorites, list),
  isFavorite: async (bookId: string): Promise<boolean> => {
    const list = await getJSON<Book[]>(KEYS.favorites, []);
    return list.some((b) => b.id === bookId);
  },
  /** 收藏/取消收藏，返回操作后是否处于已收藏状态 */
  toggleFavorite: async (book: Book): Promise<boolean> => {
    const list = await getJSON<Book[]>(KEYS.favorites, []);
    const idx = list.findIndex((b) => b.id === book.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      await setJSON(KEYS.favorites, list);
      return false;
    }
    list.unshift(book);
    await setJSON(KEYS.favorites, list);
    return true;
  },

  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
