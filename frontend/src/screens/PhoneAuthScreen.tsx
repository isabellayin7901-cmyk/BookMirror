import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { useI18n } from '../lib/LanguageContext';
import { storage } from '../lib/storage';
import { requestPhoneCode, verifyPhoneCode } from '../lib/api';
import { COUNTRY_CODES, DEFAULT_COUNTRY, filterCountries, type CountryCode } from '../data/countryCodes';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneAuth'>;

type Step = 'phone' | 'code';

export function PhoneAuthScreen({ navigation, route }: Props) {
  const { t, lang } = useI18n();
  const onboarding = route.params?.onboarding ?? true;

  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const countryName = (c: CountryCode) => (lang === 'en' ? c.name_en : c.name_zh);
  const filtered = useMemo(() => filterCountries(search), [search]);

  const sendCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) {
      Alert.alert(t('auth.invalidPhoneTitle'), t('auth.invalidPhoneBody'));
      return;
    }
    setBusy(true);
    try {
      const res = await requestPhoneCode(country.dial, digits);
      setPhone(digits);
      setStep('code');
      if (res.dev_code) {
        // mock 开发模式：直接带出验证码方便自测。
        setCode(res.dev_code);
        Alert.alert(t('auth.devCodeTitle'), `${t('auth.devCodeBody')} ${res.dev_code}`);
      }
    } catch (e) {
      Alert.alert(t('auth.sendFailTitle'), t('auth.sendFailBody'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length < 4) {
      Alert.alert(t('auth.invalidCodeTitle'), t('auth.invalidCodeBody'));
      return;
    }
    setBusy(true);
    try {
      const res = await verifyPhoneCode(country.dial, phone, c);
      await storage.setAuthToken(res.token);
      await storage.setUserId(res.user_id);
      // 登录成功 → 进入 MBTI 等引导（覆盖式跳转，避免返回回登录页）。
      navigation.replace('Quiz', { onboarding });
    } catch (e) {
      Alert.alert(t('auth.verifyFailTitle'), t('auth.verifyFailBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.body}>
          <Text style={styles.title}>
            {step === 'phone' ? t('auth.phoneTitle') : t('auth.codeTitle')}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? t('auth.phoneHint')
              : `${t('auth.codeHint')} ${country.dial} ${phone}`}
          </Text>

          {step === 'phone' ? (
            <>
              <View style={styles.row}>
                <Pressable
                  style={[styles.ccBtn, shadow.soft]}
                  onPress={() => setPickerOpen(true)}
                >
                  <Text style={styles.ccFlag}>{country.flag}</Text>
                  <Text style={styles.ccDial}>{country.dial}</Text>
                  <Text style={styles.ccCaret}>▾</Text>
                </Pressable>
                <TextInput
                  style={[styles.input, shadow.soft]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('auth.phonePlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  maxLength={15}
                  autoFocus
                />
              </View>

              <Pressable
                onPress={sendCode}
                disabled={busy}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }, busy && { opacity: 0.6 }]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>{t('auth.sendCode')}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={[styles.codeInput, shadow.soft]}
                value={code}
                onChangeText={setCode}
                placeholder={t('auth.codePlaceholder')}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <Pressable
                onPress={verify}
                disabled={busy}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }, busy && { opacity: 0.6 }]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>{t('auth.verifyCode')}</Text>
                )}
              </Pressable>
              <Pressable onPress={() => { setStep('phone'); setCode(''); }} style={styles.backLink}>
                <Text style={styles.backText}>{t('auth.changePhone')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* 国号选择器 */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t('auth.pickCountry')}</Text>
            <Pressable onPress={() => { setPickerOpen(false); setSearch(''); }}>
              <Text style={styles.pickerClose}>{t('auth.close')}</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.searchInput, shadow.soft]}
            value={search}
            onChangeText={setSearch}
            placeholder={t('auth.searchCountry')}
            placeholderTextColor={colors.textFaint}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.iso}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={styles.countryRow}
                onPress={() => {
                  setCountry(item);
                  setPickerOpen(false);
                  setSearch('');
                }}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{countryName(item)}</Text>
                <Text style={styles.countryDial}>{item.dial}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
  title: { ...typography.h1, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },

  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  ccBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 54,
  },
  ccFlag: { fontSize: 20 },
  ccDial: { fontSize: 16, fontWeight: '700', color: colors.text },
  ccCaret: { fontSize: 12, color: colors.textMuted },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 54,
    fontSize: 17,
    color: colors.text,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 56,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.terracotta,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  backLink: { alignItems: 'center', marginTop: spacing.lg },
  backText: { ...typography.body, color: colors.terracotta },

  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  pickerTitle: { ...typography.h2 },
  pickerClose: { ...typography.body, color: colors.terracotta },
  searchInput: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
    color: colors.text,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryFlag: { fontSize: 22 },
  countryName: { flex: 1, fontSize: 16, color: colors.text },
  countryDial: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
