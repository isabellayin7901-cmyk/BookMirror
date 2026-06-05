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
  imageUri?: string | null;   // 本地图片 URI（用户发的图片，仅本地显示）
}

export interface MirrorChatContext {
  mbti?: string;
  zodiac?: { sun_sign?: string; moon_sign?: string; element?: string };
  gender?: string;
}

export interface Conversation {
  id: string;
  title: string;
  project_id?: string | null;
  updated_at?: string | null;
  preview?: string;
}
export interface MirrorProject { id: string; name: string; }

/** 列出该用户的所有对话 + 项目。 */
export async function listConversations(userId: string): Promise<{ conversations: Conversation[]; projects: MirrorProject[] }> {
  const res = await fetch(`${baseUrl}/api/mirror/conversations?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders() });
  if (!res.ok) return { conversations: [], projects: [] };
  return res.json();
}
export async function createConversation(userId: string, title = '', projectId?: string): Promise<Conversation> {
  const res = await fetch(`${baseUrl}/api/mirror/conversations`, {
    method: 'POST', headers: authHeaders(true),
    body: JSON.stringify({ user_id: userId, title, project_id: projectId ?? null }),
  });
  if (!res.ok) throw new Error(`Create conversation failed (${res.status})`);
  return res.json();
}
export async function updateConversation(convId: string, userId: string, patch: { title?: string; project_id?: string }): Promise<void> {
  const res = await fetch(`${baseUrl}/api/mirror/conversations/${encodeURIComponent(convId)}`, {
    method: 'PATCH', headers: authHeaders(true),
    body: JSON.stringify({ user_id: userId, ...patch }),
  });
  if (!res.ok) throw new Error(`Update conversation failed (${res.status})`);
}
export async function deleteConversation(convId: string, userId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/mirror/conversations/${encodeURIComponent(convId)}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete conversation failed (${res.status})`);
}
export async function createProject(userId: string, name: string): Promise<MirrorProject> {
  const res = await fetch(`${baseUrl}/api/mirror/projects`, {
    method: 'POST', headers: authHeaders(true),
    body: JSON.stringify({ user_id: userId, name }),
  });
  if (!res.ok) throw new Error(`Create project failed (${res.status})`);
  return res.json();
}

/** 发一句话/一张图给小镜子，拿回它的回复（后端持久化整段对话）。 */
export async function mirrorChat(payload: {
  user_id: string;
  message: string;
  context?: MirrorChatContext;
  language: Language;
  conversation_id?: string | null;
  image_base64?: string;       // 图片 base64（不含 data: 前缀）
  image_media_type?: string;   // 如 image/jpeg
}): Promise<{ reply: string; book?: Book | null; conversation_id?: string }> {
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

/** 拉取某段对话的历史（换设备/重装后从后端恢复）。 */
export async function fetchMirrorHistory(userId: string, conversationId?: string | null): Promise<MirrorMessage[]> {
  const q = conversationId ? `&conversation_id=${encodeURIComponent(conversationId)}` : '';
  const res = await fetch(
    `${baseUrl}/api/mirror/history?user_id=${encodeURIComponent(userId)}${q}`,
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

export interface UserReviewItem {
  book?: Book | null;
  rating: number;
  emotions: string[];
  text: string;
  created_at?: string | null;
}
/** 某用户写过的所有书评（个人主页用）。 */
export async function fetchUserReviews(userId: string): Promise<UserReviewItem[]> {
  try {
    const res = await fetch(`${baseUrl}/api/reviews/by-user?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
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

// ---------- 社交系统：关注 / 粉丝 / 朋友 / 访客 / 公开主页 ----------

export interface SocialCounts {
  fans: number;
  following: number;
  friends: number;
  visitors: number;
}

export interface PublicProfile {
  user_id: string;
  handle: string;
  username: string;
  signature: string;
  avatar_url: string | null;
  mbti: string | null;
  zodiac_sun: string | null;
  zodiac_element: string | null;
  gender: string | null;
  occupation: string | null;
  major: string | null;
  counts: SocialCounts;
  is_following: boolean;
  is_mutual: boolean;
  is_self: boolean;
  show_reviews: boolean;
  show_favorites: boolean;
}

export interface SocialUserCard {
  user_id: string;
  handle: string;
  username: string;
  signature: string;
  avatar_url: string | null;
  mbti: string | null;
}

export interface PrivacySettings {
  hideSignature: boolean;
  hideInfo: boolean;
  hideReviews: boolean;
  hideFavorites: boolean;
  hideVisitors: boolean;
}

/** 看某人的公开主页（viewerId 用于记录访客 + 计算关注关系）。 */
export async function fetchPublicProfile(userId: string, viewerId: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(
      `${baseUrl}/api/social/profile?user_id=${encodeURIComponent(userId)}&viewer_id=${encodeURIComponent(viewerId)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function followUser(followerId: string, followeeId: string): Promise<{ following: boolean; mutual: boolean }> {
  const res = await fetch(`${baseUrl}/api/social/follow`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ follower_id: followerId, followee_id: followeeId }),
  });
  if (!res.ok) throw new Error(`follow failed (${res.status})`);
  return res.json();
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<{ following: boolean; mutual: boolean }> {
  const res = await fetch(`${baseUrl}/api/social/unfollow`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ follower_id: followerId, followee_id: followeeId }),
  });
  if (!res.ok) throw new Error(`unfollow failed (${res.status})`);
  return res.json();
}

/** 关系列表（type: fans→followers / following / friends / visitors）。 */
export async function fetchSocialList(
  userId: string,
  type: 'fans' | 'following' | 'friends' | 'visitors',
): Promise<SocialUserCard[]> {
  const path = type === 'fans' ? 'followers' : type;
  try {
    const res = await fetch(`${baseUrl}/api/social/${path}?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchPrivacy(userId: string): Promise<PrivacySettings> {
  try {
    const res = await fetch(`${baseUrl}/api/social/privacy?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders() });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { hideSignature: false, hideInfo: false, hideReviews: false, hideFavorites: false, hideVisitors: false };
  }
}

export async function savePrivacy(userId: string, p: PrivacySettings): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/social/privacy`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ user_id: userId, ...p }),
    });
  } catch {
    /* best-effort */
  }
}

/** 把本地收藏的 book_id 同步到服务器，供别人查看「ta 的收藏」。 */
export async function syncFavorites(userId: string, bookIds: string[]): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/social/favorites/sync`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ user_id: userId, book_ids: bookIds }),
    });
  } catch {
    /* best-effort */
  }
}

