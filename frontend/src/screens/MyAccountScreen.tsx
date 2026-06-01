import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { Sparkle, Heart, Leaf } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { storage, type CheckinDay } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { signName, elementName } from '../lib/zodiacI18n';
import type { RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MyAccountScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkinLog, setCheckinLog] = useState<CheckinDay[]>([]);

  const load = useCallback(async () => {
    setProfile(await storage.getUserProfile());
    setCheckinLog(await storage.getCheckinLog());
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const pickAvatar = useCallback(async () => {
    // expo-image-picker 是原生模块；旧安装包（OTA 拿不到原生代码）会 require 失败，
    // 此时优雅降级提示用户安装新版，而不是崩溃。
    let ImagePicker: typeof import('expo-image-picker');
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert(t('account.avatarNeedUpdate'));
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('account.avatarPermission'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const current = await storage.getUserProfile();
      if (!current) return;
      const updated: UserProfile = { ...current, avatarUri: res.assets[0].uri };
      await storage.setUserProfile(updated);
      setProfile(updated);
    } catch {
      Alert.alert(t('account.avatarNeedUpdate'));
    }
  }, [t]);

  const totalPages = checkinLog.reduce((sum, d) => sum + d.pages, 0);
  const streak = checkinLog.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* 头部头像 */}
        <View style={styles.header}>
          <Pressable
            onPress={pickAvatar}
            style={({ pressed }) => [styles.avatarBig, pressed && { opacity: 0.85 }]}
          >
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImg} />
            ) : (
              <Snowman size={88} pose="wave" />
            )}
          </Pressable>
          <Text style={styles.avatarHint}>{t('account.changeAvatar')}</Text>
          {profile?.mbti ? (
            <>
              <Text style={styles.mbtiBig}>{profile.mbti}</Text>
              <View style={{ alignItems: 'center' }}>
                <WavyUnderline width={100} color={colors.terracotta} />
              </View>
              {profile.zodiac ? (
                <View style={styles.zodiacRow}>
                  {profile.gender === 'female' && (
                    <Text style={[styles.genderSymbol, { color: colors.rose }]}>♀</Text>
                  )}
                  {profile.gender === 'male' && (
                    <Text style={[styles.genderSymbol, { color: colors.sky }]}>♂</Text>
                  )}
                  <Text style={styles.zodiacSign}>{signName(profile.zodiac.sun_sign, lang)}</Text>
                  <View style={styles.zodiacDot} />
                  <Text style={styles.zodiacElement}>{elementName(profile.zodiac.element, lang)}{t('astro.elementSuffix')}</Text>
                </View>
              ) : (
                <Pressable onPress={() => navigation.navigate('Astrology')}>
                  <Text style={styles.zodiacPrompt}>{t('account.addBirthday')}</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.mbtiBig}>?</Text>
          )}
        </View>

        {/* 阅读统计 */}
        <View style={[styles.statCard, shadow.soft]}>
          <View style={styles.cardTitleRow}>
            <Leaf size={16} />
            <Text style={styles.cardTitle}>{t('account.statsTitle')}</Text>
          </View>
          <View style={styles.statRow}>
            <Stat label={t('account.totalRead')} value={`${totalPages}`} unit={t('account.unitPages')} />
            <View style={styles.divider} />
            <Stat label={t('account.checkinDays')} value={`${streak}`} unit={t('account.unitDays')} />
          </View>
        </View>

        {/* 未来功能预告 */}
        <View style={[styles.statCard, shadow.soft]}>
          <View style={styles.cardTitleRow}>
            <Sparkle size={14} color={colors.lavender} />
            <Text style={styles.cardTitle}>{t('common.comingSoon')}</Text>
          </View>
          <Text style={styles.comingItem}>{t('account.coming1')}</Text>
          <Text style={styles.comingItem}>{t('account.coming2')}</Text>
          <Text style={styles.comingItem}>{t('account.coming3')}</Text>
        </View>

        {/* 设置入口 */}
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={({ pressed }) => [
            styles.settingsBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.settingsText}>{t('account.settings')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={statStyles.value}>
        {value} <Text style={statStyles.unit}>{unit}</Text>
      </Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  value: { fontSize: 28, fontWeight: '800', color: colors.terracotta },
  unit: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  label: { ...typography.caption, marginTop: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatarBig: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.snowShade,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  mbtiBig: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.terracotta,
    letterSpacing: 4,
    fontStyle: 'italic',
  },
  mbtiSource: { ...typography.caption, marginTop: spacing.xs },
  zodiacRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  zodiacSign: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  zodiacDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
  },
  zodiacElement: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  zodiacPrompt: {
    marginTop: spacing.sm,
    color: colors.terracotta,
    fontSize: 13,
    fontWeight: '600',
  },
  genderSymbol: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: -2,
  },
  zodiacDesc: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  zodiacMore: {
    fontSize: 12,
    color: colors.terracotta,
    fontWeight: '600',
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  statCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { ...typography.h3 },

  statRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 40, backgroundColor: colors.border },

  comingItem: { ...typography.body, fontSize: 14, color: colors.textMuted, marginTop: 6 },

  settingsBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
