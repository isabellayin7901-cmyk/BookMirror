import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Bunny } from '../illustrations/Bunny';
import { Cat } from '../illustrations/Cat';
import { Sparkle, Heart, Leaf } from '../illustrations/Sparkle';
import { WavyUnderline, DashDivider } from '../illustrations/Doodle';
import { storage, profileSignature, type CheckinDay } from '../lib/storage';
import { fetchRecommendation, searchBooks, fetchBookFit } from '../lib/api';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle, bookAuthor, bookSummary } from '../lib/bookDisplay';
import { Drawer } from '../components/Drawer';
import { CheckinCalendar } from '../components/CheckinCalendar';
import { BookDetailModal } from '../components/BookDetailModal';
import { randomQuote, type BookQuote } from '../data/quotes';
import type { Book, BookRecommendation, RecommendationResponse, RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TodayBooksScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [lastResult, setLastResult] = useState<RecommendationResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkin, setCheckin] = useState<CheckinDay | null>(null);
  const [pagesInput, setPagesInput] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkinLog, setCheckinLog] = useState<CheckinDay[]>([]);
  const [quote, setQuote] = useState<BookQuote | null>(null);
  const [selectedBook, setSelectedBook] = useState<{ book: Book; rec: BookRecommendation } | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [moreBatch, setMoreBatch] = useState<Book[]>([]);  // "更多好书"当前展示的 18 本
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchBooks(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => runSearch(searchQuery), 350);
    return () => clearTimeout(handle);
  }, [searchQuery, runSearch]);

  const shuffleMoreBooks = useCallback((pool: Book[] | undefined) => {
    if (!pool || pool.length === 0) {
      setMoreBatch([]);
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setMoreBatch(shuffled.slice(0, 18));
  }, []);

  // 点开「更多适合你」里的书：结合 MBTI×星座×需求，实时生成「为什么适合你」
  const openMoreBook = useCallback(async (book: Book) => {
    // 先以占位 rec 打开弹窗，再异步补上个性化文案
    setSelectedBook({
      book,
      rec: { book_id: book.id, order: 0, why_for_you: '', key_focus: [] },
    });
    setRecLoading(true);

    const apply = (fit: { why_for_you: string; key_focus: string[] }) =>
      setSelectedBook((cur) =>
        cur && cur.book.id === book.id
          ? { book: cur.book, rec: { ...cur.rec, why_for_you: fit.why_for_you, key_focus: fit.key_focus } }
          : cur,
      );

    try {
      const sig = profileSignature(profile);
      const cached = sig ? await storage.getBookFit(book.id, sig) : null;
      if (cached) {
        apply(cached);
        return;
      }
      const fit = await fetchBookFit({
        book_title: bookTitle(book, lang),
        book_author: bookAuthor(book, lang),
        book_summary: bookSummary(book, lang),
        book_topics: book.topics,
        book_category: book.category,
        book_difficulty: book.difficulty,
        mbti: profile?.mbti,
        sun_sign: profile?.zodiac?.sun_sign,
        moon_sign: profile?.zodiac?.moon_sign,
        rising_sign: profile?.zodiac?.rising_sign,
        element: profile?.zodiac?.element,
        goals: profile?.goals,
        problems: profile?.problems,
        preferences: profile?.preferences,
        free_text: profile?.free_text,
        language: lang,
      });
      apply(fit);
      if (sig) await storage.setBookFit(book.id, sig, fit);
    } catch {
      // 失败时退回通用文案，至少有内容可看
      apply({ why_for_you: t('today.moreWhy'), key_focus: book.key_chapters });
    } finally {
      setRecLoading(false);
    }
  }, [profile, lang, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const prof = await storage.getUserProfile();
      if (prof) {
        const result = await fetchRecommendation(prof);
        await storage.setLastResult(result);
        await storage.setRecommendSignature(profileSignature(prof));
        setLastResult(result);
        setQuote(randomQuote(result.books));
        shuffleMoreBooks(result.more_books);
      }
      setCheckin(await storage.getTodayCheckin());
      setCheckinLog(await storage.getCheckinLog());
    } catch {
      /* 静默失败，下拉刷新不打扰 */
    } finally {
      setRefreshing(false);
    }
  }, [shuffleMoreBooks]);

  const load = useCallback(async () => {
    const result = await storage.getLastResult();
    const prof = await storage.getUserProfile();
    setLastResult(result);
    setProfile(prof);
    setCheckin(await storage.getTodayCheckin());
    setCheckinLog(await storage.getCheckinLog());
    if (result?.books) {
      setQuote(randomQuote(result.books));
      shuffleMoreBooks(result.more_books);
    } else {
      setQuote(null);
      setMoreBatch([]);
    }

    // 🌟 自动刷新条件：
    //   1) profile 签名变了
    //   2) 缓存格式旧（没有 more_books）
    //   3) 推荐数量不够 6 本（之前的旧推荐）
    if (prof && result) {
      const currentSig = profileSignature(prof);
      const savedSig = await storage.getRecommendSignature();
      const isStaleFormat = !result.more_books || result.more_books.length === 0;
      const isTooFew = result.recommendations.length < 6;
      if (
        (currentSig && savedSig && currentSig !== savedSig) ||
        isStaleFormat ||
        isTooFew
      ) {
        autoRefresh(prof);
      }
    }
  }, [shuffleMoreBooks]);

  const autoRefresh = async (prof: UserProfile) => {
    setRetrying(true);
    try {
      const result = await fetchRecommendation(prof);
      await storage.setLastResult(result);
      await storage.setRecommendSignature(profileSignature(prof));
      setLastResult(result);
      setQuote(randomQuote(result.books));
      shuffleMoreBooks(result.more_books);
    } catch {
      /* 静默失败 */
    } finally {
      setRetrying(false);
    }
  };

  const retryRecommendation = async () => {
    if (!profile) return;
    setRetrying(true);
    try {
      const result = await fetchRecommendation(profile);
      await storage.setLastResult(result);
      await storage.setRecommendSignature(profileSignature(profile));
      setLastResult(result);
      setQuote(randomQuote(result.books));
    } catch (e: any) {
      Alert.alert(t('today.retryFailTitle'), t('today.retryFailMsg'));
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const submitPages = async () => {
    const n = parseInt(pagesInput, 10);
    if (!n || n < 1 || n > 999) {
      Alert.alert(t('today.pagesRange'));
      return;
    }
    const updated = await storage.addPages(n);
    setCheckin(updated);
    setCheckinLog(await storage.getCheckinLog());
    setPagesInput('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.terracotta}
            colors={[colors.terracotta]}
          />
        }
      >
        {/* 个人画像变化后自动刷新的提示条 */}
        {retrying && (
          <View style={styles.refreshBanner}>
            <Text style={styles.refreshBannerText}>
              {t('today.refreshBanner')}
            </Text>
          </View>
        )}

        {/* 顶部栏 —— 左侧 Mico 头像（点击展开抽屉）+ 标题 + MBTI 角标 */}
        <View style={styles.header}>
          <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
            <View style={styles.avatarWrap}>
              <Bunny size={56} pose="sit" />
              {profile?.mbti && (
                <View style={styles.mbtiBadge}>
                  <Text style={styles.mbtiBadgeText}>{profile.mbti}</Text>
                </View>
              )}
              {/* 小提示点 */}
              {!checkin && <View style={styles.dotHint} />}
            </View>
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.hello}>{t('today.hello')}</Text>
            {quote && lang === 'zh' ? (
              <View>
                <Text style={styles.quoteText} numberOfLines={2}>「{quote.text}」</Text>
                <Text style={styles.quoteSource}>— 《{quote.source}》</Text>
              </View>
            ) : (
              <Text style={styles.helloSub}>{t('today.helloSub')}</Text>
            )}
          </View>
        </View>

        {/* 全库搜索栏 */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('today.search')}
              placeholderTextColor={colors.textFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            )}
          </View>

          {searchQuery.trim().length > 0 && (
            <View style={styles.searchResults}>
              {searching ? (
                <Text style={styles.searchHint}>{t('today.searching')}</Text>
              ) : searchResults.length === 0 ? (
                <Text style={styles.searchHint}>{t('today.noResults', { q: searchQuery.trim() })}</Text>
              ) : (
                <View style={styles.bookGrid}>
                  {searchResults.map((book, idx) => (
                    <BookGridCard
                      key={book.id}
                      book={book}
                      index={idx}
                      lang={lang}
                      onPress={() => setSelectedBook({
                        book,
                        rec: {
                          book_id: book.id,
                          order: 0,
                          why_for_you: t('today.searchWhy'),
                          key_focus: book.key_chapters,
                        },
                      })}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 今日推荐书单 —— Miki 精选 */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.miniMascot}>
              <Cat size={36} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{t('today.mikiTitle')}</Text>
              <Text style={styles.sectionSubtitle}>{t('today.mikiSub')}</Text>
            </View>
          </View>
          <WavyUnderline width={120} color={colors.sage} />

          {!lastResult ? (
            <View style={[styles.emptyCard, shadow.soft]}>
              {profile?.mbti ? (
                <>
                  <Text style={styles.emptyText}>
                    {t('today.youAre')} <Text style={{ color: colors.terracotta, fontWeight: '800' }}>{profile.mbti}</Text> 🐰
                  </Text>
                  <Text style={styles.emptyHint}>
                    {t('today.retryHint')}
                  </Text>
                  <Pressable
                    style={[styles.emptyBtn, retrying && { opacity: 0.6 }]}
                    onPress={retryRecommendation}
                    disabled={retrying}
                  >
                    <Text style={styles.emptyBtnText}>
                      {retrying ? t('today.generating') : t('today.regen')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.emptyText}>{t('today.emptyNoMbti')}</Text>
                  <Text style={styles.emptyHint}>
                    {t('today.emptyNoMbtiHint')}
                  </Text>
                  <Pressable
                    style={styles.emptyBtn}
                    onPress={() => navigation.navigate('Quiz')}
                  >
                    <Text style={styles.emptyBtnText}>{t('today.startQuiz')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <>
              {/* 简短画像 */}
              {lastResult.profile?.description && (
                <View style={styles.miniProfile}>
                  <Text style={styles.miniProfileText} numberOfLines={4}>
                    {lastResult.profile.description}
                  </Text>
                </View>
              )}

              <View style={styles.bookGrid}>
                {lastResult.recommendations.map((rec, idx) => {
                  const book = lastResult.books.find((b) => b.id === rec.book_id);
                  if (!book) return null;
                  return (
                    <BookGridCard
                      key={book.id}
                      book={book}
                      index={idx}
                      number={rec.order}
                      lang={lang}
                      onPress={() => setSelectedBook({ book, rec })}
                    />
                  );
                })}
              </View>

              <Pressable
                onPress={() => navigation.navigate('Result', { result: lastResult })}
                style={styles.viewAllBtn}
              >
                <Text style={styles.viewAllText}>{t('today.viewAll')}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* 更多好书 —— 从筛选候选池里轮播展示 */}
        {moreBatch.length > 0 && (
          <View style={styles.section}>
            <View style={styles.moreHeader}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.miniMascot}>
                  <Bunny size={36} pose="wave" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{t('today.moreTitle')}</Text>
                  <Text style={styles.sectionSubtitle}>{t('today.moreSub')}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => shuffleMoreBooks(lastResult?.more_books)}
                style={styles.shuffleBtn}
              >
                <Text style={styles.shuffleText}>{t('today.shuffle')}</Text>
              </Pressable>
            </View>
            <WavyUnderline width={100} color={colors.lavender} />

            <View style={styles.bookGrid}>
              {moreBatch.map((book, idx) => (
                <BookGridCard
                  key={book.id}
                  book={book}
                  index={idx + 5}  // 错开颜色，跟主推不撞色
                  lang={lang}
                  onPress={() => openMoreBook(book)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 书详情弹窗 */}
      <BookDetailModal
        visible={!!selectedBook}
        book={selectedBook?.book ?? null}
        rec={selectedBook?.rec}
        recLoading={recLoading}
        onClose={async () => {
          setSelectedBook(null);
          setRecLoading(false);
          // 点开书已自动打卡，关闭时刷新日历与今日状态
          setCheckin(await storage.getTodayCheckin());
          setCheckinLog(await storage.getCheckinLog());
        }}
      />

      {/* 隐藏的左侧抽屉 —— 点头像才展开 */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerHeader}>
          <View style={styles.drawerBunny}>
            <Bunny size={70} pose="wave" />
          </View>
          <Text style={styles.drawerHello}>{t('drawer.title')}</Text>
          {profile?.mbti && (
            <Text style={styles.drawerMbti}>{profile.mbti}</Text>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}>
          {/* 今日打卡 */}
          <View style={styles.drawerCardTitleRow}>
            <Sparkle size={14} />
            <Text style={styles.drawerCardTitle}>{t('drawer.checkin')}</Text>
          </View>

          {checkin ? (
            <Text style={styles.checkinBig}>
              {t('drawer.readPages', { n: checkin.pages })}
            </Text>
          ) : (
            <Text style={styles.checkinHint}>{t('drawer.noCheckin')}</Text>
          )}

          <View style={styles.checkinInputRow}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder={t('drawer.pagesPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={pagesInput}
              onChangeText={setPagesInput}
              maxLength={3}
            />
            <Pressable style={styles.addBtn} onPress={submitPages}>
              <Text style={styles.addBtnText}>{t('drawer.add')}</Text>
            </Pressable>
          </View>

          {/* 迷你日历 */}
          <View style={styles.calendarBlock}>
            <View style={styles.drawerCardTitleRow}>
              <Heart size={14} />
              <Text style={styles.drawerCardTitle}>{t('drawer.calendar')}</Text>
            </View>
            <CheckinCalendar log={checkinLog} />
          </View>

          {/* 关闭按钮 */}
          <Pressable
            onPress={() => setDrawerOpen(false)}
            style={styles.drawerClose}
          >
            <Text style={styles.drawerCloseText}>{t('drawer.collapse')}</Text>
          </Pressable>
        </ScrollView>
      </Drawer>
    </SafeAreaView>
  );
}

// ===== 网格卡片：彩色封面 + 书名 + 作者 =====
const GRID_COVER_TONES = [
  '#E8D9C8',  // 米色
  '#D6E0CB',  // 抹茶绿
  '#D9DCE5',  // 雾蓝
  '#F0E2C8',  // 暖黄
  '#E5CFE0',  // 浅紫
  '#E8D2C5',  // 杏色
  '#CFD9CC',  // 灰绿
  '#E2D5D2',  // 灰粉
  '#D0CCDB',  // 灰紫
  '#D6CFC4',  // 浅咖
];

function BookGridCard({
  book, index, number, lang, onPress,
}: {
  book: Book;
  index: number;
  number?: number;  // 1, 2, 3, 4, 5（Miki 推荐用）
  lang: import('../types').Language;
  onPress: () => void;
}) {
  const tone = GRID_COVER_TONES[index % GRID_COVER_TONES.length];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridCard,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {book.cover_url ? (
        <Image source={{ uri: book.cover_url }} style={[styles.gridCover, { backgroundColor: tone }]} />
      ) : (
        <View style={[styles.gridCover, { backgroundColor: tone }]}>
          <Text style={styles.gridCoverTitle} numberOfLines={4}>
            {bookTitle(book, lang)}
          </Text>
        </View>
      )}
      <Text style={styles.gridTitle} numberOfLines={1}>
        {number ? `${number}. ` : ''}{bookTitle(book, lang)}
      </Text>
      <Text style={styles.gridAuthor} numberOfLines={1}>{bookAuthor(book, lang)}</Text>
    </Pressable>
  );
}

function MiniBookCard({
  book, rec, onPress,
}: {
  book: Book;
  rec: { order: number; why_for_you: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.bookRow,
        shadow.soft,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
      ]}
    >
      {book.cover_url ? (
        <Image source={{ uri: book.cover_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverText}>{book.title.slice(0, 2)}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.bookTitle} numberOfLines={1}>
          {rec.order}. {book.title}
        </Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
        <Text style={styles.bookWhy} numberOfLines={2}>{rec.why_for_you}</Text>
      </View>
      <Text style={styles.bookArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.bunnyEar,
    position: 'relative',
  },
  mbtiBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  mbtiBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hello: { ...typography.h2, fontSize: 19 },
  helloSub: { ...typography.caption, marginTop: 2 },
  quoteText: {
    fontSize: 12,
    color: colors.primary,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 3,
  },
  quoteSource: {
    fontSize: 11,
    color: colors.terracotta,
    fontWeight: '600',
    marginTop: 2,
  },
  helloHint: { ...typography.caption, marginTop: 4, color: colors.terracotta, fontSize: 11 },

  refreshBanner: {
    backgroundColor: colors.bunnyBlush,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
  },
  refreshBannerText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 0.5,
  },

  dotHint: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.terracotta,
    borderWidth: 2,
    borderColor: colors.bg,
  },

  // 抽屉内
  drawerHeader: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  drawerBunny: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bunnyEar,
    marginBottom: spacing.sm,
  },
  drawerHello: { ...typography.h3 },
  drawerMbti: {
    color: colors.terracotta,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 2,
    marginTop: 4,
  },
  drawerCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  drawerCardTitle: { ...typography.h3, marginLeft: spacing.xs, fontSize: 15 },

  calendarBlock: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  drawerClose: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  drawerCloseText: {
    color: colors.textMuted,
    fontWeight: '600',
  },

  checkinCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle: { ...typography.h3, marginLeft: spacing.xs },
  checkinBig: {
    ...typography.body,
    marginTop: spacing.md,
    fontSize: 16,
  },
  checkinNumber: {
    color: colors.terracotta,
    fontWeight: '800',
    fontSize: 22,
  },
  checkinHint: { ...typography.caption, marginTop: spacing.sm },
  checkinInputRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  addBtn: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.terracotta,
    marginLeft: spacing.sm,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },

  // ===== 全库搜索 =====
  searchSection: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchIcon: { fontSize: 15, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 14,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  searchResults: { marginTop: spacing.md },
  searchHint: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  miniProfile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  miniProfileText: { ...typography.body, fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  emptyText: { ...typography.h3, marginBottom: spacing.sm },
  emptyHint: { ...typography.caption, textAlign: 'center', marginBottom: spacing.lg },
  emptyBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    backgroundColor: colors.terracotta,
    borderRadius: radius.pill,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },

  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookArrow: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
  // 让"更多好书"的卡片跟 Miki 推荐完全一致
  moreBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 54, height: 76, borderRadius: radius.sm, backgroundColor: colors.border },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgSoft },
  coverText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  bookTitle: { ...typography.h3, fontSize: 15 },
  bookAuthor: { ...typography.caption, marginTop: 2 },
  bookWhy: { ...typography.caption, marginTop: 6, color: colors.text, fontSize: 13, lineHeight: 19 },

  viewAllBtn: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  viewAllText: { color: colors.terracotta, fontWeight: '600' },

  // ===== 网格卡片（书库风）=====
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    marginHorizontal: -4,  // 抵消每张卡片的外 margin
  },
  gridCard: {
    width: '33.33%',
    paddingHorizontal: 4,
    marginBottom: spacing.lg,
  },
  gridCover: {
    width: '100%',
    aspectRatio: 0.72,           // 书的标准比例
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
    // 软软阴影
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  gridCoverTitle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 1,
  },
  gridTitle: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    marginTop: 8,
  },
  gridAuthor: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  miniMascot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sectionSubtitle: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  shuffleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shuffleText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 0.5,
  },
});
