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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import {
  mirrorChat,
  fetchMirrorHistory,
  type MirrorMessage,
  type MirrorChatContext,
} from '../lib/api';
import type { RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MirrorChatScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<MirrorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    scrollToEnd();
    try {
      const { reply } = await mirrorChat({
        user_id: userId,
        message: text,
        context: buildContext(),
        language: lang,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('mirror.errorReply') }]);
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
        ]
      : messages;

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
            {display.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubbleRow,
                  m.role === 'user' ? styles.rowRight : styles.rowLeft,
                ]}
              >
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
              </View>
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