/** 取某人公开收藏的 book_id 列表。 */
export async function fetchFavoriteIds(userId: string, viewerId: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/social/favorites?user_id=${encodeURIComponent(userId)}&viewer_id=${encodeURIComponent(viewerId)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.book_ids || [];
  } catch {
    return [];
  }
}

/** 取我的 ID（没有则后端自动生成 9 位）。 */
export async function fetchMyId(userId: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/social/my-id?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders() });
    if (!res.ok) return '';
    const data = await res.json();
    return data.handle || '';
  } catch {
    return '';
  }
}

/** 修改我的 ID。成功返回新 ID；失败抛出带中文/英文提示的错误。 */
export async function updateMyId(userId: string, handle: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/social/my-id`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ user_id: userId, handle }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch { /* ignore */ }
    throw new Error(detail || `update id failed (${res.status})`);
  }
  const data = await res.json();
  return data.handle || handle;
}

// ---------- 好友私信（DM） ----------

export interface DMMessage {
  id: number;
  from_me: boolean;
  content: string;
  image_url?: string | null;
  created_at: string | null;
  read: boolean;
}

export interface DMConversation {
  peer: SocialUserCard;
  last_content: string;
  last_image?: boolean;
  last_from_me: boolean;
  last_at: string | null;
  unread: number;
}

export interface DMIncoming {
  id: number;
  sender: SocialUserCard;
  content: string;
  image_url?: string | null;
  created_at: string | null;
}

/** 把后端相对地址（/uploads/xxx）补全成完整 URL，给 <Image> 用。 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${baseUrl}${path}`;
}

/** 上传图片（base64）→ 返回相对地址 /uploads/xxx。 */
export async function uploadImage(base64: string, mediaType = 'image/jpeg'): Promise<string> {
  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ data: base64, media_type: mediaType }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch { /* ignore */ }
    throw new Error(detail || `upload failed (${res.status})`);
  }
  return (await res.json()).url;
}

export async function sendDM(senderId: string, receiverId: string, content: string, imageUrl?: string): Promise<DMMessage> {
  const res = await fetch(`${baseUrl}/api/dm/send`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ sender_id: senderId, receiver_id: receiverId, content, image_url: imageUrl || null }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail || ''; } catch { /* ignore */ }
    throw new Error(detail || `send failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDMHistory(userId: string, peerId: string, afterId = 0): Promise<DMMessage[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/dm/history?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}&after_id=${afterId}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchConversations(userId: string): Promise<DMConversation[]> {
  try {
    const res = await fetch(`${baseUrl}/api/dm/conversations?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchIncoming(userId: string, afterId: number): Promise<DMIncoming[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/dm/incoming?user_id=${encodeURIComponent(userId)}&after_id=${afterId}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function markDMRead(userId: string, peerId: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/dm/read`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ user_id: userId, peer_id: peerId }),
    });
  } catch {
    /* best-effort */
  }
}

/** 上报本机推送 token，绑定到账号。 */
export async function registerPushToken(userId: string, token: string, platform: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/push/register`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ user_id: userId, token, platform }),
    });
  } catch {
    /* best-effort */
  }
}

export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/push/unregister`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ token }),
    });
  } catch {
    /* best-effort */
  }
}

/** 按 ID 或用户名搜索用户。 */
export async function searchUsers(q: string, viewerId: string): Promise<SocialUserCard[]> {
  try {
    const res = await fetch(
      `${baseUrl}/api/social/search?q=${encodeURIComponent(q)}&viewer_id=${encodeURIComponent(viewerId)}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
