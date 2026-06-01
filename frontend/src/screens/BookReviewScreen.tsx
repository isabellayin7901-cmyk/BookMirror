import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle } from '../lib/bookDisplay';
import { submitReview, fetchMyReview, type Difficulty } from '../lib/api';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BookReview'>;

const DIFFICULTIES: Difficulty[] = ['too_easy', 'just_right', 'too_hard'];
const EMOTIONS = ['healing', 'clarity', 'inspired', 'resonant', 'understood', 'awakened', 'painful', 'numb'];
const PROBLEMS = ['overthinking', 'anxiety', 'procrastination', 'low_confidence', 'people_pleasing', 'confusion', 'loneliness'];
const DIMENSIONS = ['expression', 'emotion', 'execution', 'self_awareness', 'relationship'];

type GrowthState = Record<string, { before: number; after: number }>;

export function BookReviewScreen({ navigation, route }: Props) {
  const { book } = route.params;
  const { t, lang } = useI18n();

  const [userId, setUserId] = useState<string>('');
  const [rating, setRating] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('just_right');
  const [emotions, setEmotions] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [recommend, setRecommend] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [growth, setGrowth] = useState<GrowthState>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await storage.getUserId();
      setUserId(id);
      try {
        const mine = await fetchMyReview(id, book.id);
        if (mine) {
          setRating(mine.rating);
          setDifficulty(mine.difficulty);
          setEmotions(mine.emotions);
          setText(mine.text);
          setRecommend(mine.recommend_similar);
          setAnonymous(mine.anonymous);
          setProblems(mine.helped_problems);
          setGrowth(mine.growth || {});
        }
      } catch {
        /* 没有旧反馈就空着 */
      }
    })();
  }, [book.id]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const toggleDimension = (d: string) => {
    setGrowth((g) => {
      const next = { ...g };
      if (next[d]) delete next[d];
      else next[d] = { before: 50, after: 50 };
      return next;
    });
  };

  const submit = async () => {
    if (rating < 1) {
      Alert.alert(t('review.needRating'));
      return;
    }
    setLoading(true);
    try {
      const profile = await storage.getUserProfile();
      await submitReview({
        user_id: userId,
        book_id: book.id,
        rating,
        difficulty,
        emotions,
        text: text.trim(),
        recommend_similar: recommend,
        anonymous,
        mbti: profile?.mbti ?? null,
        growth,
        helped_problems: problems,
      });
      Alert.alert(t('review.thanks'));
      navigation.goBack();
    } catch {
      Alert.alert(t('review.submitFail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={typography.h1}>{t('review.title')}</Text>
        <Text style={styles.bookName}>{bookTitle(book, lang)}</Text>

        {/* 总体评分 */}
        <Text style={styles.section}>{t('review.rating')}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
              <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
            </Pressable>
          ))}
        </View>

        {/* 难度 */}
        <Text style={styles.section}>{t('review.difficulty')}</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => (
            <Pressable key={d} onPress={() => setDifficulty(d)} style={[styles.chip, difficulty === d && styles.chipOn]}>
              <Text style={[styles.chipText, difficulty === d && styles.chipTextOn]}>{t(`review.diff.${d}`)}</Text>
            </Pressable>
          ))}
        </View>

        {/* 读后情绪 */}
        <Text style={styles.section}>{t('review.emotions')}</Text>
        <View style={styles.chipRow}>
          {EMOTIONS.map((e) => (
            <Pressable key={e} onPress={() => toggle(emotions, e, setEmotions)} style={[styles.chip, emotions.includes(e) && styles.chipOn]}>
              <Text style={[styles.chipText, emotions.includes(e) && styles.chipTextOn]}>{t(`review.emo.${e}`)}</Text>
            </Pressable>
          ))}
        </View>

        {/* 心里话 */}
        <Text style={styles.section}>{t('review.text')}</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(s) => setText(s.slice(0, 2000))}
          multiline
          placeholder={t('review.textPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        {/* 解决了什么问题 */}
        <Text style={styles.section}>{t('review.helped')}</Text>
        <View style={styles.chipRow}>
          {PROBLEMS.map((p) => (
            <Pressable key={p} onPress={() => toggle(problems, p, setProblems)} style={[styles.chip, problems.includes(p) && styles.chipOn]}>
              <Text style={[styles.chipText, problems.includes(p) && styles.chipTextOn]}>{t(`review.prob.${p}`)}</Text>
            </Pressable>
          ))}
        </View>

        {/* 成长自评（选填） */}
        <Text style={styles.section}>{t('review.growth')}</Text>
        <Text style={styles.hint}>{t('review.growthHint')}</Text>
        <View style={styles.chipRow}>
          {DIMENSIONS.map((d) => (
            <Pressable key={d} onPress={() => toggleDimension(d)} style={[styles.chip, growth[d] && styles.chipOn]}>
              <Text style={[styles.chipText, growth[d] && styles.chipTextOn]}>{t(`review.dim.${d}`)}</Text>
            </Pressable>
          ))}
        </View>
        {DIMENSIONS.filter((d) => growth[d]).map((d) => (
          <View key={d} style={styles.growthCard}>
            <Text style={styles.growthName}>{t(`review.dim.${d}`)}</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('review.before')}</Text>
              <Slider
                style={{ flex: 1 }}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={growth[d].before}
                minimumTrackTintColor={colors.textMuted}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.textMuted}
                onValueChange={(v) => setGrowth((g) => ({ ...g, [d]: { ...g[d], before: Math.round(v) } }))}
              />
              <Text style={styles.sliderVal}>{growth[d].before}</Text>
            </View>
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.terracotta }]}>{t('review.after')}</Text>
              <Slider
                style={{ flex: 1 }}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={growth[d].after}
                minimumTrackTintColor={colors.terracotta}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.terracotta}
                onValueChange={(v) => setGrowth((g) => ({ ...g, [d]: { ...g[d], after: Math.round(v) } }))}
              />
              <Text style={[styles.sliderVal, { color: colors.terracotta }]}>{growth[d].after}</Text>
            </View>
            <Text style={styles.delta}>
              {growth[d].after - growth[d].before >= 0 ? '+' : ''}
              {growth[d].after - growth[d].before}
            </Text>
          </View>
        ))}

        {/* 推荐给相似人格 + 匿名 */}
        <Pressable style={styles.toggleRow} onPress={() => setRecommend((v) => !v)}>
          <Text style={styles.toggleLabel}>{t('review.recommend')}</Text>
          <View style={[styles.switch, recommend && styles.switchOn]}>
            <View style={[styles.knob, recommend && styles.knobOn]} />
          </View>
        </Pressable>
        <Pressable style={styles.toggleRow} onPress={() => setAnonymous((v) => !v)}>
          <Text style={styles.toggleLabel}>{t('review.anonymous')}</Text>
          <View style={[styles.switch, anonymous && styles.switchOn]}>
            <View style={[styles.knob, anonymous && styles.knobOn]} />
          </View>
        </Pressable>

        <PrimaryButton
          title={t('review.submit')}
          style={{ marginTop: spacing.xl }}
          disabled={rating < 1}
          loading={loading}
          onPress={submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bookName: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  section: { ...typography.h3, marginTop: spacing.xl, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textFaint, marginTop: -spacing.sm, marginBottom: spacing.sm },

  starsRow: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 38, color: colors.border },
  starOn: { color: '#E6A23C' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, fontSize: 14, color: colors.text },
  chipTextOn: { color: '#fff', fontWeight: '600' },

  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlignVertical: 'top',
    fontSize: 15,
  },

  growthCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  growthName: { ...typography.body, fontWeight: '700', marginBottom: spacing.xs },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sliderLabel: { ...typography.caption, width: 40, color: colors.textMuted },
  sliderVal: { ...typography.caption, width: 30, textAlign: 'right', color: colors.text },
  delta: { ...typography.body, fontWeight: '700', color: colors.terracotta, textAlign: 'right', marginTop: 2 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.text },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.success },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
