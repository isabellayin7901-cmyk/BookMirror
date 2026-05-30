import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { Sparkle, Heart, Leaf } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { storage } from '../lib/storage';
import { analyzeAstrology } from '../lib/api';
import { LocationPicker, type SelectedLocation } from '../components/LocationPicker';
import { NatalChart } from '../components/NatalChart';
import { useI18n } from '../lib/LanguageContext';
import type { Birthday, RootStackParamList, ZodiacReading } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Astrology'>;

export function AstrologyScreen({ navigation }: Props) {
  const { t, lang } = useI18n();
  const [birthday, setBirthday] = useState<Partial<Birthday>>({});
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zodiac, setZodiac] = useState<ZodiacReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage.getUserProfile().then((p) => {
      if (p?.birthday) setBirthday(p.birthday);
      if (p?.birthplace) setLocation(p.birthplace);
      if (p?.zodiac) setZodiac(p.zodiac);
      setLoaded(true);
    });
  }, []);

  // 实时保存出生信息（含出生地）：下次进来自动带出，不用重填
  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(async () => {
      const profile = await storage.getUserProfile();
      if (!profile) return;
      const bday = validate();
      await storage.setUserProfile({
        ...profile,
        ...(bday ? { birthday: bday } : {}),
        birthplace: location ?? undefined,
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [birthday, location, loaded]);

  // 校验 + 范围限制：提交时统一做，输入过程不打断
  const validate = (): Birthday | null => {
    const { year, month, day, hour, minute } = birthday;
    if (year === undefined || month === undefined || day === undefined ||
        hour === undefined || minute === undefined) return null;
    if (year < 1900 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    return { year, month, day, hour, minute };
  };

  const canAnalyze = !!validate();

  const submit = async () => {
    const bday = validate();
    if (!bday) {
      Alert.alert(t('astro.checkDate'), t('astro.checkDateMsg'));
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeAstrology(
        bday,
        lang,
        location ? { latitude: location.city.latitude, longitude: location.city.longitude } : undefined,
      );
      const profile = await storage.getUserProfile();
      if (profile) {
        await storage.setUserProfile({
          ...profile,
          birthday: bday,
          birthplace: location ?? undefined,
          zodiac: { ...result, language: lang },
        });
      }
      // 直接跳到只读结果页
      navigation.replace('AstrologyResult');
    } catch (e: any) {
      Alert.alert(t('astro.errTitle'), e?.message ?? t('astro.errMsg'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.titleRow}>
          <Sparkle size={20} color={colors.lavender} />
          <Text style={styles.title}>{t('astro.title')}</Text>
        </View>
        <WavyUnderline width={90} color={colors.lavender} />
        <Text style={styles.subtitle}>{t('astro.subtitle')}</Text>

        {/* 输入卡片 */}
        <View style={[styles.card, shadow.soft]}>
          <View style={styles.cardTitleRow}>
            <Heart size={14} />
            <Text style={styles.cardTitle}>{t('astro.birthday')}</Text>
          </View>

          {/* 年月日一行 */}
          <View style={styles.inputRow}>
            <NumInput
              label={t('astro.year')}
              value={birthday.year}
              onChange={(n) => setBirthday({ ...birthday, year: n })}
              maxLength={4}
              placeholder="2000"
              flex={1.6}
            />
            <NumInput
              label={t('astro.month')}
              value={birthday.month}
              onChange={(n) => setBirthday({ ...birthday, month: n })}
              maxLength={2}
              placeholder="6"
            />
            <NumInput
              label={t('astro.day')}
              value={birthday.day}
              onChange={(n) => setBirthday({ ...birthday, day: n })}
              maxLength={2}
              placeholder="15"
            />
          </View>

          {/* 时:分 一行 */}
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{t('astro.birthTime')}</Text>
            <View style={styles.timeInputs}>
              <NumInput
                value={birthday.hour}
                onChange={(n) => setBirthday({ ...birthday, hour: n })}
                maxLength={2}
                placeholder="14"
                flex={1}
                noLabel
              />
              <Text style={styles.colon}>:</Text>
              <NumInput
                value={birthday.minute}
                onChange={(n) => setBirthday({ ...birthday, minute: n })}
                maxLength={2}
                placeholder="30"
                flex={1}
                noLabel
              />
            </View>
          </View>

          <Text style={styles.hint}>{t('astro.timeHint')}</Text>

          {/* 出生地 —— 弹出选择器 */}
          <Text style={[styles.timeLabel, { marginTop: spacing.lg }]}>
            {t('astro.birthplace')}
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.locationBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.locationLabel}>
              {location
                ? `${location.scope === 'cn' ? '🇨🇳' : '🌍'}  ${location.region} · ${location.city.name}`
                : t('astro.pickLocation')}
            </Text>
            <Text style={styles.locationArrow}>›</Text>
          </Pressable>
          {location && (
            <Pressable onPress={() => setLocation(null)} hitSlop={6}>
              <Text style={styles.clearLink}>{t('astro.skipLocation')}</Text>
            </Pressable>
          )}
          <Text style={styles.hint}>
            {t('astro.locationHint')}
          </Text>

          <PrimaryButton
            title={loading ? t('astro.analyzing') : t('astro.analyze')}
            style={{ marginTop: spacing.md }}
            disabled={!canAnalyze}
            loading={loading}
            onPress={submit}
          />
        </View>

      </ScrollView>

      <LocationPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(loc) => {
          setLocation(loc);
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function NumInput({
  label, value, onChange, maxLength, placeholder, flex = 1, noLabel,
}: {
  label?: string;
  value?: number;
  onChange: (n: number | undefined) => void;
  maxLength: number;
  placeholder: string;
  flex?: number;
  noLabel?: boolean;
}) {
  // 本地维护字符串，避免父级数字状态把输入中的"2"瞬间清空
  const [text, setText] = React.useState<string>(value !== undefined ? String(value) : '');

  // 仅当外部值跟当前输入解析结果不一致（如初始加载、清空）才同步
  React.useEffect(() => {
    const parsed = text === '' ? undefined : parseInt(text, 10);
    if (parsed !== value) {
      setText(value !== undefined ? String(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <View style={[inputStyles.wrap, { flex }]}>
      {!noLabel && <Text style={inputStyles.label}>{label}</Text>}
      <TextInput
        style={inputStyles.input}
        keyboardType="number-pad"
        value={text}
        onChangeText={(s) => {
          // 只保留数字
          const cleaned = s.replace(/\D/g, '').slice(0, maxLength);
          setText(cleaned);
          if (cleaned === '') {
            onChange(undefined);
          } else {
            const n = parseInt(cleaned, 10);
            if (!isNaN(n)) onChange(n);
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        maxLength={maxLength}
      />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrap: { marginHorizontal: 4 },
  label: { fontSize: 11, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
  input: {
    height: 44,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    backgroundColor: colors.bg,
    fontSize: 15,
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, marginLeft: spacing.xs },
  subtitle: { ...typography.caption, marginTop: spacing.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  cardTitle: { ...typography.h3, marginLeft: spacing.xs },

  inputRow: { flexDirection: 'row', marginTop: spacing.md },
  timeRow: { marginTop: spacing.md },
  timeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
  },
  colon: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textMuted,
    marginHorizontal: 4,
    marginTop: -4,
  },
  hint: { ...typography.caption, fontSize: 11, marginTop: spacing.sm },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  locationLabel: { ...typography.body, fontSize: 14, flex: 1 },
  locationArrow: { color: colors.textMuted, fontSize: 22 },
  clearLink: {
    color: colors.terracotta,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },

  bigSign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  sunSign: {
    fontSize: 40,
    color: colors.terracotta,
    letterSpacing: 6,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
  },
  elementBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elementText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  subSignRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  subSign: { alignItems: 'center' },
  subSignLabel: { fontSize: 11, color: colors.textMuted },
  subSignValue: {
    fontSize: 16,
    color: colors.primary,
    marginTop: 2,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 1.5,
  },

  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.md },
  keywordTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  keywordText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 1.5,
  },

  description: {
    fontSize: 15,
    lineHeight: 28,
    marginTop: spacing.md,
    color: colors.text,
    fontFamily: 'ZCOOLKuaiLe_400Regular',
    letterSpacing: 1.2,
  },
  disclaimer: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
});
