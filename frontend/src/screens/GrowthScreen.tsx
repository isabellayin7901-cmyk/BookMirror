import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography, radius } from '../theme';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { fetchGrowth, fetchShapingReport, type GrowthData, type ShapingReport } from '../lib/api';

export function GrowthScreen() {
  const { t, lang } = useI18n();
  const navigation = useNavigation();
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ShapingReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const genReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const profile = await storage.getUserProfile();
      const rep = await fetchShapingReport(profile?.mbti, lang);
      if (!rep.available) {
        Alert.alert(t('growth.reportEmpty'));
        return;
      }
      setReport(rep);
    } catch {
      Alert.alert(t('growth.reportFail'));
    } finally {
      setReportLoading(false);
    }
  }, [lang, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const id = await storage.getUserId();
      setData(await fetchGrowth(id));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const problems = data ? Object.entries(data.helped_problem_counts).sort((a, b) => b[1] - a[1]) : [];
  const hasData = data && (data.dimensions.length > 0 || problems.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={typography.h1}>{t('growth.title')}</Text>
        <Text style={styles.subtitle}>{t('growth.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator color={colors.terracotta} style={{ marginTop: spacing.xxl }} />
        ) : !hasData ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('growth.empty')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.reviewCount}>
              {t('growth.reviewCount').replace('{n}', String(data!.review_count))}
            </Text>

            {/* 各维度成长 */}
            {data!.dimensions.length > 0 && (
              <Text style={styles.section}>{t('growth.dimensions')}</Text>
            )}
            {data!.dimensions.map((d) => {
              const before = Math.max(0, d.latest_after - d.total_delta);
              return (
                <View key={d.dimension} style={styles.dimCard}>
                  <View style={styles.dimHead}>
                    <Text style={styles.dimName}>{t(`review.dim.${d.dimension}`)}</Text>
                    <Text style={[styles.dimDelta, d.total_delta >= 0 ? styles.up : styles.down]}>
                      {d.total_delta >= 0 ? '+' : ''}{d.total_delta}
                    </Text>
                  </View>
                  {/* 进度条：到「现在」分 */}
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, d.latest_after))}%` }]} />
                  </View>
                  <Text style={styles.dimMeta}>
                    {t('growth.now')} {d.latest_after} · {t('growth.books').replace('{n}', String(d.count))}
                  </Text>
                </View>
              );
            })}

            {/* 解决的问题 */}
            {problems.length > 0 && (
              <>
                <Text style={styles.section}>{t('growth.solved')}</Text>
                <View style={styles.chipRow}>
                  {problems.map(([p, n]) => (
                    <View key={p} style={styles.solvedChip}>
                      <Text style={styles.solvedText}>{t(`review.prob.${p}`)}</Text>
                      <Text style={styles.solvedCount}>×{n}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* 阅读塑造报告 */}
            <Text style={styles.section}>{t('growth.report')}</Text>
            {report ? (
              <View style={styles.reportCard}>
                <Text style={styles.reportSummary}>{report.summary}</Text>
                {report.strengthening.length > 0 && (
                  <>
                    <Text style={styles.reportLabel}>{t('growth.strengthening')}</Text>
                    <View style={styles.chipRow}>
                      {report.strengthening.map((s) => (
                        <View key={s} style={styles.strengthChip}>
                          <Text style={styles.strengthText}>✓ {s}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {report.shifts.length > 0 && (
                  <>
                    <Text style={styles.reportLabel}>{t('growth.shifts')}</Text>
                    {report.shifts.map((s, i) => (
                      <Text key={i} style={styles.shiftItem}>· {s}</Text>
                    ))}
                  </>
                )}
                {!!report.encouragement && (
                  <Text style={styles.encouragement}>{report.encouragement}</Text>
                )}
                <Pressable onPress={genReport} disabled={reportLoading} style={styles.regenLink}>
                  <Text style={styles.regenText}>{t('growth.regenReport')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={genReport} disabled={reportLoading} style={styles.reportBtn}>
                {reportLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.reportBtnText}>{t('growth.genReport')}</Text>
                )}
              </Pressable>
            )}

            <Text style={styles.footnote}>{t('growth.footnote')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  reviewCount: { ...typography.caption, color: colors.textFaint, marginTop: spacing.lg },
  section: { ...typography.h3, marginTop: spacing.xl, marginBottom: spacing.sm },

  empty: { marginTop: spacing.xxl, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  dimCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dimHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dimName: { ...typography.body, fontWeight: '700' },
  dimDelta: { ...typography.body, fontWeight: '800' },
  up: { color: colors.success },
  down: { color: colors.danger },
  barBg: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.terracotta },
  dimMeta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  solvedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.sage,
  },
  solvedText: { ...typography.body, fontSize: 14, color: colors.text },
  solvedCount: { ...typography.caption, color: colors.textMuted },

  footnote: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xl, lineHeight: 18 },

  reportBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
  },
  reportBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reportCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lavender,
    backgroundColor: colors.surface,
  },
  reportSummary: { ...typography.body, lineHeight: 22, color: colors.text },
  reportLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  strengthChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.butter,
  },
  strengthText: { ...typography.body, fontSize: 14, color: colors.text, fontWeight: '600' },
  shiftItem: { ...typography.body, fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  encouragement: { ...typography.body, color: colors.terracotta, marginTop: spacing.md, lineHeight: 22 },
  regenLink: { marginTop: spacing.md, alignItems: 'center' },
  regenText: { ...typography.caption, color: colors.textMuted },
});
