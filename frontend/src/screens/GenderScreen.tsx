import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import type { Gender, RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GenderScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Gender'>>();
  const onboarding = route.params?.onboarding ?? false;
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selected, setSelected] = useState<Gender | undefined>(undefined);

  useEffect(() => {
    storage.getUserProfile().then((p) => {
      setProfile(p);
      setSelected(p?.gender);
    });
  }, []);

  const next = async (gender?: Gender) => {
    if (profile) {
      const updated: UserProfile = { ...profile, gender };
      await storage.setUserProfile(updated);
    }
    navigation.replace('Persona', { onboarding });
  };

  const options: Array<{ v: Gender; label: string; tone: string; symbol: string }> = [
    { v: 'female', label: t('settings.female'), tone: colors.rose, symbol: '♀' },
    { v: 'male', label: t('settings.male'), tone: colors.sky, symbol: '♂' },
    { v: 'other', label: t('settings.other'), tone: colors.lavender, symbol: '✦' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Sparkle size={16} color={colors.terracotta} />
          <Text style={styles.title}>{t('gender.title')}</Text>
        </View>
        <WavyUnderline width={90} color={colors.terracotta} />
        <Text style={styles.sub}>{t('gender.sub')}</Text>

        <View style={styles.options}>
          {options.map((opt) => {
            const active = selected === opt.v;
            return (
              <Pressable
                key={opt.v}
                onPress={() => setSelected(opt.v)}
                style={({ pressed }) => [
                  styles.optionBtn,
                  shadow.soft,
                  active && { backgroundColor: opt.tone, borderColor: opt.tone },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.optionSymbol, active && styles.optionTextActive]}>{opt.symbol}</Text>
                <Text style={[styles.optionLabel, active && styles.optionTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => next(selected)}
          disabled={!selected}
          style={({ pressed }) => [
            styles.nextBtn,
            !selected && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.nextText}>{t('onboard.toSynthesis')}</Text>
        </Pressable>
        <Pressable onPress={() => next(undefined)} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('gender.skip')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.lg, justifyContent: 'center' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, marginLeft: spacing.xs },
  sub: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xl, lineHeight: 22 },

  options: { gap: spacing.md },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  optionSymbol: { fontSize: 22, fontWeight: '700', color: colors.textMuted, marginRight: spacing.md },
  optionLabel: { fontSize: 18, fontWeight: '700', color: colors.primary },
  optionTextActive: { color: '#fff' },

  footer: { padding: spacing.lg },
  nextBtn: {
    paddingVertical: 16,
    backgroundColor: colors.terracotta,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  skipBtn: { alignSelf: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  skipText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
