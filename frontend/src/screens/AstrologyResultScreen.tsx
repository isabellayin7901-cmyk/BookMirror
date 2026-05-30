import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { NatalChart } from '../components/NatalChart';
import { storage } from '../lib/storage';
import { analyzeAstrology } from '../lib/api';
import { useI18n } from '../lib/LanguageContext';
import { signName, elementName } from '../lib/zodiacI18n';
import type { RootStackParamList, ZodiacReading } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AstrologyResult'>;

export function AstrologyResultScreen({ navigation }: Props) {
  const { t, lang } = useI18n();
  const [zodiac, setZodiac] = useState<ZodiacReading | null>(null);

  // 语言切换后，画像文案（描述/关键词）需要按新语言重新生成。
  // 星盘是确定性数据，用存好的生日+出生地重算，结果一致、只是换语言。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await storage.getUserProfile();
      if (!p?.zodiac) return;
      if (!cancelled) setZodiac(p.zodiac);

      const readingLang = p.zodiac.language ?? 'zh';
      // 英文模式下，若文案里仍残留中文（早期被错误标记为 en 的旧数据），强制重算自愈。
      const hasCJK = /[一-鿿]/.test(p.zodiac.description ?? '');
      const needsRefresh =
        readingLang !== lang || (lang === 'en' && hasCJK);
      if (!needsRefresh || !p.birthday) return;
      try {
        const result = await analyzeAstrology(
          p.birthday,
          lang,
          p.birthplace
            ? { latitude: p.birthplace.city.latitude, longitude: p.birthplace.city.longitude }
            : undefined,
        );
        const updated: ZodiacReading = { ...result, language: lang };
        await storage.setUserProfile({ ...p, zodiac: updated });
        if (!cancelled) setZodiac(updated);
      } catch {
        /* 重新生成失败就保留原文案 */
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  if (!zodiac) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('astroResult.emptyText')}</Text>
          <Text style={styles.emptyHint}>{t('astroResult.emptyHint')}</Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => navigation.replace('Astrology')}
          >
            <Text style={styles.emptyBtnText}>{t('astroResult.emptyBtn')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* 星座画像 */}
        <View style={[styles.card, shadow.soft]}>
          <View style={styles.cardTitleRow}>
            <Sparkle size={14} color={colors.terracotta} />
            <Text style={styles.cardTitle}>{t('astroResult.profileTitle')}</Text>
          </View>
          <WavyUnderline width={110} color={colors.terracotta} />

          <View style={styles.bigSign}>
            <Text style={styles.sunSign}>{signName(zodiac.sun_sign, lang)}</Text>
            <View style={styles.elementBadge}>
              <Text style={styles.elementText}>{elementName(zodiac.element, lang)}{t('astro.elementSuffix')}</Text>
            </View>
          </View>

          {(zodiac.moon_sign || zodiac.rising_sign) && (
            <View style={styles.subSignRow}>
              {zodiac.moon_sign && (
                <View style={styles.subSign}>
                  <Text style={styles.subSignLabel}>{t('astroResult.moon')}</Text>
                  <Text style={styles.subSignValue}>{signName(zodiac.moon_sign, lang)}</Text>
                </View>
              )}
              {zodiac.rising_sign && (
                <View style={styles.subSign}>
                  <Text style={styles.subSignLabel}>{t('astroResult.rising')}</Text>
                  <Text style={styles.subSignValue}>{signName(zodiac.rising_sign, lang)}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.keywordRow}>
            {zodiac.keywords.map((k, idx) => {
              const tones = [colors.rose, colors.sage, colors.lavender];
              return (
                <View key={k} style={[styles.keywordTag, { backgroundColor: tones[idx % 3] }]}>
                  <Text style={styles.keywordText}>{k}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.description}>{zodiac.description}</Text>
        </View>

        {/* 星盘 */}
        {zodiac.chart && (
          <View style={[styles.card, shadow.soft, { marginTop: spacing.lg }]}>
            <View style={styles.cardTitleRow}>
              <Sparkle size={14} color={colors.lavender} />
              <Text style={styles.cardTitle}>{t('astroResult.chartTitle')}</Text>
            </View>
            <WavyUnderline width={70} color={colors.lavender} />
            <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <NatalChart chart={zodiac.chart} />
            </View>
          </View>
        )}

        {/* 重测入口 */}
        <Pressable
          onPress={() => navigation.replace('Astrology')}
          style={styles.retakeBtn}
        >
          <Text style={styles.retakeText}>{t('astroResult.retake')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyText: { ...typography.h2, marginBottom: spacing.sm },
  emptyHint: { ...typography.caption, marginBottom: spacing.lg, textAlign: 'center' },
  emptyBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    backgroundColor: colors.terracotta,
    borderRadius: radius.pill,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  cardTitle: { ...typography.h3, marginLeft: spacing.xs },

  bigSign: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, gap: spacing.md,
  },
  sunSign: {
    fontSize: 40, color: colors.terracotta, letterSpacing: 6,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
  },
  elementBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    backgroundColor: colors.bgSoft, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  elementText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  subSignRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  subSign: { alignItems: 'center' },
  subSignLabel: { fontSize: 11, color: colors.textMuted },
  subSignValue: {
    fontSize: 16, color: colors.primary, marginTop: 2,
    fontFamily: 'ZCOOLKuaiLe_400Regular', letterSpacing: 1.5,
  },

  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.md },
  keywordTag: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  keywordText: {
    color: '#fff', fontSize: 14,
    fontFamily: 'ZCOOLKuaiLe_400Regular', letterSpacing: 1.5,
  },

  description: {
    fontSize: 15, lineHeight: 28, marginTop: spacing.md, color: colors.text,
    fontFamily: 'ZCOOLKuaiLe_400Regular', letterSpacing: 1.2,
  },

  retakeBtn: {
    marginTop: spacing.lg, alignSelf: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  retakeText: { color: colors.terracotta, fontWeight: '600' },
});
