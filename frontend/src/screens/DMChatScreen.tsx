import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Image, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { fetchDMHistory, sendDM, type DMMessage } from '../lib/api';
import { formatDivider, shouldShowDivider } from '../lib/chatTime';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'DMChat'>;
const POLL_MS = 3500;

export function DMChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { t, lang } = useI18n();
  const { peerId, peerName, peerAvatar } = route.params;

  const [uid, setUid] = useState('');
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (id: string) => {
    const h = await fetchDMHistory(id, peerId, 0);
    setMessages(h);
  }, [peerId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await storage.getUserId();
      if (!mounted) return;
      setUid(id);
      await refresh(id);
      // 轮询：拿新消息 + 更新已读状态
      timer.current = setInterval(() => {
        if (AppState.currentState === 'active') refresh(id);
      }, POLL_MS);
    })();
    return () => { mounted = false; if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  useEffect(() => {
    // 内容变化时滚到底
    const tm = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(tm);
  }, [messages.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending || !uid) return;
    setInput('');
    setSending(true);
    // 乐观插入
    const optimistic: DMMessage = { id: -Date.now(), from_me: true, content: text, created_at: new Date().toISOString(), read: false };
    setMessages((m) => [...m, optimistic]);
    try {
      await sendDM(uid, peerId, text);
      await refresh(uid);
    } catch (e: any) {
      // 失败：去掉乐观气泡，回填输入
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Pressable
          style={styles.peerInfo}
          onPress={() => navigation.navigate('ProfileHome', { userId: peerId })}
        >
          <View style={styles.peerAvatar}>
            {peerAvatar ? <Image source={{ uri: peerAvatar }} style={styles.peerAvatarImg} /> : <Snowman size={28} pose="wave" />}
          </View>
          <Text style={styles.peerName} numberOfLines={1}>{peerName || t('profileHome.noName')}</Text>
        </Pressable>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
          {messages.map((m, i) => (
            <React.Fragment key={m.id}>
            {shouldShowDivider(messages[i - 1]?.created_at, m.created_at) && (
              <Text style={styles.timeDivider}>{formatDivider(m.created_at, lang)}</Text>
            )}
            <View style={[styles.row, m.from_me ? styles.rowMine : styles.rowTheirs]}>
              {!m.from_me && (
                <View style={styles.smallAvatar}>
                  {peerAvatar ? <Image source={{ uri: peerAvatar }} style={styles.smallAvatarImg} /> : <Snowman size={22} pose="wave" />}
                </View>
              )}
              <View style={styles.bubbleWrap}>
                <View style={[styles.bubble, m.from_me ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.msgText, m.from_me && styles.msgTextMine]}>{m.content}</Text>
                </View>
                {/* 我发的消息：左下角显示对方已读/未读 */}
                {m.from_me && m.id > 0 && (
                  <Text style={styles.readStatus}>{m.read ? t('dm.read') : t('dm.unread')}</Text>
                )}
              </View>
            </View>
            </React.Fragment>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('dm.placeholder')}
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <Pressable
            onPress={onSend}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
          >
            <Text style={styles.sendText}>{t('dm.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { fontSize: 30, color: colors.textMuted, width: 30 },
  peerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: spacing.sm },
  peerAvatar: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  peerAvatarImg: { width: '100%', height: '100%' },
  peerName: { ...typography.h3, maxWidth: 180 },

  list: { padding: spacing.lg, paddingBottom: spacing.md },
  timeDivider: { ...typography.caption, color: colors.textFaint, fontSize: 11, textAlign: 'center', marginVertical: spacing.sm },
  row: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  smallAvatarImg: { width: '100%', height: '100%' },
  bubbleWrap: { maxWidth: '76%' },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.terracotta, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  msgText: { ...typography.body, color: colors.text, lineHeight: 21 },
  msgTextMine: { color: '#fff' },
  readStatus: { ...typography.caption, color: colors.textFaint, fontSize: 11, marginTop: 3, marginLeft: 4, alignSelf: 'flex-start' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, maxHeight: 120 },
  sendBtn: { backgroundColor: colors.terracotta, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: 2 },
  sendText: { color: '#fff', fontWeight: '700' },
});
