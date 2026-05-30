import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { Chip } from '../components/Chip';
import { QuestionCard } from '../components/QuestionCard';
import { Bunny } from '../illustrations/Bunny';
import { Sparkle, Heart } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { storage, profileSignature } from '../lib/storage';
import { fetchRecommendation, inferMbti } from '../lib/api';
import { t } from '../lib/i18n';
import { useI18n } from '../lib/LanguageContext';
import { GOAL_KEYS, PREFERENCE_KEYS, PROBLEM_KEYS } from '../data/tags';
import {
  QUICK_QUESTIONS,
  FULL_QUESTIONS,
  type AnswerValue,
  type MbtiAnswer,
  type MbtiQuestion,
} from '../data/mbtiQuestions';
import type { Language, MBTI, RootStackParamList, UserProfile } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Quiz'>;

const MBTI_PAIRS: [string, string][] = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];

type Step1Mode =
  | { kind: 'choose' }
  | { kind: 'self' }
  | { kind: 'modePick' }
  | { kind: 'quiz'; questions: MbtiQuestion[]; mode: 'quick' | 'full' }
  | { kind: 'inferred'; mbti: MBTI; confidence: number; reasoning: string };

export function QuizScreen({ navigation, route }: Props) {
  const { lang: language } = useI18n();
  const onboarding = route.params?.onboarding ?? false;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [step1, setStep1] = useState<Step1Mode>({ kind: 'choose' });
  const [mbtiLetters, setMbtiLetters] = useState<Record<number, string>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<number, AnswerValue>>({});
  const [inferring, setInferring] = useState(false);
  const [mbtiSource, setMbtiSource] = useState<'self' | 'quiz'>('self');

  // Steps 2–4
  const [goals, setGoals] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [depth, setDepth] = useState(5);
  const [problems, setProblems] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');

  const selfMbti = useMemo<MBTI | null>(() => {
    const letters = MBTI_PAIRS.map((_, i) => mbtiLetters[i]).join('');
    return letters.length === 4 ? (letters as MBTI) : null;
  }, [mbtiLetters]);

  const finalMbti: MBTI | null =
    step1.kind === 'self'
      ? selfMbti
      : step1.kind === 'inferred'
      ? step1.mbti
      : null;

  const toggle = (arr: string[], set: (v: string[]) => void, key: string, max?: number) => {
    if (arr.includes(key)) set(arr.filter((k) => k !== key));
    else if (!max || arr.length < max) set([...arr, key]);
  };

  const submitQuizForInference = async (questions: MbtiQuestion[], mode: 'quick' | 'full') => {
    const payload: MbtiAnswer[] = questions
      .filter((q) => quizAnswers[q.id])
      .map((q) => ({
        question_id: q.id,
        question_text: q.text,
        answer: quizAnswers[q.id],
      }));
    if (payload.length < questions.length) {
      Alert.alert(t('quiz.answerAll', language));
      return;
    }
    setInferring(true);
    try {
      const r = await inferMbti(payload, mode, language);
      setMbtiSource('quiz');
      setStep1({ kind: 'inferred', mbti: r.mbti, confidence: r.confidence, reasoning: r.reasoning });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'MBTI inference failed');
    } finally {
      setInferring(false);
    }
  };

  const canNext = (): boolean => {
    if (step === 1) return finalMbti !== null;
    if (step === 2) return goals.length > 0;
    if (step === 3) return preferences.length > 0;
    if (step === 4) return problems.length > 0 || freeText.trim().length > 0;
    return false;
  };

  const submit = async () => {
    if (!finalMbti) return;
    const profile: UserProfile = {
      mbti: finalMbti,
      mbti_source: mbtiSource,
      goals,
      preferences,
      depth,
      problems,
      free_text: freeText.trim(),
      language,
    };
    setLoading(true);
    try {
      await storage.setUserProfile(profile);
      await storage.setOnboarded(true);  // 拿到 MBTI 后即标记已完成首次启动
      const result = await fetchRecommendation(profile);
      await storage.setLastResult(result);
      await storage.setRecommendSignature(profileSignature(profile));
      // 引导模式：困扰页之后直接进破壳日测评，阅读画像放到综合测评里再展示；
      // 书单已存好，进 App 后在「今日推荐」里和综合画像一起看。
      if (onboarding) {
        navigation.replace('Astrology', { onboarding: true });
      } else {
        navigation.replace('Result', { result, onboarding });
      }
    } catch (e: any) {
      Alert.alert(
        t('quiz.netErrTitle', language),
        t('quiz.netErrMsg', language),
        [
          {
            text: t('quiz.ok', language),
            onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] }),
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.stepLabel}>{t('quiz.step', language, { n: step })}</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {step === 1 && (
          <Step1
            language={language}
            state={step1}
            setState={setStep1}
            letters={mbtiLetters}
            setLetters={setMbtiLetters}
            selfMbti={selfMbti}
            onPickSelf={() => {
              setMbtiSource('self');
              setStep1({ kind: 'self' });
            }}
            onPickUnknown={() => setStep1({ kind: 'modePick' })}
            onPickMode={(mode) =>
              setStep1({
                kind: 'quiz',
                mode,
                questions: mode === 'quick' ? QUICK_QUESTIONS : FULL_QUESTIONS,
              })
            }
            answers={quizAnswers}
            onAnswer={(qid, a) => setQuizAnswers((s) => ({ ...s, [qid]: a }))}
            onSubmitQuiz={submitQuizForInference}
            inferring={inferring}
          />
        )}

        {step === 2 && (
          <>
            <Text style={typography.h2}>{t('quiz.step2.title', language)}</Text>
            <View style={styles.chipsWrap}>
              {GOAL_KEYS.map((k) => (
                <Chip
                  key={k}
                  label={t(`goal.${k}`, language)}
                  selected={goals.includes(k)}
                  onPress={() => toggle(goals, setGoals, k, 3)}
                  disabled={!goals.includes(k) && goals.length >= 3}
                />
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={typography.h2}>{t('quiz.step3.title', language)}</Text>
            <View style={styles.chipsWrap}>
              {PREFERENCE_KEYS.map((k) => (
                <Chip
                  key={k}
                  label={t(`pref.${k}`, language)}
                  selected={preferences.includes(k)}
                  onPress={() => toggle(preferences, setPreferences, k)}
                />
              ))}
            </View>

            <Text style={[typography.h3, { marginTop: spacing.lg }]}>
              {t('quiz.step3.depth', language)}: {depth}/10
            </Text>
            <View style={styles.sliderRow}>
              <Text style={typography.caption}>{t('quiz.step3.depthLight', language)}</Text>
              <Slider
                style={{ flex: 1, marginHorizontal: spacing.md }}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={depth}
                onValueChange={setDepth}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text style={typography.caption}>{t('quiz.step3.depthDeep', language)}</Text>
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={typography.h2}>{t('quiz.step4.title', language)}</Text>
            <View style={styles.chipsWrap}>
              {PROBLEM_KEYS.map((k) => (
                <Chip
                  key={k}
                  label={t(`problem.${k}`, language)}
                  selected={problems.includes(k)}
                  onPress={() => toggle(problems, setProblems, k)}
                />
              ))}
            </View>

            <Text style={[typography.caption, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              {t('quiz.step4.freeText', language)}
            </Text>
            <TextInput
              style={styles.input}
              value={freeText}
              onChangeText={setFreeText}
              multiline
              placeholder="…"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <PrimaryButton
            title={t('quiz.prev', language)}
            variant="secondary"
            style={{ flex: 1, marginRight: spacing.sm }}
            onPress={() => setStep((s) => s - 1)}
          />
        )}
        {step < 4 ? (
          <PrimaryButton
            title={t('quiz.next', language)}
            style={{ flex: 1, marginLeft: step > 1 ? spacing.sm : 0 }}
            disabled={!canNext()}
            onPress={() => setStep((s) => s + 1)}
          />
        ) : (
          <PrimaryButton
            title={
              loading
                ? t('quiz.loading', language)
                : onboarding
                ? t('onboard.toBirthday', language)
                : t('quiz.submit', language)
            }
            style={{ flex: 1, marginLeft: spacing.sm }}
            disabled={!canNext()}
            loading={loading}
            onPress={submit}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------- Step 1 sub-views ----------------

interface Step1Props {
  language: Language;
  state: Step1Mode;
  setState: (s: Step1Mode) => void;
  letters: Record<number, string>;
  setLetters: (v: Record<number, string>) => void;
  selfMbti: MBTI | null;
  onPickSelf: () => void;
  onPickUnknown: () => void;
  onPickMode: (m: 'quick' | 'full') => void;
  answers: Record<number, AnswerValue>;
  onAnswer: (qid: number, a: AnswerValue) => void;
  onSubmitQuiz: (qs: MbtiQuestion[], mode: 'quick' | 'full') => void;
  inferring: boolean;
}

function Step1(props: Step1Props) {
  const { language, state } = props;

  if (state.kind === 'choose') {
    return (
      <>
        <Text style={typography.h2}>{t('quiz.step1.title', language)}</Text>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            title={t('quiz.step1.knownBtn', language)}
            onPress={props.onPickSelf}
          />
          <PrimaryButton
            title={t('quiz.step1.unknownBtn', language)}
            variant="secondary"
            style={{ marginTop: spacing.md }}
            onPress={props.onPickUnknown}
          />
        </View>
      </>
    );
  }

  if (state.kind === 'self') {
    return (
      <>
        <Text style={typography.h2}>{t('quiz.step1.title', language)}</Text>
        <Text style={[typography.caption, { marginTop: spacing.sm, marginBottom: spacing.md }]}>
          {t('quiz.step1.source', language)}
        </Text>
        {MBTI_PAIRS.map((pair, i) => (
          <View key={i} style={styles.pairRow}>
            {pair.map((letter) => (
              <Chip
                key={letter}
                label={letter}
                selected={props.letters[i] === letter}
                onPress={() => props.setLetters({ ...props.letters, [i]: letter })}
              />
            ))}
          </View>
        ))}
        {props.selfMbti && (
          <Text style={[typography.h2, { marginTop: spacing.md, color: colors.terracotta }]}>
            {props.selfMbti}
          </Text>
        )}
      </>
    );
  }

  if (state.kind === 'modePick') {
    return (
      <>
        <Text style={typography.h2}>{t('quiz.step1.chooseMode', language)}</Text>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            title={t('quiz.step1.quick', language)}
            onPress={() => props.onPickMode('quick')}
          />
          <PrimaryButton
            title={t('quiz.step1.full', language)}
            variant="secondary"
            style={{ marginTop: spacing.md }}
            onPress={() => props.onPickMode('full')}
          />
        </View>
      </>
    );
  }

  if (state.kind === 'quiz') {
    const questions = state.questions;
    const answered = questions.filter((q) => props.answers[q.id]).length;
    const allAnswered = answered === questions.length;

    return (
      <>
        <Text style={[typography.caption, { marginBottom: spacing.md }]}>
          {answered}/{questions.length}
        </Text>
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.id}
            index={idx}
            total={questions.length}
            question={q}
            answer={props.answers[q.id]}
            onAnswer={(a) => props.onAnswer(q.id, a)}
          />
        ))}
        <PrimaryButton
          title={
            props.inferring
              ? t('quiz.mbtiInferring', language)
              : t('quiz.submitProgress', language, { n: answered, total: questions.length })
          }
          disabled={!allAnswered || props.inferring}
          loading={props.inferring}
          style={{ marginTop: spacing.md }}
          onPress={() => props.onSubmitQuiz(questions, state.mode)}
        />
      </>
    );
  }

  // inferred — Mico的判断结果
  return (
    <>
      {/* Mico出场 */}
      <View style={styles.bunnyInferred}>
        <Bunny size={120} pose="wave" />
      </View>

      <Text style={styles.inferredTitle}>{t('quiz.step1.inferred', language)}</Text>

      {/* MBTI 大字 + 周围小装饰 */}
      <View style={styles.mbtiWrap}>
        <View style={[styles.sparkleAbs, { top: 0, left: 20 }]}>
          <Sparkle size={18} color={colors.terracotta} />
        </View>
        <View style={[styles.sparkleAbs, { top: 10, right: 30 }]}>
          <Heart size={14} color={colors.rose} />
        </View>
        <View style={[styles.sparkleAbs, { bottom: 0, left: 50 }]}>
          <Sparkle size={12} color={colors.sage} />
        </View>
        <Text style={styles.bigMbti}>{state.mbti}</Text>
        <View style={{ alignItems: 'center', marginTop: -spacing.sm }}>
          <WavyUnderline width={140} color={colors.terracotta} />
        </View>
      </View>

      <Text style={styles.confidenceText}>
        {t('quiz.step1.confidence', language, { p: Math.round(state.confidence * 100) })}
      </Text>

      <View style={styles.reasoningBox}>
        <View style={styles.reasoningTitleRow}>
          <Heart size={14} color={colors.rose} />
          <Text style={styles.reasoningTitle}>{t('quiz.step1.reasoning', language)}</Text>
        </View>
        <Text style={styles.reasoningText}>{state.reasoning}</Text>
      </View>

      <PrimaryButton
        title={`🐰 ${t('quiz.step1.retake', language)}`}
        variant="secondary"
        style={{ marginTop: spacing.lg }}
        onPress={() => props.setState({ kind: 'modePick' })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  stepLabel: {
    ...typography.caption,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    color: colors.terracotta,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
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
  pairRow: { flexDirection: 'row', marginBottom: spacing.sm },
  footer: { flexDirection: 'row', paddingVertical: spacing.md },

  bunnyInferred: { alignItems: 'center', marginTop: spacing.md },
  inferredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  mbtiWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
    position: 'relative',
    paddingVertical: spacing.md,
  },
  sparkleAbs: { position: 'absolute', zIndex: 1 },
  bigMbti: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.terracotta,
    textAlign: 'center',
    letterSpacing: 6,
    fontStyle: 'italic',  // 卡通倾斜感
    // iOS 有 Marker Felt（写在 fontFamily 里），可惜中文不渲染
    textShadowColor: colors.bunnyBlush,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  confidenceText: {
    ...typography.cute,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
  },
  reasoningBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasoningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reasoningTitle: {
    ...typography.cute,
    color: colors.primary,
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  reasoningText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 25,
  },
});
