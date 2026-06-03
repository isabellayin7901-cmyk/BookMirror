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
  Modal,
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
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  createProject,
  type MirrorMessage,
  type MirrorChatContext,
  type Conversation,
  type MirrorProject,
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
    <Animated.View style={{ maxWidth: '86%', opacity: v, transform: [{ scale }, { translateX }] }}>
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
  const [quoted, setQuoted] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const srSubsRef = useRef<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);
  // 多对话
  const [convId, setConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<MirrorProject[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [projectPickOpen, setProjectPickOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectText, setNewProjectText] = useState('');

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const loadConversations = useCallback(async (id: string) => {
    try {
      const { conversations: cs, projects: ps } = await listConversations(id);
      setConversations(cs);
      setProjects(ps);
      return cs;
    } catch {
      return [] as Conversation[];
    }
  }, []);

  const switchConversation = useCallback(async (id: string, cid: string | null) => {
    setConvId(cid);
    setMessages([]);
    setLoading(true);
    try {
      const history = await fetchMirrorHistory(id, cid);
      setMessages(history);
    } catch {
      /* 留空靠问候语 */
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  }, [scrollToEnd]);

  // 初始化：拿用户 ID + 画像 + 对话列表，加载最近一段
  useEffect(() => {
    (async () => {
      const [id, p] = await Promise.all([storage.getUserId(), storage.getUserProfile()]);
      setUserId(id);
      setProfile(p);
      const cs = await loadConversations(id);
      const first = cs[0]?.id ?? null;
      await switchConversation(id, first);
    })();
  }, [loadConversations, switchConversation]);

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

  // 统一发送：可带文字、可带图片（base64）。apiText 用于带引用时发给后端的实际内容。
  const dispatch = async (opts: { text: string; apiText?: string; imageUri?: string; base64?: string; media?: string }) => {
    const { text, apiText, imageUri, base64, media } = opts;
    if ((!text && !base64) || !userId || sending) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text, created_at: new Date().toISOString(), imageUri: imageUri ?? null },
    ]);
    setSending(true);
    scrollToEnd();
    try {
      const resp = await mirrorChat({
        user_id: userId,
        message: apiText ?? text,
        context: buildContext(),
        language: lang,
        conversation_id: convId,
        image_base64: base64,
        image_media_type: media,
      });
      const { reply, book } = resp;
      if (resp.conversation_id && resp.conversation_id !== convId) setConvId(resp.conversation_id);
      // 发完刷新对话列表（标题/预览/排序）
      loadConversations(userId);
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

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const q = quoted;
    setQuoted(null);
    // 带引用时：气泡显示干净文字，发给后端的内容前面带上被引用的话，雪宝就知道在接哪句。
    const apiText = q ? `（我想接着你刚说的这句聊：${q}）\n${text}` : undefined;
    dispatch({ text, apiText });
  };

  // 长按消息：复制 / 引用追问
  const onBubbleLongPress = (content: string) => {
    if (!content) return;
    const preview = content.length > 40 ? content.slice(0, 40) + '…' : content;
    Alert.alert(preview, undefined, [
      {
        text: t('mirror.copy'),
        onPress: async () => {
          try {
            const Clip = require('expo-clipboard');
            await Clip.setStringAsync(content);
          } catch {
            Alert.alert(t('mirror.needUpdate'));
          }
        },
      },
      { text: t('mirror.quote'), onPress: () => setQuoted(content) },
      { text: t('mirror.cancel'), style: 'cancel' },
    ]);
  };

  // 加号：从相册或拍照选图发给雪宝（看图）。
  const pickImage = async (fromCamera: boolean) => {
    setPlusOpen(false);
    let ImagePicker: typeof import('expo-image-picker');
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert(t('mirror.needUpdate'));
      return;
    }
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('mirror.needPermission'));
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.6,
          });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const a = res.assets[0];
      dispatch({ text: input.trim(), imageUri: a.uri, base64: a.base64!, media: a.mimeType || 'image/jpeg' });
      setInput('');
    } catch {
      Alert.alert(t('mirror.imageFail'));
    }
  };

  // 文件：选任意文件；图片类直接给雪宝看图，其他类型暂提示即将上线。
  const pickDocument = async () => {
    setPlusOpen(false);
    let DocumentPicker: typeof import('expo-document-picker');
    let FileSystem: typeof import('expo-file-system');
    try {
      DocumentPicker = require('expo-document-picker');
      FileSystem = require('expo-file-system');
    } catch {
      Alert.alert(t('mirror.needUpdate'));
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.mimeType?.startsWith('image/')) {
        const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' as any });
        dispatch({ text: input.trim(), imageUri: a.uri, base64: b64, media: a.mimeType });
        setInput('');
      } else {
        Alert.alert(t('mirror.fileSoon'));
      }
    } catch {
      Alert.alert(t('mirror.imageFail'));
    }
  };

  // 玫瑰麦克风：手机本地语音识别（免费，不走外部服务），转成文字填进输入框。
  const onMic = async () => {
    let SR: typeof import('expo-speech-recognition');
    try {
      SR = require('expo-speech-recognition');
    } catch {
      Alert.alert(t('mirror.voiceNeedRebuild'));
      return;
    }
    const mod: any = (SR as any).ExpoSpeechRecognitionModule;
    if (listening) {
      try { mod.stop(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    try {
      const perm = await mod.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('mirror.needPermission'));
        return;
      }
      if (!srSubsRef.current) {
        (SR as any).addSpeechRecognitionListener('result', (e: any) => {
          const txt = e?.results?.[0]?.transcript;
          if (txt) setInput(txt);
        });
        (SR as any).addSpeechRecognitionListener('end', () => setListening(false));
        (SR as any).addSpeechRecognitionListener('error', () => setListening(false));
        srSubsRef.current = true;
      }
      mod.start({ lang: lang === 'en' ? 'en-US' : 'zh-CN', interimResults: true, continuous: false });
      setListening(true);
    } catch {
      setListening(false);
      Alert.alert(t('mirror.voiceFail'));
    }
  };

  // ---- 多对话操作 ----
  const newChat = async () => {
    if (!userId) return;
    setDrawerOpen(false);
    try {
      const c = await createConversation(userId);
      setConversations((prev) => [c, ...prev]);
      await switchConversation(userId, c.id);
    } catch { /* ignore */ }
  };

  const openConversation = async (cid: string) => {
    setDrawerOpen(false);
    if (!userId || cid === convId) return;
    await switchConversation(userId, cid);
  };

  const startRename = () => {
    const cur = conversations.find((c) => c.id === convId);
    setRenameText(cur?.title ?? '');
    setMenuOpen(false);
    setRenameOpen(true);
  };
  const confirmRename = async () => {
    setRenameOpen(false);
    if (!userId || !convId) return;
    try { await updateConversation(convId, userId, { title: renameText.trim() }); loadConversations(userId); } catch { /* ignore */ }
  };

  const confirmDelete = () => {
    setMenuOpen(false);
    Alert.alert(t('mirror.delConvTitle'), t('mirror.delConvBody'), [
      { text: t('mirror.cancel'), style: 'cancel' },
      {
        text: t('mirror.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!userId || !convId) return;
          try { await deleteConversation(convId, userId); } catch { /* ignore */ }
          const cs = await loadConversations(userId);
          await switchConversation(userId, cs[0]?.id ?? null);
        },
      },
    ]);
  };

  const assignProject = async (pid: string) => {
    setProjectPickOpen(false);
    if (!userId || !convId) return;
    try { await updateConversation(convId, userId, { project_id: pid }); loadConversations(userId); } catch { /* ignore */ }
  };
  const confirmNewProject = async () => {
    const name = newProjectText.trim();
    setNewProjectOpen(false);
    setNewProjectText('');
    if (!userId || !name) return;
    try {
      const p = await createProject(userId, name);
      setProjects((prev) => [...prev, p]);
      if (convId) { await updateConversation(convId, userId, { project_id: p.id }); loadConversations(userId); }
    } catch { /* ignore */ }
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

  const renderConvRow = (c: Conversation) => (
    <Pressable
      key={c.id}
      onPress={() => openConversation(c.id)}
      style={({ pressed }) => [styles.convRow, c.id === convId && styles.convRowActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.convTitle, c.id === convId && { color: colors.terracotta }]} numberOfLines={1}>
        {c.title || c.preview || t('mirror.untitledChat')}
      </Text>
      {!!c.preview && c.title ? <Text style={styles.convPreview} numberOfLines={1}>{c.preview}</Text> : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          {/* 文件夹+：对话抽屉 */}
          <Pressable onPress={() => { loadConversations(userId ?? ''); setDrawerOpen(true); }} hitSlop={10} style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>🗂️</Text>
            <Text style={styles.headerPlus}>+</Text>
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>🪞 {t('mirror.title')}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{t('mirror.subtitle')}</Text>
        </View>
        <View style={[styles.headerSide, { justifyContent: 'flex-end' }]}>
          {/* 三横杠：对话菜单 */}
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
            <Text style={styles.hamburger}>☰</Text>
          </Pressable>
        </View>
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
                    <Pressable
                      onLongPress={() => onBubbleLongPress(m.content)}
                      delayLongPress={300}
                      style={[
                        styles.bubble,
                        m.role === 'user' ? styles.bubbleUser : styles.bubbleMirror,
                        m.imageUri && styles.bubbleWithImage,
                      ]}
                    >
                      {m.imageUri && (
                        <Image source={{ uri: m.imageUri }} style={styles.sentImage} resizeMode="cover" />
                      )}
                      {!!m.content && (
                        <Text
                          style={[
                            styles.bubbleText,
                            m.role === 'user' && { color: '#fff' },
                            m.imageUri && { marginTop: spacing.xs },
                          ]}
                        >
                          {m.content}
                        </Text>
                      )}
                    </Pressable>
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

        {quoted && (
          <View style={styles.quoteBar}>
            <View style={styles.quoteLine} />
            <Text style={styles.quoteText} numberOfLines={2}>{quoted}</Text>
            <Pressable onPress={() => setQuoted(null)} hitSlop={8}>
              <Text style={styles.quoteClose}>✕</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.inputBar}>
          {/* 玫瑰麦克风（本地语音识别） */}
          <Pressable onPress={onMic} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
            <Image source={require('../../assets/btn_mic.png')} style={[styles.iconImg, listening && styles.iconListening]} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('mirror.inputPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            onSubmitEditing={send}
          />
          {/* 加号（文件/相册/拍照） */}
          <Pressable onPress={() => setPlusOpen(true)} hitSlop={6} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
            <Image source={require('../../assets/btn_plus.png')} style={styles.iconImg} />
          </Pressable>
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

      {/* 加号：治愈系上传菜单（文件 / 相册 / 拍照） */}
      <Modal visible={plusOpen} transparent animationType="fade" onRequestClose={() => setPlusOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setPlusOpen(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{t('mirror.addTitle')}</Text>
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={pickDocument}>
              <Image source={require('../../assets/menu_file.png')} style={styles.menuIcon} />
              <Text style={styles.menuText}>{t('mirror.fromFile')}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={() => pickImage(false)}>
              <Image source={require('../../assets/menu_album.png')} style={styles.menuIcon} />
              <Text style={styles.menuText}>{t('mirror.fromAlbum')}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={() => pickImage(true)}>
              <Image source={require('../../assets/menu_camera.png')} style={styles.menuIcon} />
              <Text style={styles.menuText}>{t('mirror.fromCamera')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 对话抽屉（从左滑入） */}
      <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerWrap}>
          <SafeAreaView style={styles.drawerPanel} edges={['top', 'bottom']}>
            <Text style={styles.drawerTitle}>{t('mirror.myChats')}</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              {projects.map((p) => {
                const cs = conversations.filter((c) => c.project_id === p.id);
                if (cs.length === 0) return null;
                return (
                  <View key={p.id}>
                    <Text style={styles.drawerProject}>📁 {p.name}</Text>
                    {cs.map((c) => renderConvRow(c))}
                  </View>
                );
              })}
              {conversations.filter((c) => !c.project_id).map((c) => renderConvRow(c))}
            </ScrollView>
            {/* 左下角：新开聊天 */}
            <Pressable onPress={newChat} style={({ pressed }) => [styles.newChatBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.newChatIcon}>💬</Text>
              <Text style={styles.newChatText}>{t('mirror.newChat')}</Text>
            </Pressable>
          </SafeAreaView>
          <Pressable style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

      {/* 三横杠菜单 */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={() => { setMenuOpen(false); setProjectPickOpen(true); }}>
              <Text style={styles.menuText}>📁 {t('mirror.addToProject')}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={startRename}>
              <Text style={styles.menuText}>✏️ {t('mirror.renameChat')}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={confirmDelete}>
              <Text style={[styles.menuText, { color: colors.danger }]}>🗑️ {t('mirror.deleteChat')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 重命名 */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable style={styles.centerBackdrop} onPress={() => setRenameOpen(false)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <Text style={styles.dialogTitle}>{t('mirror.renameChat')}</Text>
            <TextInput style={styles.dialogInput} value={renameText} onChangeText={setRenameText} autoFocus maxLength={40} placeholder={t('mirror.namePlaceholder')} placeholderTextColor={colors.textFaint} />
            <View style={styles.dialogBtns}>
              <Pressable onPress={() => setRenameOpen(false)}><Text style={styles.dialogCancel}>{t('mirror.cancel')}</Text></Pressable>
              <Pressable onPress={confirmRename}><Text style={styles.dialogOk}>{t('mirror.ok')}</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 选择项目 */}
      <Modal visible={projectPickOpen} transparent animationType="fade" onRequestClose={() => setProjectPickOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setProjectPickOpen(false)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{t('mirror.addToProject')}</Text>
            {projects.map((p) => (
              <Pressable key={p.id} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={() => assignProject(p.id)}>
                <Text style={styles.menuText}>📁 {p.name}</Text>
              </Pressable>
            ))}
            <View style={styles.menuDivider} />
            <Pressable style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowOn]} onPress={() => { setProjectPickOpen(false); setNewProjectText(''); setNewProjectOpen(true); }}>
              <Text style={[styles.menuText, { color: colors.terracotta }]}>＋ {t('mirror.newProject')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 新建项目 */}
      <Modal visible={newProjectOpen} transparent animationType="fade" onRequestClose={() => setNewProjectOpen(false)}>
        <Pressable style={styles.centerBackdrop} onPress={() => setNewProjectOpen(false)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <Text style={styles.dialogTitle}>{t('mirror.newProject')}</Text>
            <TextInput style={styles.dialogInput} value={newProjectText} onChangeText={setNewProjectText} autoFocus maxLength={20} placeholder={t('mirror.projectNamePlaceholder')} placeholderTextColor={colors.textFaint} />
            <View style={styles.dialogBtns}>
              <Pressable onPress={() => setNewProjectOpen(false)}><Text style={styles.dialogCancel}>{t('mirror.cancel')}</Text></Pressable>
              <Pressable onPress={confirmNewProject}><Text style={styles.dialogOk}>{t('mirror.ok')}</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  bubbleWithImage: { padding: 4 },
  sentImage: { width: 180, height: 180, borderRadius: 12, backgroundColor: colors.snowShade },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  iconImg: { width: 36, height: 36, borderRadius: 18 },
  iconListening: { borderWidth: 2.5, borderColor: colors.terracotta },
  quoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
  },
  quoteLine: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.terracotta },
  quoteText: { flex: 1, ...typography.caption, color: colors.textMuted },
  quoteClose: { fontSize: 14, color: colors.textMuted, paddingHorizontal: 4 },

  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end', padding: spacing.lg, paddingBottom: spacing.xxl },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.soft,
  },
  menuTitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  menuRowOn: { backgroundColor: colors.bgSoft },
  menuIcon: { width: 30, height: 30, borderRadius: 15 },
  menuText: { ...typography.body, fontSize: 16, color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  headerSide: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 76 },
  headerIconBtn: { flexDirection: 'row', alignItems: 'flex-start' },
  headerIcon: { fontSize: 20 },
  headerPlus: { fontSize: 11, fontWeight: '800', color: colors.terracotta, marginLeft: -3, marginTop: -2 },
  hamburger: { fontSize: 22, color: colors.textMuted },

  drawerWrap: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.25)' },
  drawerPanel: { width: '78%', backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  drawerTitle: { ...typography.h2, marginTop: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  drawerProject: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, marginBottom: 4, paddingHorizontal: spacing.sm, fontWeight: '700' },
  convRow: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  convRowActive: { backgroundColor: colors.bgSoft },
  convTitle: { ...typography.body, fontSize: 15, color: colors.text },
  convPreview: { ...typography.caption, color: colors.textFaint, marginTop: 1 },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    marginBottom: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start',
  },
  newChatIcon: { fontSize: 18 },
  newChatText: { ...typography.body, fontWeight: '700', color: colors.terracotta },

  centerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: spacing.xl },
  dialogCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  dialogTitle: { ...typography.h3, marginBottom: spacing.md },
  dialogInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, height: 46, fontSize: 16, color: colors.text, backgroundColor: colors.bg,
  },
  dialogBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xl, marginTop: spacing.lg },
  dialogCancel: { ...typography.body, color: colors.textMuted },
  dialogOk: { ...typography.body, color: colors.terracotta, fontWeight: '700' },

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
