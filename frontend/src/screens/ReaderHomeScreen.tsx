import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { useI18n } from '../lib/LanguageContext';
import {
  fetchReaderBooks, findBookByMemory, fetchBooksByIds, fetchPrivateBooks, deletePrivateBook,
  type ReaderBookMeta, type FindResult,
} from '../lib/api';
import { storage } from '../lib/storage';
import { isPrivateBook } from '../lib/readerSource';
import { pickAndUploadBook, PickCancelled, uploadErrorText } from '../lib/privateShelf';
import { BookDetailModal } from '../components/BookDetailModal';
import { DEMO_BOOKS } from '../data/demoBooks';
import type { Book, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 两列：卡片固定半行宽，书的数量为奇数时最后一本不会被拉满整行
const CARD_W = (Dimensions.get('window').width - spacing.lg * 2 - spacing.md) / 2;

// 给书脊一点暖色变化
const SPINES = ['#C97B63', '#7D9D8C', '#B58A5E', '#8A7CA8', '#6F94B8', '#B06C7E'];

export function ReaderHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [books, setBooks] = useState<ReaderBookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const [result, setResult] = useState<FindResult | null>(null);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [uploading, setUploading] = useState(false);

  const runFind = async () => {
    const q = query.trim();
    if (!q || finding) return;
    setFinding(true);
    setResult(null);
    setResult(await findBookByMemory(q, lang));
    setFinding(false);
  };

  const openCandidate = async (c: FindResult['candidates'][number]) => {
    if (c.source === 'reader') {
      setFindOpen(false);
      navigation.navigate('Reader', { bookId: c.book_id, title: c.title });
    } else {
      const [b] = await fetchBooksByIds([c.book_id]);
      if (b) setDetailBook(b);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    // 示例书排在最前（本地数据，演示多版本阅读 / 划选 / AI 翻译），后面是书库里的书
    const demos: ReaderBookMeta[] = DEMO_BOOKS.map((d) => ({
      book_id: d.bookId,
      title: lang === 'en' ? d.titleEn : d.title,
      chapters: d.chapters[d.editions[0].id].length,
    }));
    // 私人书架（只有自己能看到）排最前
    const uid = await storage.getUserId();
    const [mine, library] = await Promise.all([fetchPrivateBooks(uid), fetchReaderBooks()]);
    const privateBooks: ReaderBookMeta[] = mine.map((b) => ({ book_id: b.book_id, title: b.title, chapters: b.chapters ?? 0 }));
    setBooks([...privateBooks, ...demos, ...library]);
    setLoading(false);
  }, [lang]);

  const upload = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const uid = await storage.getUserId();
      const b = await pickAndUploadBook(uid);
      await load();
      navigation.navigate('Reader', { bookId: b.book_id, title: b.title });
    } catch (err) {
      if (!(err instanceof PickCancelled)) Alert.alert(t('shelf.uploadFailed'), uploadErrorText(err, t));
    } finally {
      setUploading(false);
    }
  };

  const removePrivate = (item: ReaderBookMeta) => {
    Alert.alert(t('shelf.deleteTitle'), t('shelf.deleteMsg', { title: item.title }), [
      { text: t('dm.cancel'), style: 'cancel' },
      {
        text: t('msgMenu.delete'), style: 'destructive',
        onPress: async () => {
          const uid = await storage.getUserId();
          if (await deletePrivateBook(uid, item.book_id)) load();
          else Alert.alert(t('shelf.deleteFailed'));
        },
      },
    ]);
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>{t('reader.shelf')}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* 凭印象找书 */}
      <Pressable style={styles.findBar} onPress={() => { setQuery(''); setResult(null); setFindOpen(true); }}>
        <Text style={styles.findIcon}>🔮</Text>
        <Text style={styles.findHint}>{t('reader.findHint')}</Text>
      </Pressable>

      {/* 私人书架：上传自己的电子书，只有自己能看到 */}
      <View style={styles.uploadRow}>
        <Pressable onPress={upload} disabled={uploading} style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}>
          {uploading ? <ActivityIndicator size="small" color={colors.terracotta} /> : null}
          <Text style={styles.uploadText}>{uploading ? t('shelf.uploading') : t('shelf.upload')}</Text>
        </Pressable>
        <Text style={styles.uploadHint}>{t('shelf.uploadHint')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.book_id}
          numColumns={2}
          contentContainerStyle={{ padding: spacing.lg }}
          columnWrapperStyle={{ gap: spacing.md }}
          ListEmptyComponent={<Text style={styles.empty}>{t('reader.empty')}</Text>}
          renderItem={({ item, index }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('Reader', { bookId: item.book_id, title: item.title })}
              onLongPress={isPrivateBook(item.book_id) ? () => removePrivate(item) : undefined}
            >
              <View style={[styles.cover, { backgroundColor: SPINES[index % SPINES.length] }]}>
                <Text style={styles.coverTitle} numberOfLines={4}>{item.title}</Text>
                {item.book_id.startsWith('demo_') && (
                  <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>{t('reader.demoTag')}</Text></View>
                )}
                {isPrivateBook(item.book_id) && (
                  <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>🔒 {t('shelf.privateTag')}</Text></View>
                )}
              </View>
              <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.bookMeta}>{item.chapters} {t('reader.chapters')}</Text>
            </Pressable>
          )}
        />
      )}

      {/* 凭印象找书 弹窗 */}
      <Modal visible={findOpen} animationType="slide" onRequestClose={() => setFindOpen(false)}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={() => setFindOpen(false)} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
            <Text style={styles.title}>{t('reader.findTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
              <Text style={styles.findLead}>{t('reader.findLead')}</Text>
              <TextInput
                style={styles.findInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('reader.findPlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                autoFocus
              />
              <Pressable onPress={runFind} disabled={!query.trim() || finding} style={[styles.findBtn, (!query.trim() || finding) && { opacity: 0.5 }]}>
                <Text style={styles.findBtnText}>{finding ? t('reader.finding') : t('reader.findGo')}</Text>
              </Pressable>

              {finding && (
                <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
                  <Snowman size={48} pose="wave" />
                  <Text style={styles.findThinking}>{t('reader.findThinking')}</Text>
                </View>
              )}

              {result && !finding && (
                <View style={styles.resultBox}>
                  {!!result.answer && <Text style={styles.answerText}>{result.answer}</Text>}
                  {result.candidates.map((c) => (
                    <Pressable key={c.source + c.book_id} style={styles.candRow} onPress={() => openCandidate(c)}>
                      <Text style={styles.candIcon}>{c.source === 'reader' ? '📖' : '🔎'}</Text>
                      <Text style={styles.candTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.candTag}>{c.source === 'reader' ? t('reader.inShelf') : t('reader.inCatalog')}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          <BookDetailModal visible={detailBook !== null} book={detailBook} onClose={() => setDetailBook(null)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 30, color: colors.textMuted, width: 28 },
  title: { ...typography.h3 },
  empty: { ...typography.body, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xxl },

  card: { width: CARD_W, marginBottom: spacing.lg },
  cover: { aspectRatio: 0.7, borderRadius: radius.md, padding: spacing.md, justifyContent: 'flex-start', ...{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } } },
  coverTitle: { color: '#fff', fontWeight: '800', fontSize: 17, lineHeight: 24, fontFamily: 'ZCOOLKuaiLe_400Regular' },
  uploadRow: { marginHorizontal: spacing.lg, marginBottom: spacing.xs },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderDashed, backgroundColor: colors.surface },
  uploadText: { ...typography.body, fontWeight: '600', color: colors.primary },
  uploadHint: { ...typography.caption, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  demoBadge: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  demoBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  bookTitle: { ...typography.body, fontWeight: '600', marginTop: spacing.sm },
  bookMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  findBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  findIcon: { fontSize: 15 },
  findHint: { ...typography.body, color: colors.textMuted, flex: 1 },

  findLead: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  findInput: { minHeight: 96, ...typography.body, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, textAlignVertical: 'top' },
  findBtn: { marginTop: spacing.md, backgroundColor: colors.terracotta, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  findBtnText: { color: '#fff', fontWeight: '700' },
  findThinking: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  resultBox: { marginTop: spacing.xl },
  answerText: { ...typography.body, fontSize: 16, lineHeight: 25, color: colors.text, marginBottom: spacing.lg },
  candRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  candIcon: { fontSize: 16 },
  candTitle: { ...typography.body, fontWeight: '600', flex: 1 },
  candTag: { ...typography.caption, color: colors.terracotta },
});
