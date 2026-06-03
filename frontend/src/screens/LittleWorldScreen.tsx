import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle, Heart, Leaf } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { useI18n } from '../lib/LanguageContext';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Feature {
  emoji: string;
  icon?: ImageSourcePropType;  // 有图标就用图标，否则用 emoji 气泡
  title: string;
  subtitle: string;
  tone: string;
  badge?: string;
  onPress?: () => void;
}

export function LittleWorldScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();

  const features: Feature[] = [
    {
      emoji: '🌗',
      icon: require('../../assets/persona_icon.png'),
      title: t('world.persona'),
      subtitle: t('world.personaSub'),
      tone: colors.lavender,
      onPress: () => navigation.navigate('Persona'),
    },
    {
      emoji: '🪞',
      title: t('world.mirror'),
      subtitle: t('world.mirrorSub'),
      tone: colors.sage,
      onPress: () => navigation.navigate('MirrorChat'),
    },
    {
      emoji: '🌱',
      title: t('world.growth'),
      subtitle: t('world.growthSub'),
      tone: colors.butter,
      onPress: () => navigation.navigate('Growth'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.titleRow}>
          <Sparkle size={18} color={colors.terracotta} />
          <Text style={styles.title}>{t('world.title')}</Text>
        </View>
        <WavyUnderline width={70} />
        <Text style={styles.subtitle}>{t('world.subtitle')}</Text>

        <View style={{ marginTop: spacing.xl }}>
          {features.map((f) => (
            <Pressable
              key={f.title}
              onPress={f.onPress}
              disabled={!f.onPress}
              style={({ pressed }) => [
                styles.card,
                shadow.soft,
                pressed && f.onPress && { transform: [{ scale: 0.98 }] },
                !f.onPress && { opacity: 0.7 },
              ]}
            >
              {f.icon ? (
                <Image source={f.icon} style={styles.iconBubble} />
              ) : (
                <View style={[styles.emojiBubble, { backgroundColor: f.tone }]}>
                  <Text style={styles.emoji}>{f.emoji}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{f.title}</Text>
                  {f.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{f.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSubtitle}>{f.subtitle}</Text>
              </View>
              {f.onPress && <Text style={styles.arrow}>›</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, marginLeft: spacing.xs },
  subtitle: { ...typography.caption, marginTop: spacing.sm },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBubble: { width: 56, height: 56, borderRadius: 28 },
  emoji: { fontSize: 26 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.h3 },
  cardSubtitle: { ...typography.caption, marginTop: 2 },
  arrow: { fontSize: 26, color: colors.textMuted, marginLeft: spacing.sm },

  badge: {
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
});
