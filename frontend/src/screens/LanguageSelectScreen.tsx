import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { Sparkle } from '../illustrations/Sparkle';
import { useI18n } from '../lib/LanguageContext';
import type { Language, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelect'>;

const OPTIONS: { code: Language; label: string; sub: string }[] = [
  { code: 'zh', label: '中文', sub: '简体中文' },
  { code: 'en', label: 'English', sub: 'English' },
];

export function LanguageSelectScreen({ navigation }: Props) {
  const { setLang } = useI18n();
  const [busy, setBusy] = useState(false);

  const choose = async (code: Language) => {
    if (busy) return;
    setBusy(true);
    await setLang(code);
    navigation.replace('Auth', { onboarding: true });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.mascot}>
          <Snowman size={120} pose="wave" />
        </View>

        <View style={styles.titleRow}>
          <Sparkle size={16} color={colors.terracotta} />
          <Text style={styles.title}>BookMirror</Text>
          <Sparkle size={16} color={colors.terracotta} />
        </View>

        {/* 双语提示，让两种语言用户都看得懂 */}
        <Text style={styles.subtitle}>选择语言 · Choose your language</Text>

        <View style={styles.options}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.code}
              onPress={() => choose(opt.code)}
              disabled={busy}
              style={({ pressed }) => [
                styles.optionBtn,
                shadow.soft,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionSub}>{opt.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>
          之后所有测评与结果都会用你选择的语言{'\n'}
          All tests and results will use the language you pick
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  mascot: { marginBottom: spacing.lg },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    fontSize: 30,
    color: colors.terracotta,
    letterSpacing: 2,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  options: { width: '100%', maxWidth: 360, gap: spacing.md },
  optionBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  optionLabel: { fontSize: 22, fontWeight: '700', color: colors.primary },
  optionSub: { ...typography.caption, marginTop: 4, color: colors.textMuted },

  hint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
