import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography, radius } from '../theme';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { fetchGrowth, type GrowthData } from '../lib/api';

export function GrowthScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);

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
});
