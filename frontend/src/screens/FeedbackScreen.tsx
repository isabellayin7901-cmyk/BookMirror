import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { storage } from '../lib/storage';
import { submitFeedback } from '../lib/api';
import { t } from '../lib/i18n';
import type { FeedbackReaction, Language, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

const REACTIONS: FeedbackReaction[] = ['useful', 'too_hard', 'not_interested', 'want_similar'];

const REACTION_LABEL_KEY: Record<FeedbackReaction, string> = {
  useful: 'feedback.useful',
  too_hard: 'feedback.tooHard',
  not_interested: 'feedback.notInterested',
  want_similar: 'feedback.wantSimilar',
};

export function FeedbackScreen({ navigation, route }: Props) {
  const { books } = route.params;
  const [language, setLanguage] = useState<Language>('zh');
  const [bookId, setBookId] = useState<string>(books[0]?.id ?? '');
  const [reaction, setReaction] = useState<FeedbackReaction | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    storage.getSettings().then((s) => setLanguage(s.language));
  }, []);

  const submit = async () => {
    if (!bookId || !reaction) return;
    setLoading(true);
    try {
      const profile = await storage.getUserProfile();
      await storage.appendFeedback({ book_id: bookId, reaction, note });
      try {
        await submitFeedback({
          book_id: bookId,
          reaction,
          note,
          user_profile: profile ?? undefined,
        });
      } catch {
        // network failure is non-fatal; local copy is saved
      }
      Alert.alert(t('feedback.thanks', language));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={typography.h1}>{t('feedback.title', language)}</Text>

        <Text style={[typography.h3, { marginTop: spacing.lg }]}>
          {t('feedback.pickBook', language)}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          {books.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBookId(b.id)}
              style={[styles.bookRow, bookId === b.id && styles.bookRowSelected]}
            >
              <Text style={[styles.bookRowText, bookId === b.id && styles.bookRowTextSelected]}>
                {b.title}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          {REACTIONS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setReaction(r)}
              style={[styles.reaction, reaction === r && styles.reactionSelected]}
            >
              <Text style={[styles.reactionText, reaction === r && styles.reactionTextSelected]}>
                {t(REACTION_LABEL_KEY[r], language)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[typography.caption, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          {t('feedback.note', language)}
        </Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={(s) => setNote(s.slice(0, 300))}
          multiline
          placeholder="…"
          placeholderTextColor={colors.textMuted}
        />

        <PrimaryButton
          title={t('feedback.submit', language)}
          style={{ marginTop: spacing.lg }}
          disabled={!bookId || !reaction}
          loading={loading}
          onPress={submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bookRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  bookRowSelected: { borderColor: colors.primary, backgroundColor: colors.bg },
  bookRowText: { ...typography.body },
  bookRowTextSelected: { color: colors.primary, fontWeight: '700' },
  reaction: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  reactionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  reactionText: { ...typography.body, fontWeight: '600' },
  reactionTextSelected: { color: '#fff' },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlignVertical: 'top',
  },
});
