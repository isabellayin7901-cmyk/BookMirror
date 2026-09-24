import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { storage, type SearchEngine } from '../lib/storage';
import { getMe, type MeResult } from '../lib/api';
import { useI18n } from '../lib/LanguageContext';
import { systemLanguage } from '../lib/locale';
import { getRegion, regionName, REGION_CHOICES } from '../lib/region';
import type { ContentLanguagePref, RegionInfo, RootStackParamList, UiLanguageMode } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// TODO: 换成你自己的收信邮箱
const FEEDBACK_EMAIL = 'feedback@bookmirror.app';

export function SettingsScreen({ navigation }: Props) {
  const { t, lang: language, mode: langMode, setMode } = useI18n();
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('ask');
  const [me, setMe] = useState<MeResult | null>(null);
  const [contentLang, setContentLang] = useState<ContentLanguagePref>('original');
  const [regionOverride, setRegionOverride] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionInfo | null>(null);

  useEffect(() => {
    storage.getSettings().then((s) => {
      setSearchEngine(s.searchEngine ?? 'ask');
      setContentLang(s.contentLanguage ?? 'original');
      setRegionOverride(s.regionOverride ?? null);
    });
    getMe().then(setMe);
    getRegion().then(setRegion).catch(() => {});
  }, []);

  // 登录方式的可读标签
  const loginMethodLabel = (): string => {
    if (!me) return t('settings.notLoggedIn');
    if (me.provider === 'google') return t('login.google');
    if (me.provider === 'apple') return t('login.apple');
    if (me.provider === 'wechat') return t('login.wechat');
    if (me.phone) {
      // 手机号脱敏：保留尾号
      const tail = me.phone.replace(/\D/g, '').slice(-4);
      return `${t('login.phone')} ··· ${tail}`;
    }
    return t('settings.notLoggedIn');
  };

  const logout = () => {
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          await storage.clearAuth();
          navigation.navigate('Auth', { onboarding: false });
        },
      },
    ]);
  };

  const changeLang = (m: UiLanguageMode) => setMode(m);

  const changeEngine = async (e: SearchEngine) => {
    setSearchEngine(e);
    await storage.patchSettings({ searchEngine: e });
  };

  const changeContentLang = async (c: ContentLanguagePref) => {
    setContentLang(c);
    await storage.patchSettings({ contentLanguage: c });
  };

  /** null = 自动判断；否则手动指定国家码 */
  const changeRegion = async (cc: string | null) => {
    setRegionOverride(cc);
    await storage.patchSettings({ regionOverride: cc });
    setRegion(await getRegion(cc === null));
  };

  const sendFeedback = async () => {
    const subject = encodeURIComponent('BookMirror Feedback (v0.1.0)');
    const body = encodeURIComponent(
      `\n\n—— ${Platform.OS} ${Platform.Version} · v0.1.0 · ${language} ——`,
    );
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('settings.feedback'), FEEDBACK_EMAIL);
    }
  };

  const clear = () => {
    Alert.alert(t('settings.clear'), '', [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.ok'),
        style: 'destructive',
        onPress: async () => {
          await storage.clearAll();
          navigation.popToTop();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={typography.h1}>{t('settings.title')}</Text>

        {/* 账号：登录方式 */}
        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <Pressable
          onPress={() => navigation.navigate('Auth', { onboarding: false })}
          style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.infoLabel}>{t('settings.loginMethod')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.infoValue}>{loginMethodLabel()}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
        <Text style={styles.switchHint}>{t('settings.switchLoginHint')}</Text>

        <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
        <View style={styles.row}>
          {([
            { v: 'system', label: t('settings.langSystem') },
            { v: 'zh', label: '中文' },
            { v: 'en', label: 'English' },
          ] as Array<{ v: UiLanguageMode; label: string }>).map(({ v, label }) => {
            const active = langMode === v;
            return (
              <Pressable key={v} onPress={() => changeLang(v)} style={[styles.langBtn, active && styles.langBtnActive]}>
                <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {langMode === 'system' && (
          <Text style={styles.switchHint}>
            {t('settings.langSystemHint', { name: systemLanguage() === 'zh' ? '中文' : 'English' })}
          </Text>
        )}

        {/* 阅读内容语言：和界面语言相互独立 */}
        <Text style={styles.sectionLabel}>{t('settings.contentLang')}</Text>
        <Text style={[typography.caption, { marginTop: 4 }]}>{t('settings.contentLangHint')}</Text>
        <View style={styles.row}>
          {([
            { v: 'original', label: t('settings.contentOriginal') },
            { v: 'zh', label: t('settings.contentZh') },
            { v: 'en', label: t('settings.contentEn') },
          ] as Array<{ v: ContentLanguagePref; label: string }>).map(({ v, label }) => {
            const active = contentLang === v;
            return (
              <Pressable key={v} onPress={() => changeContentLang(v)} style={[styles.langBtn, active && styles.langBtnActive]}>
                <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 所在地区：决定显示哪些购书/阅读平台，自动判断错了可以手动改 */}
        <Text style={styles.sectionLabel}>{t('settings.region')}</Text>
        <Text style={[typography.caption, { marginTop: 4 }]}>{t('settings.regionHint')}</Text>
        {region?.country && (
          <Text style={styles.switchHint}>
            {t('settings.regionNow', { name: regionName(region.country, t), source: t(`region.source.${region.source}`) })}
          </Text>
        )}
        <View style={[styles.row, styles.wrapRow]}>
          {[null, ...REGION_CHOICES].map((cc) => {
            const active = regionOverride === cc;
            return (
              <Pressable key={cc ?? 'auto'} onPress={() => changeRegion(cc)} style={[styles.langBtn, styles.chip, active && styles.langBtnActive]}>
                <Text style={[styles.langText, active && styles.langTextActive]}>{cc ? regionName(cc, t) : t('settings.regionAuto')}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 我的档案 —— 点进去设置性别 + 你的星空 */}
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.navRowText}>{t('settings.profile')}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {/* 默认搜索引擎 —— 仅英文模式相关 */}
        {language === 'en' && (
          <>
            <Text style={styles.sectionLabel}>{t('settings.searchEngine')}</Text>
            <Text style={[typography.caption, { marginTop: 4, marginBottom: spacing.sm }]}>
              {t('settings.searchEngineHint')}
            </Text>
            <View style={styles.row}>
              {([
                { v: 'ask', label: t('settings.engineAsk') },
                { v: 'baidu', label: t('engine.baidu') },
                { v: 'google', label: t('engine.google') },
              ] as Array<{ v: SearchEngine; label: string }>).map(({ v, label }) => {
                const active = searchEngine === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => changeEngine(v)}
                    style={[styles.langBtn, active && styles.langBtnActive]}
                  >
                    <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* 反馈给开发者 */}
        <Pressable
          onPress={sendFeedback}
          style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.navRowText}>{t('settings.feedback')}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable onPress={clear} style={[styles.danger, { marginTop: spacing.xl }]}>
          <Text style={styles.dangerText}>{t('settings.clear')}</Text>
        </Pressable>

        {/* 登出（仅已登录时显示），放在最下方 */}
        {me && (
          <Pressable onPress={logout} style={[styles.logout, { marginTop: spacing.md }]}>
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </Pressable>
        )}

        <Text style={[typography.caption, { marginTop: spacing.xxl, textAlign: 'center' }]}>
          BookMirror v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', marginTop: spacing.md },
  wrapRow: { flexWrap: 'wrap', rowGap: spacing.sm },
  chip: { paddingHorizontal: spacing.md },
  langBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.text, fontWeight: '500' },
  langTextActive: { color: '#fff' },
  sectionLabel: { ...typography.h3, marginTop: spacing.xl },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navRowText: { ...typography.h3 },
  chevron: { color: colors.textMuted, fontSize: 22 },
  danger: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  dangerText: { color: colors.danger, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: { ...typography.body, color: colors.textMuted },
  infoValue: { ...typography.body, fontWeight: '600', color: colors.text },
  switchHint: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs, marginLeft: spacing.xs },
  logout: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '700' },
  loginBtn: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
  },
  loginText: { color: '#fff', fontWeight: '700' },
});
