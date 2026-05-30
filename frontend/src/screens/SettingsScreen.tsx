import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { storage, type SearchEngine } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import type { Language, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// TODO: 换成你自己的收信邮箱
const FEEDBACK_EMAIL = 'feedback@bookmirror.app';

export function SettingsScreen({ navigation }: Props) {
  const { t, lang: language, setLang } = useI18n();
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('ask');

  useEffect(() => {
    storage.getSettings().then((s) => setSearchEngine(s.searchEngine ?? 'ask'));
  }, []);

  const changeLang = (lang: Language) => setLang(lang);

  const changeEngine = async (e: SearchEngine) => {
    setSearchEngine(e);
    const s = await storage.getSettings();
    await storage.setSettings({ ...s, searchEngine: e });
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
      <View style={{ padding: spacing.lg }}>
        <Text style={typography.h1}>{t('settings.title')}</Text>

        <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => changeLang('zh')}
            style={[styles.langBtn, language === 'zh' && styles.langBtnActive]}
          >
            <Text style={[styles.langText, language === 'zh' && styles.langTextActive]}>中文</Text>
          </Pressable>
          <Pressable
            onPress={() => changeLang('en')}
            style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          >
            <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>English</Text>
          </Pressable>
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

        <Text style={[typography.caption, { marginTop: spacing.xxl, textAlign: 'center' }]}>
          BookMirror v0.1.0
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', marginTop: spacing.md },
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
});
