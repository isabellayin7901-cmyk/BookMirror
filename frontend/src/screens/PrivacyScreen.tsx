import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { fetchPrivacy, savePrivacy, type PrivacySettings } from '../lib/api';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const KEYS: { key: keyof PrivacySettings; labelKey: string; descKey: string }[] = [
  { key: 'hideSignature', labelKey: 'privacy.hideSignature', descKey: 'privacy.hideSignatureDesc' },
  { key: 'hideInfo', labelKey: 'privacy.hideInfo', descKey: 'privacy.hideInfoDesc' },
  { key: 'hideReviews', labelKey: 'privacy.hideReviews', descKey: 'privacy.hideReviewsDesc' },
  { key: 'hideFavorites', labelKey: 'privacy.hideFavorites', descKey: 'privacy.hideFavoritesDesc' },
  { key: 'hideVisitors', labelKey: 'privacy.hideVisitors', descKey: 'privacy.hideVisitorsDesc' },
];

export function PrivacyScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const [uid, setUid] = useState('');
  const [p, setP] = useState<PrivacySettings>({
    hideSignature: false, hideInfo: false, hideReviews: false, hideFavorites: false, hideVisitors: false,
  });

  const load = useCallback(async () => {
    const id = await storage.getUserId();
    setUid(id);
    setP(await fetchPrivacy(id));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (key: keyof PrivacySettings) => {
    const next = { ...p, [key]: !p[key] };
    setP(next);
    if (uid) savePrivacy(uid, next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('privacy.title')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.hint}>{t('privacy.hint')}</Text>
        {KEYS.map(({ key, labelKey, descKey }) => (
          <Pressable key={key} style={styles.row} onPress={() => toggle(key)}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={styles.rowLabel}>{t(labelKey)}</Text>
              <Text style={styles.rowDesc}>{t(descKey)}</Text>
            </View>
            <View style={[styles.switch, p[key] && styles.switchOn]}>
              <View style={[styles.knob, p[key] && styles.knobOn]} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 30, color: colors.textMuted, width: 30 },
  title: { ...typography.h3, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  rowLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  switch: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.success },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
