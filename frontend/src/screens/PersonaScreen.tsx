import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { storage, synthesisSignature } from '../lib/storage';
import { fetchSynthesis } from '../lib/api';
import { useI18n } from '../lib/LanguageContext';
import { signName, elementName } from '../lib/zodiacI18n';
import type { RootStackParamList, SynthesisProfile, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PersonaScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Persona'>>();
  const onboarding = route.params?.onboarding ?? false;
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [synth, setSynth] = useState<SynthesisProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const autoTried = useRef(false);

  const load = useCallback(async () => {
    const p = await storage.getUserProfile();
    setProfile(p);
    const sig = synthesisSignature(p);
    setSynth(sig ? await storage.getSynthesis(sig) : null);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const hasMbti = !!profile?.mbti;
  const hasZodiac = !!profile?.zodiac;
  const canSynth = hasMbti && hasZodiac;

  const generate = async () => {
    if (!profile?.zodiac) return;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchSynthesis({
        mbti: profile.mbti,
        sun_sign: profile.zodiac.sun_sign,
        element: profile.zodiac.element,
        moon_sign: profile.zodiac.moon_sign,
        rising_sign: profile.zodiac.rising_sign,
        gender: profile.gender,
        language: lang,
      });
      setSynth(result);
      await storage.setSynthesis(synthesisSignature(profile), result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // 引导模式：进入综合测评页自动生成（只尝试一次），无需用户再点按钮
  useEffect(() => {
    if (onboarding && canSynth && !synth && !loading && !autoTried.current) {
      autoTried.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding, canSynth, synth, loading]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.titleRow}>
          <Sparkle size={18} color={colors.terracotta} />
          <Text style={styles.title}>{t('persona.title')}</Text>
        </View>
        <WavyUnderline width={90} color={colors.lavender} />
        <Text style={styles.subtitle}>{t('persona.subtitle')}</Text>

        {/* MBTI 行 */}
        <View style={[styles.row, shadow.soft]}>
          <View style={[styles.rowBubble, { backgroundColor: colors.rose }]}>
            <Text style={styles.rowEmoji}>🐰</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.rowTitle}>{t('persona.mbtiTitle')}</Text>
            {hasMbti ? (
              <Text style={styles.rowValue}>{profile!.mbti}</Text>
            ) : (
              <Text style={styles.rowMuted}>{t('persona.mbtiEmpty')}</Text>
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate('Quiz')}
            style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.rowBtnText}>{hasMbti ? t('persona.retest') : t('persona.takeTest')}</Text>
          </Pressable>
        </View>

        {/* 星座 行 */}
        <View style={[styles.row, shadow.soft]}>
          <View style={[styles.rowBubble, { backgroundColor: colors.lavender }]}>
            <Text style={styles.rowEmoji}>🌙</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.rowTitle}>{t('persona.zodiacTitle')}</Text>
            {hasZodiac ? (
              <Text style={styles.rowValue}>
                {signName(profile!.zodiac!.sun_sign, lang)} · {elementName(profile!.zodiac!.element, lang)}{t('astro.elementSuffix')}
              </Text>
            ) : (
              <Text style={styles.rowMuted}>{t('persona.zodiacEmpty')}</Text>
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate(hasZodiac ? 'AstrologyResult' : 'Astrology')}
            style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.rowBtnText}>{hasZodiac ? t('persona.viewChart') : t('persona.addBirthday')}</Text>
          </Pressable>
        </View>

        {/* 综合画像 */}
        <View style={[styles.synthCard, shadow.soft]}>
          <View style={styles.cardTitleRow}>
            <Sparkle size={14} color={colors.terracotta} />
            <Text style={styles.cardTitle}>{t('persona.synthTitle')}</Text>
          </View>
          <Text style={styles.synthSub}>{t('persona.synthSub')}</Text>

          {!canSynth ? (
            <Text style={styles.needBoth}>{t('persona.needBoth')}</Text>
          ) : synth ? (
            <>
              <Text style={styles.synthTitle}>{synth.title}</Text>
              <View style={styles.keywordRow}>
                {synth.keywords.map((k, idx) => {
                  const tones = [colors.rose, colors.sage, colors.lavender, colors.sky];
                  return (
                    <View key={k} style={[styles.keywordTag, { backgroundColor: tones[idx % tones.length] }]}>
                      <Text style={styles.keywordText}>{k}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.description}>{synth.description}</Text>

              <Text style={styles.blockLabel}>{t('persona.strengths')}</Text>
              {synth.strengths.map((s) => (
                <View key={s} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: colors.sage }]}>✦</Text>
                  <Text style={styles.bulletText}>{s}</Text>
                </View>
              ))}

              <Text style={styles.blockLabel}>{t('persona.blindspots')}</Text>
              {synth.blindspots.map((s) => (
                <View key={s} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: colors.terracotta }]}>✦</Text>
                  <Text style={styles.bulletText}>{s}</Text>
                </View>
              ))}

              <Pressable
                onPress={generate}
                disabled={loading}
                style={({ pressed }) => [styles.regenBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.regenText}>{t('persona.regenerate')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {error && <Text style={styles.errText}>{t('persona.errMsg')}</Text>}
              <Pressable
                onPress={generate}
                disabled={loading}
                style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.85 }]}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.generateText}>  {t('persona.generating')}</Text>
                  </View>
                ) : (
                  <Text style={styles.generateText}>{t('persona.generate')}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* 引导模式：综合测评是首次引导的最后一步，完成后进入 App */}
        {onboarding && (
          <>
            {!synth && (
              <Text style={styles.enterHint}>{t('onboard.synthHint')}</Text>
            )}
            <Pressable
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
              style={({ pressed }) => [styles.enterBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.enterText}>{t('onboard.enterApp')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, marginLeft: spacing.xs },
  subtitle: { ...typography.caption, marginTop: spacing.sm, marginBottom: spacing.lg },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBubble: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  rowEmoji: { fontSize: 22 },
  rowTitle: { ...typography.caption },
  rowValue: {
    fontSize: 20, color: colors.primary, marginTop: 2,
    fontFamily: 'ZCOOLKuaiLe_400Regular', letterSpacing: 2,
  },
  rowMuted: { ...typography.body, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  rowBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
  rowBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  synthCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.lavender,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { ...typography.h3, marginLeft: spacing.xs },
  synthSub: { ...typography.caption, marginTop: 4, marginBottom: spacing.md },

  needBoth: {
    ...typography.body, fontSize: 14, color: colors.textMuted,
    lineHeight: 22, textAlign: 'center', paddingVertical: spacing.lg,
  },

  synthTitle: {
    fontSize: 22, color: colors.terracotta, textAlign: 'center',
    marginTop: spacing.sm, letterSpacing: 1.5,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
  },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.md },
  keywordTag: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  keywordText: {
    color: '#fff', fontSize: 13,
    fontFamily: 'ZCOOLKuaiLe_400Regular', letterSpacing: 1.2,
  },
  description: {
    fontSize: 15, lineHeight: 28, marginTop: spacing.sm, color: colors.text,
    fontFamily: 'ZCOOLKuaiLe_400Regular', letterSpacing: 1,
  },

  blockLabel: { ...typography.h3, fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.sm },
  bulletRow: { flexDirection: 'row', marginBottom: spacing.sm },
  bulletDot: { fontSize: 13, marginRight: spacing.sm, marginTop: 3 },
  bulletText: { flex: 1, ...typography.body, fontSize: 14, lineHeight: 22, color: colors.text },

  generateBtn: {
    marginTop: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.terracotta,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  generateText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errText: { color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },

  regenBtn: { marginTop: spacing.lg, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  regenText: { color: colors.terracotta, fontWeight: '600' },

  enterHint: {
    ...typography.caption, textAlign: 'center',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  enterBtn: {
    marginTop: spacing.md,
    paddingVertical: 16,
    backgroundColor: colors.terracotta,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  enterText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
});
