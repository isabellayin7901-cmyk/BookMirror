import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { useI18n } from '../lib/LanguageContext';
import { fetchReaderBooks, type ReaderBookMeta } from '../lib/api';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 给书脊一点暖色变化
const SPINES = ['#C97B63', '#7D9D8C', '#B58A5E', '#8A7CA8', '#6F94B8', '#B06C7E'];

export function ReaderHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const [books, setBooks] = useState<ReaderBookMeta[]>([]);
  const [loading, setLoading] = useState(true);

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
});
