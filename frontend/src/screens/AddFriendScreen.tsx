import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, FlatList, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { fetchMyId, updateMyId, searchUsers, type SocialUserCard } from '../lib/api';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AddFriendScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const [uid, setUid] = useState('');
  const [myHandle, setMyHandle] = useState('');
  const [changesLeft, setChangesLeft] = useState(3);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SocialUserCard[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const id = await storage.getUserId();
      setUid(id);
      const r = await fetchMyId(id);
      setMyHandle(r.handle);
      setChangesLeft(r.changesLeft);
    })();
  }, []);

  // 输入防抖搜索
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const r = await searchUsers(term, uid);
      setResults(r);
      setSearching(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q, uid]);

  const copyId = useCallback(async () => {
    if (!myHandle) return;
    await Clipboard.setStringAsync(myHandle);
    Alert.alert(t('addFriend.copied'));
  }, [myHandle, t]);

  const startEdit = () => {
    if (changesLeft <= 0) { Alert.alert(t('addFriend.idLimitReached')); return; }
    setDraft(myHandle);
    setEditing(true);
  };

  const saveId = async () => {
    const h = draft.trim();
    if (h === myHandle) { setEditing(false); return; }
    setSaving(true);
    try {
      const saved = await updateMyId(uid, h);
      setMyHandle(saved.handle);
      setChangesLeft(saved.changesLeft);
      setEditing(false);
    } catch (e: any) {
      Alert.alert(t('addFriend.idError'), e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('addFriend.title')}</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* 我的 ID */}
      <View style={styles.myIdCard}>
        <Text style={styles.myIdLabel}>{t('addFriend.myId')}</Text>
        {editing ? (
          <View style={styles.editRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
              placeholder={t('addFriend.idPlaceholder')}
              placeholderTextColor={colors.textFaint}
              style={styles.editInput}
            />
            {saving ? (
              <ActivityIndicator color={colors.terracotta} />
            ) : (
              <Pressable onPress={saveId} hitSlop={8}><Text style={styles.saveBtn}>{t('addFriend.save')}</Text></Pressable>
            )}
          </View>
        ) : (
          <View style={styles.myIdRow}>
            <Text style={styles.myIdValue}>@{myHandle || '········'}</Text>
            <View style={styles.myIdActions}>
              <Pressable onPress={copyId} hitSlop={8}><Text style={styles.linkBtn}>{t('addFriend.copy')}</Text></Pressable>
              <Pressable onPress={startEdit} hitSlop={8}><Text style={styles.linkBtn}>{t('addFriend.changeId')}</Text></Pressable>
            </View>
          </View>
        )}
        <Text style={styles.myIdHint}>{t('addFriend.idHint')}{t('addFriend.idChangesLeft').replace('{n}', String(changesLeft))}</Text>
      </View>

      {/* 搜索框 */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('addFriend.searchPlaceholder')}
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} hitSlop={8}><Text style={styles.clear}>✕</Text></Pressable>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(it) => it.user_id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        ListEmptyComponent={
          searching ? (
            <ActivityIndicator color={colors.terracotta} style={{ marginTop: spacing.xl }} />
          ) : q.trim().length >= 2 ? (
            <Text style={styles.empty}>{t('addFriend.noResults')}</Text>
          ) : (
            <Text style={styles.empty}>{t('addFriend.searchTip')}</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('ProfileHome', { userId: item.user_id })}>
            <View style={styles.avatar}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Snowman size={40} pose="wave" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.username || t('profileHome.noName')}
                {!!item.mbti && <Text style={styles.mbti}>  {item.mbti}</Text>}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>@{item.handle}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 30, color: colors.textMuted, width: 30 },
  title: { ...typography.h3, color: colors.text },

  myIdCard: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  myIdLabel: { ...typography.caption, color: colors.textMuted },
  myIdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  myIdValue: { ...typography.h3, color: colors.terracotta, letterSpacing: 1 },
  myIdActions: { flexDirection: 'row', gap: spacing.md },
  linkBtn: { ...typography.body, color: colors.primary, fontSize: 14 },
  myIdHint: { ...typography.caption, color: colors.textFaint, marginTop: 6 },
  editRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  at: { ...typography.h3, color: colors.textMuted },
  editInput: { flex: 1, ...typography.h3, color: colors.text, paddingVertical: 2, letterSpacing: 1 },
  saveBtn: { ...typography.body, color: colors.terracotta, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 14, marginRight: spacing.sm },
  searchInput: { flex: 1, ...typography.body, color: colors.text, padding: 0 },
  clear: { color: colors.textFaint, fontSize: 14, paddingHorizontal: 4 },

  empty: { ...typography.body, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  name: { ...typography.body, fontWeight: '700' },
  mbti: { color: colors.terracotta, fontWeight: '600', fontSize: 12 },
  handle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
