import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { BookDetailModal } from '../components/BookDetailModal';
import { bookTitle, bookAuthor } from '../lib/bookDisplay';
import type { Book } from '../types';
import {
  mirrorChat,
  fetchMirrorHistory,
  type MirrorMessage,
  type MirrorChatContext,
} from '../lib/api';
import type { RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// QQ 式气泡：挂载时从侧边、由小到大、温柔弹出。
function PopIn({ fromLeft, children }: { fromLeft: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 70,
    }).start();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [fromLeft ? -16 : 16, 0] });
  return (
    <Animated.View style={{ opacity: v, transform: [{ scale }, { translateX }] }}>
      {children}
    </Animated.View>
  );
}

// 微信式时间戳：今天只显示时分，昨天加「昨天」，更早加日期。
function formatTimeDivider(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const sameYear = d.getFullYear() === now.getFullYear();
  const en = lang === 'en';

  if (dayDiff <= 0) return hm; // 今天
  if (dayDiff === 1) return (en ? 'Yesterday ' : '昨天 ') + hm;
  if (dayDiff < 7) {
    const wd = en
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
      : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return `${wd} ${hm}`;
  }
  if (en) {
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    return sameYear ? `${mon} ${d.getDate()}, ${hm}` : `${mon} ${d.getDate()}, ${d.getFullYear()} ${hm}`;
  }
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

export function MirrorChatScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<MirrorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // 初始化：拿用户 ID + 画像，从后端拉历史
  useEffect(() => {
    (async () => {
      const [id, p] = await Promise.all([storage.getUserId(), storage.getUserProfile()]);
      setUserId(id);
      setProfile(p);
      try {
        const history = await fetchMirrorHistory(id);
        setMessages(history);
      } catch {
        /* 离线/失败：留空，靠问候语兜底 */
      } finally {
        setLoading(false);
        scrollToEnd();
      }
    })();
  }, [scrollToEnd]);

  const buildContext = (): MirrorChatContext => ({
    mbti: profile?.mbti,
    zodiac: profile?.zodiac
      ? {
          sun_sign: profile.zodiac.sun_sign,
          moon_sign: profile.zodiac.moon_sign,
          element: profile.zodiac.element,
        }
      : undefined,
    gender: profile?.gender,
  });

  const send = async () => {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, created_at: new Date().toISOString() },
    ]);
    setSending(true);
    scrollToEnd();
    try {
      const { reply, book } = await mirrorChat({
        user_id: userId,
        message: text,
        context: buildContext(),
        language: lang,
      });
      // 逐条冒泡，像真人连发好几条短消息（生成完一次性拿到，再分条显示）；
      // 期间保留底部「正在输入」点点，到最后一条才收起。
      const parts = reply.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      const finalParts = parts.length > 0 ? parts : [reply];
      for (let i = 0; i < finalParts.length; i++) {
        if (i > 0) {
          // 温和、像真人打字：停顿随这一条的长度增加（越长越久），整体放慢。
          const delay = Math.min(2400, 900 + finalParts[i].length * 45);
          await new Promise((r) => setTimeout(r, delay));
        }
        const isLast = i === finalParts.length - 1;
        if (isLast) setSending(false);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: finalParts[i],
            created_at: new Date().toISOString(),
            book: isLast ? (book ?? null) : null,
          },
        ]);
        scrollToEnd();
      }
    } catch {
      setSending(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('mirror.errorReply'), created_at: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const confirmReset = () => {
    Alert.alert(t('mirror.reset'), t('mirror.resetConfirm'), [
      { text: t('mirror.cancel'), style: 'cancel' },
      {
        text: t('mirror.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          try {
            const { deleteMirrorHistory } = await import('../lib/api');
            await deleteMirrorHistory(userId);
          } catch {
            /* 后端删除失败也先清本地视图 */
          }
          setMessages([]);
        },
      },
    ]);
  };

  // 没有历史时显示问候语（不入库，纯展示）；拆成两条，更像真人
  const display: MirrorMessage[] =
    messages.length === 0 && !loading
      ? [
          { role: 'assistant', content: t('mirror.greeting1') },
          { role: 'assistant', content: t('mirror.greeting2') },
          { role: 'assistant', content: t('mirror.greeting3') },
        ]
      : messages;

  // 助手的长回复按空行拆成多条气泡，像真人连发好几条短消息（拆出的气泡共用同一时间戳）
  const bubbles: MirrorMessage[] = display.flatMap((m) => {
    if (m.role !== 'assistant') return [m];
    const parts = m.content
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return [m];
    // 书卡挂在这条消息拆出的最后一个气泡下面
    return parts.map((content, idx) => ({
      role: 'assistant' as const,
      content,
      created_at: m.created_at,
      book: idx === parts.length - 1 ? m.book : null,
    }));
  });

  // 像微信那样：相邻消息间隔超过 5 分钟，就在中间插一条时间分割
  let prevTime: number | null = null;
  const items = bubbles.map((m, i) => {
    let timeLabel: string | null = null;
    if (m.created_at) {
      const tms = new Date(m.created_at).getTime();
      if (!Number.isNaN(tms) && (prevTime === null || tms - prevTime >= 5 * 60 * 1000)) {
        timeLabel = formatTimeDivider(m.created_at, lang);
      }
      if (!Number.isNaN(tms)) prevTime = tms;
    }
    return { m, timeLabel, key: i };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>🪞 {t('mirror.title')}</Text>
          <Text style={styles.subtitle}>{t('mirror.subtitle')}</Text>
        </View>
        <Pressable onPress={confirmReset} hitSlop={12}>
          <Text style={styles.reset}>{t('mirror.reset')}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.terracotta} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
          >
            {items.map(({ m, timeLabel, key }) => (
              <React.Fragment key={key}>
                {timeLabel && (
                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{timeLabel}</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubbleRow,
                    m.role === 'user' ? styles.rowRight : styles.rowLeft,
                  ]}
                >
                  <PopIn fromLeft={m.role !== 'user'}>
                    <View
                      style={[
                        styles.bubble,
                        m.role === 'user' ? styles.bubbleUser : styles.bubbleMirror,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          m.role === 'user' && { color: '#fff' },
                        ]}
                      >
                        {m.content}
                      </Text>
                    </View>
                  </PopIn>
                </View>
                {m.book && (
                  <View style={[styles.bubbleRow, styles.rowLeft]}>
                    <Pressable
                      onPress={() => setDetailBook(m.book!)}
                      style={({ pressed }) => [styles.bookCard, shadow.soft, pressed && { opacity: 0.9 }]}
                    >
                      {m.book.cover_url ? (
                        <Image source={{ uri: m.book.cover_url }} style={styles.bookCover} />
                      ) : (
                        <View style={[styles.bookCover, styles.bookCoverFallback]}>
                          <Text style={styles.bookCoverEmoji}>📖</Text>
                        </View>
                      )}
                      <View style={styles.bookInfo}>
                        <Text style={styles.bookTitle} numberOfLines={2}>
                          {bookTitle(m.book, lang)}
                        </Text>
                        <Text style={styles.bookAuthor} numberOfLines={1}>
                          {bookAuthor(m.book, lang)}
                        </Text>
                        <Text style={styles.bookCta}>{t('mirror.bookCta')}</Text>
                      </View>
                    </Pressable>
                  </View>
                )}
              </React.Fragment>
            ))}
            {sending && (
              <View style={[styles.bubbleRow, styles.rowLeft]}>
                <View style={[styles.bubble, styles.bubbleMirror]}>
                  <Text style={[styles.bubbleText, { color: colors.textMuted }]}>
                    {t('mirror.thinking')}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('mirror.inputPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || sending) && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BookDetailModal
        visible={detailBook !== null}
        book={detailBook}
        onClose={() => setDetailBook(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 30, color: colors.textMuted, width: 40 },
  title: { ...typography.h3 },
  subtitle: { ...typography.caption, fontSize: 11, marginTop: 1 },
  reset: { fontSize: 12, color: colors.textMuted, width: 56, textAlign: 'right' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.md },
  timeRow: { alignItems: 'center', marginVertical: spacing.sm },
  timeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    backgroundColor: 'transparent',
  },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.md },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMirror: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.terracotta,
    borderTopRightRadius: 4,
  },
  bubbleText: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.text },

  bookCard: {
    flexDirection: 'row',
    maxWidth: '82%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderTopLeftRadius: 4,
    padding: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  bookCover: { width: 44, height: 62, borderRadius: 6, backgroundColor: colors.snowShade },
  bookCoverFallback: { alignItems: 'center', justifyContent: 'center' },
  bookCoverEmoji: { fontSize: 22 },
  bookInfo: { flex: 1, gap: 2 },
  bookTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  bookAuthor: { fontSize: 12, color: colors.textMuted },
  bookCta: { fontSize: 12, color: colors.terracotta, marginTop: 2 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.soft,
  },
  sendIcon: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
