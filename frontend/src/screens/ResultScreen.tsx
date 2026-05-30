import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { Bunny } from '../illustrations/Bunny';
import { Sparkle, Heart, Leaf } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { t } from '../lib/i18n';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle, bookAuthor } from '../lib/bookDisplay';
import type { Book, BookRecommendation, Language, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export function ResultScreen({ navigation, route }: Props) {
  const { lang: language } = useI18n();
  const result = route.params?.result;

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ ...typography.body, padding: spacing.lg }}>No result.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 小兔子在画像卡顶部 */}
        <View style={styles.bunnyHeader}>
          <Bunny size={100} pose="wave" />
        </View>

        <View style={[styles.profileCard, shadow.soft]}>
          <View style={styles.titleRow}>
            <Sparkle size={14} />
            <Text style={styles.sectionTitle}>{t('result.profile', language)}</Text>
          </View>
          <WavyUnderline width={90} />
          <Text style={styles.profileDesc}>{result.profile.description}</Text>
          <View style={styles.keywordRow}>
            {result.profile.keywords.map((k, idx) => {
              const tones = [colors.rose, colors.sage, colors.lavender];
              return (
                <View key={k} style={[styles.keywordTag, { backgroundColor: tones[idx % 3] }]}>
                  <Text style={styles.keywordText}>{k}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Heart size={14} />
            <Text style={styles.sectionTitle}>{t('result.gaps', language)}</Text>
          </View>
          <WavyUnderline width={120} color={colors.rose} />
          {result.growth_gaps.map((g, i) => (
            <View key={i} style={styles.gapItem}>
              <Text style={styles.gapBullet}>{i + 1}</Text>
              <Text style={styles.gapText}>{g}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Leaf size={16} />
            <Text style={styles.sectionTitle}>{t('result.recs', language)}</Text>
          </View>
          <WavyUnderline width={150} color={colors.sage} />
          {result.recommendations.map((rec) => {
            const book = result.books.find((b) => b.id === rec.book_id);
            if (!book) return null;
            return (
              <BookCard
                key={rec.book_id}
                rec={rec}
                book={book}
                language={language}
                isFirst={rec.order === 1}
              />
            );
          })}
        </View>

        <Text style={styles.disclaimer}>{t('result.disclaimer', language)}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={t('result.toHome', language)}
          variant="secondary"
          style={{ flex: 1, marginRight: spacing.sm }}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
        />
        <PrimaryButton
          title={t('result.toFeedback', language)}
          style={{ flex: 1, marginLeft: spacing.sm }}
          onPress={() => navigation.navigate('Feedback', { books: result.books })}
        />
      </View>
    </SafeAreaView>
  );
}

interface CardProps {
  rec: BookRecommendation;
  book: Book;
  language: Language;
  isFirst: boolean;
}

function BookCard({ rec, book, language, isFirst }: CardProps) {
  const [expanded, setExpanded] = useState(isFirst);
  const stars = useMemo(() => '★'.repeat(book.difficulty) + '☆'.repeat(5 - book.difficulty), [book.difficulty]);

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={styles.bookCard}>
      <View style={{ flexDirection: 'row' }}>
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>{bookTitle(book, language).slice(0, 2)}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          {isFirst && <Text style={styles.startHere}>{t('result.startHere', language)}</Text>}
          <Text style={styles.bookTitle}>
            {rec.order}. {bookTitle(book, language)}
          </Text>
          <Text style={styles.bookAuthor}>{bookAuthor(book, language)}</Text>
          <Text style={styles.bookDiff}>{stars}</Text>
        </View>
      </View>

      <Text style={styles.whyLabel}>{t('result.why', language)}</Text>
      <Text style={styles.whyText}>{rec.why_for_you}</Text>

      {expanded && (
        <View style={styles.focusBlock}>
          <Text style={styles.focusLabel}>{t('result.focus', language)}</Text>
          {rec.key_focus.map((f, i) => (
            <Text key={i} style={styles.focusItem}>
              · {f}
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { ...typography.h2, marginLeft: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  bunnyHeader: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: 0 },
  profileCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileDesc: { ...typography.body, marginBottom: spacing.md },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap' },
  keywordTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  keywordText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  gapItem: { flexDirection: 'row', marginBottom: spacing.md },
  gapBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.terracotta,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 13,
    fontWeight: '700',
    marginRight: spacing.md,
  },
  gapText: { ...typography.body, flex: 1 },

  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 70, height: 100, borderRadius: radius.sm, backgroundColor: colors.border },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { color: colors.textMuted, fontWeight: '700' },
  startHere: { color: colors.terracotta, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  bookTitle: { ...typography.h3 },
  bookAuthor: { ...typography.caption, marginTop: 2 },
  bookDiff: { color: colors.terracotta, marginTop: spacing.xs, letterSpacing: 2 },

  whyLabel: { ...typography.caption, marginTop: spacing.md, fontWeight: '700', color: colors.primary },
  whyText: { ...typography.body, marginTop: spacing.xs },

  focusBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  focusLabel: { ...typography.caption, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  focusItem: { ...typography.body, marginTop: 2 },

  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
