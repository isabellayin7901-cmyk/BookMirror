import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { Sparkle } from '../illustrations/Sparkle';
import { useI18n } from '../lib/LanguageContext';
import { storage } from '../lib/storage';
import { googleLogin } from '../lib/api';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

type Social = 'apple' | 'google' | 'wechat';

const SOCIALS: { key: Social; icon: string; color: string }[] = [
  { key: 'apple', icon: '', color: '#1A1A1A' },
  { key: 'google', icon: 'G', color: '#4285F4' },
  { key: 'wechat', icon: '微', color: '#07C160' },
];

const googleCfg = (Constants.expoConfig?.extra as
  | { google?: { webClientId?: string; iosClientId?: string } }
  | undefined)?.google;

export function AuthScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const onboarding = route.params?.onboarding ?? true;
  const [busy, setBusy] = useState<Social | null>(null);

  useEffect(() => {
    if (googleCfg?.webClientId) {
      GoogleSignin.configure({
        webClientId: googleCfg.webClientId,
        iosClientId: googleCfg.iosClientId,
      });
    }
  }, []);

  const signInGoogle = async () => {
    setBusy('google');
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo: any = await GoogleSignin.signIn();
      // 兼容新旧返回结构：{data:{idToken}} 或 {idToken}。
      const idToken: string | undefined =
        userInfo?.data?.idToken ?? userInfo?.idToken;
      if (!idToken) {
        throw new Error('no idToken');
      }
      const res = await googleLogin(idToken);
      await storage.setAuthToken(res.token);
      await storage.setUserId(res.user_id);
      try {
        const { uploadAccountProfile, hydrateAccountProfile } = await import('../lib/api');
        const local = await storage.getUserProfile();
        if (local) await uploadAccountProfile(local);
        else await hydrateAccountProfile();
      } catch { /* best-effort */ }
      navigation.replace('Quiz', { onboarding });
    } catch (e: any) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        // 用户主动取消，不提示。
        return;
      }
      Alert.alert(t('auth.googleFailTitle'), t('auth.googleFailBody'));
    } finally {
      setBusy(null);
    }
  };

  const social = (key: Social) => {
    if (key === 'google') {
      signInGoogle();
      return;
    }
    // 其余凭证尚未接入，占位提示。
    Alert.alert(t('auth.comingSoonTitle'), t('auth.comingSoonBody'));
  };

  const phone = () => navigation.navigate('PhoneAuth', { onboarding });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.mascot}>
          <Snowman size={110} pose="wave" />
        </View>

        <View style={styles.titleRow}>
          <Sparkle size={16} color={colors.terracotta} />
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Sparkle size={16} color={colors.terracotta} />
        </View>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        <View style={styles.options}>
          {SOCIALS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => social(s.key)}
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.socialBtn,
                shadow.soft,
                pressed && { opacity: 0.85 },
                busy !== null && busy !== s.key && { opacity: 0.5 },
              ]}
            >
              <View style={[styles.socialIcon, { backgroundColor: s.color }]}>
                {busy === s.key ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.socialIconText}>{s.icon || ''}</Text>
                )}
              </View>
              <Text style={styles.socialLabel}>{t(`auth.social.${s.key}`)}</Text>
            </Pressable>
          ))}

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            onPress={phone}
            style={({ pressed }) => [styles.phoneBtn, shadow.soft, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.phoneLabel}>{t('auth.phone')}</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>{t('auth.terms')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  mascot: { marginBottom: spacing.md },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 28, color: colors.terracotta, letterSpacing: 2, fontFamily: 'ZCOOLKuaiLe_400Regular' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  options: { width: '100%', maxWidth: 360, gap: spacing.md },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  socialIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  socialLabel: { fontSize: 16, fontWeight: '600', color: colors.text },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textFaint },

  phoneBtn: {
    backgroundColor: colors.terracotta,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  phoneLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },

  hint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
    color: colors.textFaint,
    maxWidth: 320,
  },
});
