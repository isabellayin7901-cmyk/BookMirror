import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { useI18n } from '../lib/LanguageContext';
import { fetchSocialList, type SocialUserCard } from '../lib/api';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'SocialList'>;

export function SocialListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { t } = useI18n();
  const { userId, type } = route.params;
  const [list, setList] = useState<SocialUserCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setList(await fetchSocialList(userId, type));
    setLoading(false);
  }, [userId, type]);

  useEffect(() => { load(); }, [load]);

  const title = t(`profileHome.${type}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 30 }} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(it) => it.user_id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>{t('social.emptyList')}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.push('ProfileHome', { userId: item.user_id })}
          >
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
              {!!item.signature && <Text style={styles.sig} numberOfLines={1}>{item.signature}</Text>}
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
  empty: { ...typography.body, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  name: { ...typography.body, fontWeight: '700' },
  mbti: { color: colors.terracotta, fontWeight: '600', fontSize: 12 },
  sig: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
