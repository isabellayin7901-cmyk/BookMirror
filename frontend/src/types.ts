export type MBTI =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export type Language = 'zh' | 'en';

export interface Birthday {
  year: number;
  month: number;
  day: number;
  hour: number;   // 0-23
  minute: number; // 0-59
}

export interface PlanetPosition {
  sign: string;
  longitude: number;
}

export interface ChartData {
  sun: PlanetPosition;
  moon: PlanetPosition;
  mercury?: PlanetPosition;
  venus?: PlanetPosition;
  mars?: PlanetPosition;
  jupiter?: PlanetPosition;
  saturn?: PlanetPosition;
  ascendant?: PlanetPosition;
  houses?: number[];        // 12 个 cusp 经度
  mc_longitude?: number;
}

export interface ZodiacReading {
  sun_sign: string;
  moon_sign?: string;
  rising_sign?: string;
  element: string;
  description: string;
  keywords: string[];
  chart?: ChartData;
  // 生成这段画像文案时用的语言（用于语言切换后自动重新生成英文/中文描述）
  language?: Language;
}

export interface SynthesisProfile {
  title: string;
  description: string;
  strengths: string[];
  blindspots: string[];
  keywords: string[];
}

export type Gender = 'female' | 'male' | 'other';

export interface Birthplace {
  region: string;             // 省份 / 国家
  scope: 'cn' | 'world';
  city: { name: string; latitude: number; longitude: number };
}

export interface UserProfile {
  mbti: MBTI;
  mbti_source: 'self' | 'quiz';
  goals: string[];
  preferences: string[];
  depth: number;
  problems: string[];
  free_text: string;
  language: Language;
  birthday?: Birthday;
  birthplace?: Birthplace;
  zodiac?: ZodiacReading;
  gender?: Gender;
  /** 用户名（显示在我的账号 + 今日好书侧边栏「xx 的小书房」）。 */
  username?: string;
  /** 个性签名（个人主页展示）。 */
  signature?: string;
  /** 小镜子聊天积累的心理画像（可选，荐书时让主页推荐更贴近真实状态）。 */
  mirror_portrait?: string;
  /** 职业 / 专业 / 简介（可选，用于更贴合的推荐）。 */
  occupation?: string;
  major?: string;
  /** 是否希望推荐与专业相关的书。 */
  major_relevant?: boolean;
  bio?: string;
  /** 自定义头像本地 URI（来自相册）；缺省用雪人 Wren。 */
  avatarUri?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  title_en?: string;
  author_en?: string;
  isbn?: string;
  cover_url?: string;
  language: Language;
  category: string;
  difficulty: number;
  mbti_fit: string[];
  topics: string[];
  problems_solved: string[];
  stage: string[];
  summary: string;
  summary_en?: string;
  key_chapters: string[];
  key_chapters_en?: string[];
  purchase_links: Record<string, string>;
}

// ===== 多语言阅读：同一本书的不同版本 =====

/** 版本语言。lzh = 文言（古汉语），与现代中文 zh 区分开，AI 翻译会据此判断。 */
export type EditionLang = 'lzh' | 'zh' | 'en';

/** 一本书可读的某个版本（原文 / 中文译本 / 英文译本…）。
 *  各版本的章节按 index 对齐，同一章的「好句与讨论」在所有版本间共享。 */
export interface BookEdition {
  id: string;                   // 版本 ID，写进好句/笔记的 edition 字段
  lang: EditionLang;
  kind: 'original' | 'translation';
  label: string;                // 界面显示名（中文）
  labelEn: string;              // 界面显示名（英文）
  translator?: string;
  /** 出处与版权说明，示例书必须写清楚 */
  source: string;
}

/** 章节信息的来源：原书自带 / AI 辅助识别 / 人工修正。优先用原书的。 */
export type ChapterSource = 'book' | 'ai' | 'manual';

/** 阅读内容语言偏好（与界面语言独立）：打开书时优先选哪个版本。 */
export type ContentLanguagePref = 'original' | 'zh' | 'en';

/** 界面语言模式：跟随手机系统，或手动指定。 */
export type UiLanguageMode = 'system' | Language;

// ===== 地区：决定展示哪些购书/阅读平台 =====

/** 用户所在地区（ISO 3166-1 两位国家码，如 CN / US / GB / HK）。 */
export interface RegionInfo {
  country: string | null;
  /** ip = 服务器按网络判断；device = 手机系统地区推断；manual = 用户手动设置 */
  source: 'ip' | 'device' | 'manual';
}

export interface BookRecommendation {
  book_id: string;
  order: number;
  why_for_you: string;
  key_focus: string[];
}

export interface RecommendationResponse {
  profile: { description: string; keywords: string[] };
  growth_gaps: string[];
  recommendations: BookRecommendation[];
  books: Book[];
  more_books?: Book[];
}

export type FeedbackReaction = 'useful' | 'too_hard' | 'not_interested' | 'want_similar';

export type RootStackParamList = {
  Tabs: undefined;
  LanguageSelect: undefined;
  Auth: { onboarding?: boolean } | undefined;
  PhoneAuth: { onboarding?: boolean } | undefined;
  Quiz: { onboarding?: boolean } | undefined;
  Result: { result: RecommendationResponse; onboarding?: boolean } | undefined;
  Feedback: { books: Book[] };
  BookReview: { book: Book };
  Growth: undefined;
  ProfileHome: { userId?: string } | undefined;
  SocialList: { userId: string; type: 'fans' | 'following' | 'friends' | 'visitors' };
  AddFriend: undefined;
  DMChat: { peerId: string; peerName?: string; peerAvatar?: string | null };
  ReaderHome: undefined;
  Reader: { bookId: string; title?: string };
  Privacy: undefined;
  Settings: undefined;
  Profile: undefined;
  Persona: { onboarding?: boolean } | undefined;
  Astrology: { onboarding?: boolean } | undefined;
  AstrologyResult: { onboarding?: boolean } | undefined;
  Gender: { onboarding?: boolean } | undefined;
  MirrorChat: undefined;
};

export type TabParamList = {
  TodayBooks: undefined;
  LittleWorld: undefined;
  MyAccount: undefined;
  MyFavorites: undefined;
};
