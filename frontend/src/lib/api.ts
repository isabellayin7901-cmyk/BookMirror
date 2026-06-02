import Constants from 'expo-constants';
import type {
  Book,
  FeedbackReaction,
  Language,
  MBTI,
  RecommendationResponse,
  UserProfile,
} from '../types';
import type { MbtiAnswer } from '../data/mbtiQuestions';
import type { Birthday, SynthesisProfile, ZodiacReading } from '../types';

const extra = Constants.expoConfig?.extra as
  | { apiBaseUrl?: string; appToken?: string }
  | undefined;

const baseUrl = extra?.apiBaseUrl ?? 'http://localhost:8000';
const appToken = extra?.appToken ?? '';

/** 所有请求统一带上访问令牌；POST 再加 JSON 头。 */
function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (appToken) h['X-App-Token'] = appToken;
  return h;
}

export async function fetchRecommendation(
  profile: UserProfile,
): Promise<RecommendationResponse> {
  // 尽力补上小镜子画像，让主页推荐更贴近用户真实状态（失败不影响推荐）。
  let body: UserProfile = profile;
  if (!profile.mirror_portrait) {
    try {
      const { storage } = await import('./storage');
      const uid = await storage.getUserId();
      if (uid) {
        const mp = await fetchMirrorProfile(uid);
        if (mp.summary) body = { ...profile, mirror_portrait: mp.summary };
      }
    } catch {
      /* best-effort，忽略 */
    }
  }
  const res = await fetch(`${baseUrl}/api/recommend`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Recommend failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/** 按 id 批量取最新书数据（用于收藏列表重新水合，补上英文字段） */
export async function fetchBooksByIds(ids: string[]): Promise<Book[]> {
  const wanted = ids.filter(Boolean);
  if (wanted.length === 0) return [];
  const res = await fetch(
    `${baseUrl}/api/books/by-ids?ids=${encodeURIComponent(wanted.join(','))}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    throw new Error(`Fetch by ids failed (${res.status})`);
  }
  return res.json();
}

/** 全库搜索：书名 / 作者 / 简介关键词 */
export async function searchBooks(q: string, limit = 30): Promise<Book[]> {
  const query = q.trim();
  if (!query) return [];
  const res = await fetch(
    `${baseUrl}/api/books/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`);
  }
  return res.json();
}

export interface MbtiInferenceResponse {
  mbti: MBTI;
  confidence: number;
  reasoning: string;
}

export async function inferMbti(
  answers: MbtiAnswer[],
  mode: 'quick' | 'full',
  language: Language,
): Promise<MbtiInferenceResponse> {
  const res = await fetch(`${baseUrl}/api/mbti`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ answers, mode, language }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`MBTI inference failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function analyzeAstrology(
  birthday: Birthday,
  language: Language,
  location?: { latitude: number; longitude: number },
): Promise<ZodiacReading> {
  const res = await fetch(`${baseUrl}/api/astrology`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      ...birthday,
      language,
      latitude: location?.latitude,
      longitude: location?.longitude,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Astrology failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function fetchSynthesis(payload: {
  mbti: MBTI;
  sun_sign: string;
  element: string;
  moon_sign?: string;
  rising_sign?: string;
  gender?: 'female' | 'male' | 'other';
  language: Language;
}): Promise<SynthesisProfile> {
  const res = await fetch(`${baseUrl}/api/synthesis`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Synthesis failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export interface BookFitResponse {
  why_for_you: string;
  key_focus: string[];
}

/** 结合用户 MBTI×星座综合画像 + 需求，点对点解释这本书为什么适合 ta */
export async function fetchBookFit(payload: {
  book_title: string;
  book_author?: string;
  book_summary?: string;
  book_topics?: string[];
  book_category?: string;
  book_difficulty?: number;
  mbti?: string;
  sun_sign?: string;
  moon_sign?: string;
  rising_sign?: string;
  element?: string;
  goals?: string[];
  problems?: string[];
  preferences?: string[];
  free_text?: string;
  language: Language;
}): Promise<BookFitResponse> {
  const res = await fetch(`${baseUrl}/api/book-fit`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Book fit failed (${res.status}): ${detail}`);
  }
  return res.json();
}

// ----------------------------- 小镜子 Little Mirror -----------------------------

export interface MirrorMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string | null; // ISO 时间，前端画时间线分割用
  book?: Book | null;         // 小镜子在这条消息里推荐的真实书（可点书卡）
}

export interface MirrorChatContext {
  mbti?: string;
  zodiac?: { sun_sign?: string; moon_sign?: string; element?: string };
  gender?: string;
}

/** 发一句话给小镜子，拿回它的回复（后端持久化整段对话）。 */
export async function mirrorChat(payload: {
  user_id: string;
  message: string;
  context?: MirrorChatContext;
  language: Language;
}): Promise<{ reply: string; book?: Book | null }> {
  const res = await fetch(`${baseUrl}/api/mirror/chat`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mirror chat failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/** 拉取历史对话（换设备/重装后从后端恢复）。 */
export async function fetchMirrorHistory(userId: string): Promise<MirrorMessage[]> {
  const res = await fetch(
    `${baseUrl}/api/mirror/history?user_id=${encodeURIComponent(userId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Mirror history failed (${res.status})`);
  const data = await res.json();
  return data.messages ?? [];
}

export interface MirrorProfileResponse {
  summary: string;
  traits: string[];
  keywords: string[];
  message_count: number;
}

/** 拉取小镜子从对话中提炼的心理画像。 */
export async function fetchMirrorProfile(userId: string): Promise<MirrorProfileResponse> {
  const res = await fetch(
    `${baseUrl}/api/mirror/profile?user_id=${encodeURIComponent(userId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Mirror profile failed (${res.status})`);
  return res.json();
}

/** 清空小镜子的全部对话与心理画像。 */
export async function deleteMirrorHistory(userId: string): Promise<void> {
  const res = await fetch(
    `${baseUrl}/api/mirror/history?user_id=${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Mirror reset failed (${res.status})`);
}

// ---------- 读后反馈「三合一」：评分 + 书评 + 成长自评 ----------

export type Difficulty = 'too_easy' | 'just_right' | 'too_hard';

export interface Review {
  id: number;
  user_id: string;
  book_id: string;
  rating: number;
  difficulty: Difficulty;
  emotions: string[];
  text: string;
  recommend_similar: boolean;
  anonymous: boolean;
  mbti?: string | null;
  growth: Record<string, { before: number; after: number }>;
  helped_problems: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReviewInput {
  user_id: string;
  book_id: string;
  rating: number;
  difficulty: Difficulty;
  emotions: string[];
  text: string;
  recommend_similar: boolean;
  anonymous: boolean;
  mbti?: string | null;
  growth: Record<string, { before: number; after: number }>;
  helped_problems: string[];
}

export interface GrowthDimension {
  dimension: string;
  total_delta: number;
  latest_after: number;
  count: number;
  points: { book_id: string; before: number; after: number; created_at?: string | null }[];
}

export interface GrowthData {
  dimensions: GrowthDimension[];
  helped_problem_counts: Record<string, number>;
  review_count: number;
}

/** 提交/覆盖自己对某本书的读后反馈。 */
export async function submitReview(input: ReviewInput): Promise<Review> {
  const res = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Submit review failed (${res.status})`);
  return res.json();
}

/** 某本书的全部书评（书详情页展示）。 */
export async function fetchBookReviews(bookId: string): Promise<Review[]> {
  const res = await fetch(`${baseUrl}/api/reviews?book_id=${encodeURIComponent(bookId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Fetch reviews failed (${res.status})`);
  return res.json();
}

/** 取自己对某本书的反馈（回填表单）；没有则 null。 */
export async function fetchMyReview(userId: string, bookId: string): Promise<Review | null> {
  const res = await fetch(
    `${baseUrl}/api/reviews/mine?user_id=${encodeURIComponent(userId)}&book_id=${encodeURIComponent(bookId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  return res.json();
}

/** 删除自己对某本书的反馈。 */
export async function deleteReview(userId: string, bookId: string): Promise<void> {
  const res = await fetch(
    `${baseUrl}/api/reviews?user_id=${encodeURIComponent(userId)}&book_id=${encodeURIComponent(bookId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Delete review failed (${res.status})`);
}

/** 跨书聚合的成长数据（成长曲线 + 解决的问题）。 */
export async function fetchGrowth(userId: string): Promise<GrowthData> {
  const res = await fetch(`${baseUrl}/api/growth?user_id=${encodeURIComponent(userId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Fetch growth failed (${res.status})`);
  return res.json();
}

export interface ShapingReport {
  available: boolean;
  summary: string;
  strengthening: string[];
  shifts: string[];
  encouragement: string;
  finished_count: number;
}

/** 生成阅读塑造报告（LLM 结合 MBTI + 阅读史 + 成长，不改 MBTI）。 */
export async function fetchShapingReport(mbti: string | undefined, language: Language): Promise<ShapingReport> {
  const { storage } = await import('./storage');
  const uid = await storage.getUserId();
  const res = await fetch(`${baseUrl}/api/shaping-report`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ user_id: uid, mbti: mbti ?? null, language }),
  });
  if (!res.ok) throw new Error(`Shaping report failed (${res.status})`);
  return res.json();
}

/** 算一批书的 Mirror Score（这本书有没有帮到这个人，0-100）。失败返回空。 */
export async function fetchMirrorScores(
  profile: UserProfile,
  bookIds: string[],
): Promise<Record<string, number>> {
  if (bookIds.length === 0) return {};
  try {
    const { storage } = await import('./storage');
    const uid = await storage.getUserId();
    const res = await fetch(`${baseUrl}/api/mirror-score`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ profile, book_ids: bookIds, user_id: uid }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.scores ?? {};
  } catch {
    return {};
  }
}

// ---------- 阅读状态：想读 / 在读 / 读完 ----------

export type ReadingKind = 'want' | 'reading' | 'finished';

export interface ReadingStatus {
  book_id: string;
  status: ReadingKind;
  current_page: number;
  total_pages: number;
  progress: number; // 0-1
  started_at?: string | null;
  finished_at?: string | null;
}

/** 取某本书的阅读状态；没有返回 null。 */
export async function getReadingStatus(userId: string, bookId: string): Promise<ReadingStatus | null> {
  const res = await fetch(
    `${baseUrl}/api/reading/book?user_id=${encodeURIComponent(userId)}&book_id=${encodeURIComponent(bookId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  return res.json();
}

/** 设置/更新某本书的阅读状态或进度（进度到顶会自动判定读完）。 */
export async function setReadingStatus(input: {
  user_id: string;
  book_id: string;
  status?: ReadingKind;
  current_page?: number;
  total_pages?: number;
}): Promise<ReadingStatus> {
  const res = await fetch(`${baseUrl}/api/reading`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Set reading status failed (${res.status})`);
  return res.json();
}

export async function submitFeedback(payload: {
  book_id: string;
  reaction: FeedbackReaction;
  note?: string;
  user_profile?: UserProfile;
}): Promise<void> {
  const res = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Feedback failed (${res.status})`);
  }
}

// ---------- 账号系统：手机号验证码登录/注册 ----------

export interface RequestCodeResult {
  sent: boolean;
  dev_code?: string | null; // 仅 mock 开发模式回传
}

export interface AuthResult {
  token: string;
  user_id: string;
  is_new: boolean;
}

/** 请求短信验证码。countryCode 形如 "+86"，phone 为纯数字。 */
export async function requestPhoneCode(
  countryCode: string,
  phone: string,
): Promise<RequestCodeResult> {
  const res = await fetch(`${baseUrl}/api/auth/request-code`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ country_code: countryCode, phone }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Request code failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/** 校验验证码，自动注册或登录，返回 token / user_id / is_new。 */
export async function verifyPhoneCode(
  countryCode: string,
  phone: string,
  code: string,
): Promise<AuthResult> {
  const res = await fetch(`${baseUrl}/api/auth/verify-code`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ country_code: countryCode, phone, code }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Verify code failed (${res.status}): ${detail}`);
  }
  return res.json();
}

// ---------- 账号档案同步（性别/星座/MBTI/用户名 等，跨设备恢复） ----------

const SYNCED_KEYS: (keyof UserProfile)[] = [
  'username', 'gender', 'mbti', 'mbti_source', 'occupation', 'major',
  'major_relevant', 'bio', 'zodiac', 'birthday', 'goals', 'preferences',
  'problems', 'depth', 'free_text', 'language',
];

/** 把本地档案上传到账号（best-effort，失败忽略）。 */
export async function uploadAccountProfile(profile: UserProfile): Promise<void> {
  try {
    const { storage } = await import('./storage');
    const uid = await storage.getUserId();
    if (!uid) return;
    const data: Record<string, unknown> = {};
    for (const k of SYNCED_KEYS) {
      if (profile[k] !== undefined) data[k] = profile[k];
    }
    await fetch(`${baseUrl}/api/account-profile`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ user_id: uid, data }),
    });
  } catch {
    /* best-effort */
  }
}

/** 从账号拉取档案。 */
export async function fetchAccountProfile(): Promise<Partial<UserProfile>> {
  try {
    const { storage } = await import('./storage');
    const uid = await storage.getUserId();
    if (!uid) return {};
    const res = await fetch(`${baseUrl}/api/account-profile?user_id=${encodeURIComponent(uid)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return {};
    const json = await res.json();
    return (json.data ?? {}) as Partial<UserProfile>;
  } catch {
    return {};
  }
}

/** 拉取账号档案并合并进本地（本地优先，避免覆盖本机较新的修改）。 */
export async function hydrateAccountProfile(): Promise<void> {
  const remote = await fetchAccountProfile();
  if (!remote || Object.keys(remote).length === 0) return;
  const { storage } = await import('./storage');
  const local = await storage.getUserProfile();
  const merged = { ...remote, ...(local ?? {}) } as UserProfile;
  await storage.setUserProfile(merged);
}

export interface MeResult {
  user_id: string;
  phone?: string | null;
  country_code?: string | null;
  provider?: string | null; // 'google' | 'apple' | 'wechat' | null(手机号)
}

/** 取当前登录账号信息（登录方式等）。未登录返回 null。 */
export async function getMe(): Promise<MeResult | null> {
  const { storage } = await import('./storage');
  const token = await storage.getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { ...authHeaders(), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 用 Google idToken 登录/注册，返回 token / user_id / is_new。 */
export async function googleLogin(idToken: string): Promise<AuthResult> {
  const res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google login failed (${res.status}): ${detail}`);
  }
  return res.json();
}
