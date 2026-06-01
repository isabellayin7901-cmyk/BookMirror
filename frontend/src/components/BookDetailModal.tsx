import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Animated,
  Dimensions,
  Easing,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle, Heart, Leaf } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { getPlatformsForBook, openPlatform, openAppStore, platformName, type PlatformConfig } from '../lib/platformLinks';
import { PlatformIcon } from '../illustrations/PlatformIcons';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle, bookAuthor, bookSummary, bookChapters } from '../lib/bookDisplay';
import {
  fetchBookReviews, deleteReview, type Review,
  getReadingStatus, setReadingStatus, type ReadingKind,
} from '../lib/api';
import type { Book, BookRecommendation, RootStackParamList } from '../types';

const SCREEN_H = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  book: Book | null;
  rec?: BookRecommendation;
  recLoading?: boolean;   // 正在为这本书实时生成「为什么适合你」
  onClose: () => void;
}

export function BookDetailModal({ visible, book, rec, recLoading, onClose }: Props) {
  const { t, lang } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [canReview, setCanReview] = useState(false);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [isFav, setIsFav] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (book && visible) {
      storage.isFavorite(book.id).then(setIsFav);
    }
  }, [book, visible]);

  const toggleFav = async () => {
    if (!book) return;
    const next = await storage.toggleFavorite(book);
    setIsFav(next);
    if (next) {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
      ]).start();
    }
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0.5,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, fade]);

  if (!book) return null;

  const stars = '★'.repeat(book.difficulty) + '☆'.repeat(5 - book.difficulty);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
            {/* 顶部抓手 */}
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            {recLoading ? (
              /* 整页加载：等「为什么适合你」生成好，再一次性展示全部内容 */
              <View style={styles.fullLoading}>
                <ActivityIndicator color={colors.terracotta} />
                <Text style={styles.fullLoadingText}>{t('modal.whyLoading')}</Text>
              </View>
            ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
              {/* 封面 + 标题 */}
              <View style={styles.titleSection}>
                {book.cover_url ? (
                  <Image source={{ uri: book.cover_url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Text style={styles.coverText}>{bookTitle(book, lang).slice(0, 2)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { flex: 1 }]}>{bookTitle(book, lang)}</Text>
                    <Pressable
                      onPress={toggleFav}
                      hitSlop={10}
                      style={[styles.favBtn, isFav && styles.favBtnActive]}
                    >
                      <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                        <Heart size={20} color={isFav ? colors.rose : colors.border} />
                      </Animated.View>
                    </Pressable>
                  </View>
                  <Text style={styles.author}>{bookAuthor(book, lang)}</Text>
                  <Text style={styles.difficulty}>{stars}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaTag}>
                      <Text style={styles.metaTagText}>{t('modal.difficulty', { n: book.difficulty })}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 阅读状态：想读 / 在读 / 读完 */}
              <ReadingStatusBar book={book} onStatus={(s) => setCanReview(s === 'finished')} />

              {/* 这本书在讲什么 */}
              <Section icon={<Leaf size={14} />} title={t('modal.summary')} underlineColor={colors.sage}>
                <Text style={styles.bodyText}>{bookSummary(book, lang)}</Text>
              </Section>

              {/* 为什么适合你 */}
              {rec?.why_for_you && (
                <Section icon={<Heart size={14} />} title={t('modal.why')} underlineColor={colors.rose}>
                  <Text style={styles.bodyText}>{rec.why_for_you}</Text>
                </Section>
              )}

              {/* 重点读什么 */}
              {rec?.key_focus && rec.key_focus.length > 0 && (
                <Section icon={<Sparkle size={14} />} title={t('modal.focus')} underlineColor={colors.terracotta}>
                  {rec.key_focus.map((f, i) => (
                    <View key={i} style={styles.focusItem}>
                      <Text style={styles.focusNum}>{i + 1}</Text>
                      <Text style={[styles.bodyText, { flex: 1, marginLeft: spacing.sm }]}>{f}</Text>
                    </View>
                  ))}
                </Section>
              )}

              {/* 章节主题 */}
              {bookChapters(book, lang).length > 0 && (
                <Section icon={<Sparkle size={14} color={colors.lavender} />} title={t('modal.chapters')} underlineColor={colors.lavender}>
                  {bookChapters(book, lang).map((c, i) => (
                    <Text key={i} style={[styles.bodyText, { marginTop: 4 }]}>· {c}</Text>
                  ))}
                </Section>
              )}

              {/* 这本书的关键词 */}
              {(book.topics?.length || book.mbti_fit?.length) ? (
                <View style={{ marginTop: spacing.lg }}>
                  <View style={styles.tagRow}>
                    {book.topics.slice(0, 4).map((topic) => (
                      <View key={topic} style={styles.topicTag}>
                        <Text style={styles.topicTagText}>{t(`topic.${topic}`)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* 在哪儿读 / 买 */}
              <PlatformJumpRow book={book} />

              {/* 读者反馈（三合一书评，读完才能写） */}
              <ReviewsSection
                book={book}
                canReview={canReview}
                onWrite={() => {
                  onClose();
                  navigation.navigate('BookReview', { book });
                }}
              />
            </ScrollView>
            )}

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>{t('modal.close')}</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PlatformJumpRow({ book }: { book: Book }) {
  const { t, lang } = useI18n();
  // 只展示对这本书有意义的平台
  const relevant = getPlatformsForBook(book);
  if (relevant.length === 0) return null;

  const groups: Array<{ label: string; cat: PlatformConfig['category']; tint: string }> = [
    { label: t('modal.read'), cat: 'read', tint: colors.sage },
    { label: t('modal.buy'), cat: 'buy', tint: colors.terracotta },
    { label: t('modal.rating'), cat: 'rating', tint: colors.lavender },
  ];

  return (
    <View style={{ marginTop: spacing.xl }}>
      {groups.map((g) => {
        const list = relevant.filter((p) => p.category === g.cat);
        if (list.length === 0) return null;
        return (
          <View key={g.cat} style={{ marginTop: spacing.md }}>
            <Text style={[styles.groupLabel, { color: g.tint }]}>{g.label}</Text>
            <View style={styles.platformGrid}>
              {list.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    // 点击去阅读平台 = 今天读了书，自动打卡
                    if (p.category === 'read') storage.ensureTodayCheckin();
                    openPlatform(p, book);
                  }}
                  onLongPress={() => openAppStore(p)}
                  style={({ pressed }) => [
                    styles.platformBtn,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <PlatformIcon id={p.id} size={42} />
                  <Text style={styles.platformName}>{platformName(p, lang)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      <Text style={styles.platformHint}>
        {t('modal.platformHint')}
      </Text>
    </View>
  );
}

function ReadingStatusBar({ book, onStatus }: { book: Book; onStatus: (s: ReadingKind) => void }) {
  const { t } = useI18n();
  const [uid, setUid] = useState('');
  const [status, setStatus] = useState<ReadingKind>('want');
  const [current, setCurrent] = useState('');
  const [total, setTotal] = useState('');

  useEffect(() => {
    (async () => {
      const id = await storage.getUserId();
      setUid(id);
      const rs = await getReadingStatus(id, book.id);
      if (rs) {
        setStatus(rs.status);
        setCurrent(rs.current_page ? String(rs.current_page) : '');
        setTotal(rs.total_pages ? String(rs.total_pages) : '');
        onStatus(rs.status);
      } else {
        onStatus('want');
      }
    })();
  }, [book.id]);

  const choose = async (s: ReadingKind) => {
    setStatus(s);
    onStatus(s);
    try {
      const rs = await setReadingStatus({ user_id: uid, book_id: book.id, status: s });
      setStatus(rs.status);
      onStatus(rs.status);
    } catch { /* ignore */ }
  };

  const saveProgress = async () => {
    const cur = parseInt(current, 10) || 0;
    const tot = parseInt(total, 10) || 0;
    try {
      const prevCur = (await getReadingStatus(uid, book.id))?.current_page ?? 0;
      const rs = await setReadingStatus({
        user_id: uid, book_id: book.id, status: 'reading', current_page: cur, total_pages: tot,
      });
      // 复用打卡：今天多读的页数计入打卡日历
      if (cur > prevCur) await storage.addPages(cur - prevCur);
      setStatus(rs.status);
      setCurrent(rs.current_page ? String(rs.current_page) : '');
      onStatus(rs.status);
    } catch { /* ignore */ }
  };

  const OPTIONS: ReadingKind[] = ['want', 'reading', 'finished'];

  return (
    <View style={styles.readingWrap}>
      <View style={styles.segment}>
        {OPTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => choose(s)}
            style={[styles.segBtn, status === s && styles.segBtnOn]}
          >
            <Text style={[styles.segText, status === s && styles.segTextOn]}>{t(`reading.${s}`)}</Text>
          </Pressable>
        ))}
      </View>
      {status === 'reading' && (
        <View style={styles.progressRow}>
          <TextInput
            style={styles.pageInput}
            value={current}
            onChangeText={setCurrent}
            keyboardType="number-pad"
            placeholder={t('reading.current')}
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.pageSep}>/</Text>
          <TextInput
            style={styles.pageInput}
            value={total}
            onChangeText={setTotal}
            keyboardType="number-pad"
            placeholder={t('reading.total')}
            placeholderTextColor={colors.textFaint}
          />
          <Pressable onPress={saveProgress} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{t('reading.save')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ReviewsSection({ book, canReview, onWrite }: { book: Book; canReview: boolean; onWrite: () => void }) {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [uid, setUid] = useState('');

  const load = React.useCallback(async () => {
    try {
      const id = await storage.getUserId();
      setUid(id);
      setReviews(await fetchBookReviews(book.id));
    } catch {
      setReviews([]);
    }
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  const mine = reviews.find((r) => r.user_id === uid);
  const others = reviews.filter((r) => r.user_id !== uid);
  const ordered = mine ? [mine, ...others] : others;

  const removeMine = () => {
    Alert.alert(t('book.deleteReview'), t('book.deleteReviewConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('book.deleteReview'),
        style: 'destructive',
        onPress: async () => {
          try { await deleteReview(uid, book.id); } catch { /* ignore */ }
          load();
        },
      },
    ]);
  };

  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.reviewsTitle}>{t('book.reviews')}</Text>

      {canReview || mine ? (
        <Pressable onPress={onWrite} style={({ pressed }) => [styles.writeBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.writeBtnText}>{mine ? t('book.editReview') : t('book.writeReview')}</Text>
        </Pressable>
      ) : (
        <View style={styles.lockedBtn}>
          <Text style={styles.lockedText}>{t('book.reviewLocked')}</Text>
        </View>
      )}

      {ordered.length === 0 ? (
        <Text style={styles.noReviews}>{t('book.noReviews')}</Text>
      ) : (
        ordered.map((r) => {
          const own = r.user_id === uid;
          return (
            <Pressable
              key={r.id}
              onLongPress={own ? removeMine : undefined}
              style={styles.reviewCard}
            >
              <View style={styles.reviewHead}>
                <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                <Text style={styles.reviewName}>
                  {own ? t('review.title') : r.anonymous ? t('book.anonReader') : t('book.aReader')}
                </Text>
              </View>
              {r.emotions.length > 0 && (
                <View style={styles.reviewEmos}>
                  {r.emotions.map((e) => (
                    <Text key={e} style={styles.reviewEmo}>{t(`review.emo.${e}`)}</Text>
                  ))}
                </View>
              )}
              {!!r.text && <Text style={styles.reviewText}>{r.text}</Text>}
              {own && <Text style={styles.reviewDeleteHint}>{t('book.deleteReview')}</Text>}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function Section({
  icon, title, underlineColor, children,
}: { icon: React.ReactNode; title: string; underlineColor?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <WavyUnderline width={80} color={underlineColor} />
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_H * 0.88,
    minHeight: SCREEN_H * 0.6,
  },
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },

  titleSection: { flexDirection: 'row' },
  cover: { width: 90, height: 130, borderRadius: radius.sm, backgroundColor: colors.bgSoft },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  coverText: { fontWeight: '800', color: colors.textMuted, fontSize: 18 },

  title: { ...typography.h2, fontSize: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  favBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bgSoft,
    marginLeft: spacing.xs,
  },
  favBtnActive: { backgroundColor: '#F6E6E6' },
  author: { ...typography.caption, marginTop: 4 },
  difficulty: { color: colors.terracotta, letterSpacing: 2, marginTop: 6 },
  metaRow: { flexDirection: 'row', marginTop: spacing.sm },
  metaTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  metaTagText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  sectionTitle: { ...typography.h3, marginLeft: spacing.xs },
  bodyText: { ...typography.body, fontSize: 15, lineHeight: 23 },

  fullLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  fullLoadingText: {
    ...typography.body, fontSize: 14, color: colors.textMuted,
    marginTop: spacing.md, textAlign: 'center', lineHeight: 22,
  },

  focusItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  focusNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.terracotta, color: '#fff',
    textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '700',
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap' },
  topicTag: {
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    marginRight: 6, marginBottom: 6,
  },
  topicTagText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  // 在哪儿读 / 买
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  platformBtn: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  platformName: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 1,
    marginTop: 4,
  },
  platformHint: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 16,
  },

  closeBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  readingWrap: { marginTop: spacing.lg },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.terracotta },
  segText: { ...typography.body, fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  segTextOn: { color: '#fff' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  pageInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlign: 'center',
  },
  pageSep: { color: colors.textMuted },
  saveBtn: { paddingHorizontal: spacing.md, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  lockedBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lockedText: { color: colors.textMuted, fontSize: 13 },

  reviewsTitle: { ...typography.h3, marginBottom: spacing.sm },
  writeBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.terracotta,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  writeBtnText: { color: colors.terracotta, fontWeight: '700', fontSize: 15 },
  noReviews: { ...typography.caption, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.md },
  reviewCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewStars: { color: '#E6A23C', fontSize: 14 },
  reviewName: { ...typography.caption, color: colors.textMuted },
  reviewEmos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs },
  reviewEmo: {
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  reviewText: { ...typography.body, fontSize: 14, marginTop: spacing.xs, lineHeight: 20 },
  reviewDeleteHint: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
});
