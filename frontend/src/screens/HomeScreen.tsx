import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { Snowman } from '../illustrations/Snowman';
import { Cat } from '../illustrations/Cat';
import { Sparkle, Leaf, Heart } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { storage } from '../lib/storage';
import { t } from '../lib/i18n';
import type { Language, RecommendationResponse, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [language, setLanguage] = useState<Language>('zh');
  const [lastResult, setLastResult] = useState<RecommendationResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      const settings = await storage.getSettings();
      setLanguage(settings.language);
      setLastResult(await storage.getLastResult());
    };
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 顶部齿轮 */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={16} style={styles.gearBtn}>
          <Text style={styles.gear}>⚙︎</Text>
        </Pressable>
      </View>

      {/* 角落小装饰 */}
      <View style={[styles.cornerDeco, { top: 80, left: 24 }]}>
        <Sparkle size={18} color={colors.terracotta} />
      </View>
      <View style={[styles.cornerDeco, { top: 130, right: 40 }]}>
        <Heart size={14} color={colors.rose} />
      </View>
      <View style={[styles.cornerDeco, { top: 200, left: 50 }]}>
        <Sparkle size={12} color={colors.sage} />
      </View>
      <View style={[styles.cornerDeco, { bottom: 200, right: 30 }]}>
        <Leaf size={28} color={colors.sage} />
      </View>

      {/* 主内容 */}
      <View style={styles.body}>
        {/* 雪人主角 */}
        <View style={styles.bunnyWrap}>
          <Snowman size={170} pose="reading" />
        </View>

        {/* Logo + slogan */}
        <Text style={styles.logo}>{t('app.name', language)}</Text>
        <View style={styles.underlineWrap}>
          <WavyUnderline width={110} color={colors.terracotta} />
        </View>
        <Text style={styles.slogan}>{t('app.slogan', language)}</Text>

        {/* 介绍卡片 */}
        <View style={styles.introCard}>
          <Text style={styles.intro}>{t('home.intro', language)}</Text>
          <Text style={styles.mascotsLine}>{t('home.mascots', language)}</Text>
          <View style={styles.catCorner}>
            <Cat size={70} />
          </View>
        </View>
      </View>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <PrimaryButton
          title={`✨ ${t('home.start', language)}`}
          onPress={() => navigation.navigate('Quiz')}
        />
        {lastResult && (
          <PrimaryButton
            title={t('home.lastResult', language)}
            variant="secondary"
            style={{ marginTop: spacing.md }}
            onPress={() => navigation.navigate('Result', { result: lastResult })}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: spacing.sm },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gear: { fontSize: 18, color: colors.primary },

  cornerDeco: { position: 'absolute', zIndex: 1 },

  body: { flex: 1, alignItems: 'center', paddingTop: spacing.xl },

  bunnyWrap: { marginBottom: spacing.md },

  logo: {
    ...typography.h1,
    fontSize: 34,
    color: colors.primary,
    marginBottom: 4,
  },
  underlineWrap: { marginBottom: spacing.md },
  slogan: {
    ...typography.body,
    fontSize: 15,
    textAlign: 'center',
    color: colors.textMuted,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },

  introCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    paddingRight: spacing.xl + spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    position: 'relative',
    marginTop: spacing.md,
  },
  intro: { ...typography.body, fontSize: 14, lineHeight: 22, color: colors.text },
  mascotsLine: {
    ...typography.cute,
    fontSize: 12,
    color: colors.terracotta,
    marginTop: 10,
  },
  catCorner: {
    position: 'absolute',
    right: -8,
    bottom: -12,
  },

  footer: { paddingBottom: spacing.lg },
});
