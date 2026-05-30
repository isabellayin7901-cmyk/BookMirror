import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

import { colors, radius, spacing, typography, shadow } from '../theme';
import { Sparkle } from '../illustrations/Sparkle';
import type { AnswerValue, MbtiQuestion } from '../data/mbtiQuestions';

interface Props {
  index: number;
  total: number;
  question: MbtiQuestion;
  answer?: AnswerValue;
  onAnswer: (a: AnswerValue) => void;
}

export function QuestionCard({ index, total, question, answer, onAnswer }: Props) {
  return (
    <View style={[styles.card, shadow.soft]}>
      <View style={styles.progressRow}>
        <Sparkle size={12} color={colors.terracotta} />
        <Text style={styles.progress}>
          {index + 1} / {total}
        </Text>
      </View>

      <Text style={styles.text}>{question.text}</Text>

      <View style={styles.answerArea}>
        {question.type === 'yesno' && <YesNo question={question} answer={answer} onAnswer={onAnswer} />}
        {question.type === 'slider' && <SliderQ question={question} answer={answer} onAnswer={onAnswer} />}
        {question.type === 'choice3' && <Choice3 question={question} answer={answer} onAnswer={onAnswer} />}
      </View>
    </View>
  );
}

function YesNo({ question, answer, onAnswer }: Omit<Props, 'index' | 'total'>) {
  const labels = question.yesnoLabels ?? { yes: '是', no: '否', neutral: '看情况' };
  const options: Array<{ value: 'yes' | 'no' | 'neutral'; label: string; tone: string }> = [
    { value: 'yes', label: labels.yes, tone: colors.sage },
    { value: 'no', label: labels.no, tone: colors.rose },
    { value: 'neutral', label: labels.neutral, tone: colors.sky },
  ];
  const current = answer?.kind === 'yesno' ? answer.value : undefined;

  return (
    <View style={styles.btnRow}>
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onAnswer({ kind: 'yesno', value: opt.value, label: opt.label })}
            style={[
              styles.optionBtn,
              active && { backgroundColor: opt.tone, borderColor: opt.tone },
            ]}
          >
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Choice3({ question, answer, onAnswer }: Omit<Props, 'index' | 'total'>) {
  const choices = question.choices ?? ['A', 'B', 'C'];
  const tones = [colors.lavender, colors.butter, colors.sky];
  const currentIdx = answer?.kind === 'choice3' ? answer.index : undefined;

  return (
    <View style={styles.btnRow}>
      {choices.map((label, idx) => {
        const active = currentIdx === idx;
        const tone = tones[idx];
        return (
          <Pressable
            key={idx}
            onPress={() => onAnswer({ kind: 'choice3', index: idx as 0 | 1 | 2, label })}
            style={[
              styles.optionBtn,
              active && { backgroundColor: tone, borderColor: tone },
            ]}
          >
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SliderQ({ question, answer, onAnswer }: Omit<Props, 'index' | 'total'>) {
  const value = answer?.kind === 'slider' ? answer.value : 2.5;
  const hasAnswer = answer?.kind === 'slider';
  const labels = question.sliderLabels;

  return (
    <View>
      <View style={styles.scaleRow}>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={styles.scaleTick}>
            <View
              style={[
                styles.scaleDot,
                hasAnswer && Math.round(value) === n && styles.scaleDotActive,
              ]}
            />
            <Text style={styles.scaleNum}>{n}</Text>
          </View>
        ))}
      </View>

      <Slider
        style={{ width: '100%', height: 36 }}
        minimumValue={0}
        maximumValue={5}
        step={1}
        value={value}
        onValueChange={(v) => onAnswer({ kind: 'slider', value: v, min: 0, max: 5 })}
        minimumTrackTintColor={colors.terracotta}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.terracotta}
      />

      {labels && (
        <View style={styles.labelRow}>
          <Text style={styles.labelLeft}>{labels.left}</Text>
          <Text style={styles.labelRight}>{labels.right}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  progress: { ...typography.cute, marginLeft: spacing.xs },
  text: { ...typography.body, fontSize: 16.5, lineHeight: 26 },
  answerArea: { marginTop: spacing.lg },

  btnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optionBtn: {
    flex: 1,
    minHeight: 46,
    marginHorizontal: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center', color: colors.text },
  optionLabelActive: { color: '#fff' },

  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  scaleTick: { alignItems: 'center' },
  scaleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  scaleDotActive: { backgroundColor: colors.terracotta, width: 12, height: 12, borderRadius: 6 },
  scaleNum: { fontSize: 11, color: colors.textMuted },

  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  labelLeft: { ...typography.caption },
  labelRight: { ...typography.caption },
});
