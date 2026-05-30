import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle, Heart } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { Cat } from '../illustrations/Cat';
import { storage } from '../lib/storage';
import { fetchBooksByIds } from '../lib/api';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle, bookAuthor, bookSummary } from '../lib/bookDisplay';
import { BookDetailModal } from '../components/BookDetailModal';
import type { Book } from '../types';

export function MyFavoritesScreen() {
  const navigation = useNavigation();
  const { t, lang } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const load = useCallback(async () => {
    const stored = await storage.getFavorites();
    setBooks(stored);
    // 用最新书数据重新水合（补上英文书名/作者/简介等字段），失败则保留本地数据
    if (stored.length > 0) {
      try {
        const fresh = await fetchBooksByIds(stored.map((b) => b.id));
        if (fresh.length > 0) {
          const freshById = new Map(fresh.map((b) => [b.id, b]));
          // 保持原顺序，用最新数据覆盖；后端查不到的（如已下架）保留本地副本
          const merged = stored.map((b) => freshById.get(b.id) ?? b);
          setBooks(merged);
          await storage.setFavorites(merged);
        }
      } catch {
        /* 网络失败时静默，继续用本地收藏数据 */
      }
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.titleRow}>
          <Heart size={18} />
          <Text style={styles.title}>{t('favorites.title')}</Text>
        </View>
        <WavyUnderline width={80} color={colors.rose} />
        <Text style={styles.subtitle}>{t('favorites.subtitle')}</Text>

        {books.length === 0 ? (
          <View style={styles.empty}>
            <Cat size={120} />
            <Text style={styles.emptyTitle}>{t('favorites.emptyTitle')}</Text>
            <Text style={styles.emptyHint}>
              {t('favorites.emptyHint')}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            {books.map((book) => (
              <Pressable
                key={book.id}
                onPress={() => setSelectedBook(book)}
                style={({ pressed }) => [
                  styles.card,
                  shadow.soft,
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
                ]}
              >
                {book.cover_url ? (
                  <Image source={{ uri: book.cover_url }} style={styles.cover} />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Text style={styles.coverText}>{bookTitle(book, lang).slice(0, 2)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.bookTitle}>{bookTitle(book, lang)}</Text>
                  <Text style={styles.bookAuthor}>{bookAuthor(book, lang)}</Text>
                  <Text style={styles.bookSummary} numberOfLines={2}>{bookSummary(book, lang)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 书详情弹窗（关闭时重新加载，反映取消收藏） */}
      <BookDetailModal
        visible={!!selectedBook}
        book={selectedBook}
        onClose={() => {
          setSelectedBook(null);
          load();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, marginLeft: spacing.xs },
  subtitle: { ...typography.caption, marginTop: spacing.sm },

  empty: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { ...typography.h3, marginTop: spacing.md, color: colors.textMuted },
  emptyHint: { ...typography.caption, textAlign: 'center', marginTop: spacing.sm },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 60, height: 86, borderRadius: radius.sm },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
  },
  coverText: { color: colors.textMuted, fontWeight: '700' },
  bookTitle: { ...typography.h3, fontSize: 15 },
  bookAuthor: { ...typography.caption, marginTop: 2 },
  bookSummary: { ...typography.caption, marginTop: 6, lineHeight: 18 },
});
