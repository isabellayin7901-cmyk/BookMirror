import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { useI18n } from '../lib/LanguageContext';
import { fetchReaderBooks, findBookByMemory, fetchBooksByIds, type ReaderBookMeta, type FindResult } from '../lib/api';
import { BookDetailModal } from '../components/BookDetailModal';
import type { Book, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
    setBooks(await fetchReaderBooks());
    setLoading(false);
  }, []);

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
            >
              <View style={[styles.cover, { backgroundColor: SPINES[index % SPINES.length] }]}>
                <Text style={styles.coverTitle} numberOfLines={4}>{item.title}</Text>
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

  card: { flex: 1, marginBottom: spacing.lg },
  cover: { aspectRatio: 0.7, borderRadius: radius.md, padding: spacing.md, justifyContent: 'flex-start', ...{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } } },
  coverTitle: { color: '#fff', fontWeight: '800', fontSize: 17, lineHeight: 24, fontFamily: 'ZCOOLKuaiLe_400Regular' },
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
