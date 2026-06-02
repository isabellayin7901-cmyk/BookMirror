import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { signName, elementName } from '../lib/zodiacI18n';
import type { Gender, RootStackParamList, UserProfile } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    storage.getUserProfile().then(setProfile);
  }, []);

  const changeGender = async (g: Gender) => {
    if (!profile) return;
    const next: UserProfile = { ...profile, gender: g };
    setProfile(next);
    await storage.setUserProfile(next);
  };

  // 局部更新一个字段（输入时只改本地 state，失焦时落库）
  const setField = (patch: Partial<UserProfile>) =>
    setProfile((p) => (p ? { ...p, ...patch } : p));
  const persist = async () => {
    if (profile) await storage.setUserProfile(profile);
  };
  const toggleMajorRelevant = async () => {
    if (!profile) return;
    const next: UserProfile = { ...profile, major_relevant: !profile.major_relevant };
    setProfile(next);
    await storage.setUserProfile(next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Text style={typography.h1}>{t('settings.profile')}</Text>

        {/* 性别 */}
        <Text style={styles.sectionLabel}>{t('settings.gender')}</Text>
        <View style={styles.row}>
          {([
            { v: 'female', label: t('settings.female'), tone: colors.rose },
            { v: 'male', label: t('settings.male'), tone: colors.sky },
            { v: 'other', label: t('settings.other'), tone: colors.lavender },
          ] as Array<{ v: Gender; label: string; tone: string }>).map(({ v, label, tone }) => {
            const active = profile?.gender === v;
            return (
              <Pressable
                key={v}
                onPress={() => changeGender(v)}
                style={[
                  styles.pill,
                  active && { backgroundColor: tone, borderColor: tone },
                ]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 职业 / 专业 / 简介 */}
        <Text style={styles.sectionLabel}>{t('profile.occupation')}</Text>
        <TextInput
          style={styles.input}
          value={profile?.occupation ?? ''}
          onChangeText={(s) => setField({ occupation: s.slice(0, 60) })}
          onBlur={persist}
          placeholder={t('profile.occupationPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.sectionLabel}>{t('profile.major')}</Text>
        <TextInput
          style={styles.input}
          value={profile?.major ?? ''}
          onChangeText={(s) => setField({ major: s.slice(0, 60) })}
          onBlur={persist}
          placeholder={t('profile.majorPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        <Pressable style={styles.toggleRow} onPress={toggleMajorRelevant}>
          <Text style={styles.toggleLabel}>{t('profile.majorRelevant')}</Text>
          <View style={[styles.switch, profile?.major_relevant && styles.switchOn]}>
            <View style={[styles.knob, profile?.major_relevant && styles.knobOn]} />
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>{t('profile.bio')}</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={profile?.bio ?? ''}
          onChangeText={(s) => setField({ bio: s.slice(0, 300) })}
          onBlur={persist}
          multiline
          placeholder={t('profile.bioPlaceholder')}
          placeholderTextColor={colors.textFaint}
        />

        {/* 你的星空 */}
        <Text style={styles.sectionLabel}>{t('account.yourStars')}</Text>
        {profile?.zodiac ? (
          <Pressable
            onPress={() => navigation.navigate('AstrologyResult')}
            style={({ pressed }) => [styles.starsBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.starsBtnText}>
              {signName(profile.zodiac.sun_sign, lang)} · {elementName(profile.zodiac.element, lang)}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Astrology')}
            style={({ pressed }) => [styles.starsBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.starsBtnText}>{t('account.addBirthday')}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionLabel: { ...typography.h3, marginTop: spacing.xl },
  row: { flexDirection: 'row', marginTop: spacing.md },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  pillText: { color: colors.text, fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  starsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lavender,
  },
  starsBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 1,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
  },
  chevron: { color: colors.textMuted, fontSize: 22, marginLeft: spacing.sm },
  input: {
    marginTop: spacing.sm,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  toggleLabel: { ...typography.body, color: colors.text, flex: 1 },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.success },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
