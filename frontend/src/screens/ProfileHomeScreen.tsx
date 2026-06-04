import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle, bookAuthor } from '../lib/bookDisplay';
import { fetchUserReviews, type UserReviewItem } from '../lib/api';
import { BookDetailModal } from '../components/BookDetailModal';
import type { Book, RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const SCREEN_W = Dimensions.get('window').width;

export function ProfileHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<UserReviewItem[]>([]);
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [tab, setTab] = useState(0); // 0=书评 1=收藏
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const pagerRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const [p, favs, id] = await Promise.all([
      storage.getUserProfile(), storage.getFavorites(), storage.getUserId(),
    ]);
    setProfile(p);
    setFavorites(favs);
    setReviews(await fetchUserReviews(id));
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const goTab = (i: number) => {
    setTab(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  };
  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== tab) setTab(i);
  };

  const stats: { key: string; n: number }[] = [
    { key: 'fans', n: 0 },
    { key: 'following', n: 0 },
    { key: 'friends', n: 0 },
    { key: 'visitors', n: 0 },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.editLink}>{t('profileHome.edit')}</Text>
        </Pressable>
      </View>

      {/* 头像 + 用户名 + 签名 */}
      <View style={styles.top}>
        <View style={styles.avatar}>
          {profile?.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatarImg} />
          ) : (
            <Snowman size={72} pose="wave" />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.username}>{profile?.username?.trim() || t('profileHome.noName')}</Text>
          <Text style={styles.signature} numberOfLines={2}>
            {profile?.signature?.trim() || t('profileHome.noSignature')}
          </Text>
        </View>
        {/* 关注按钮（看别人主页时用；自己主页先占位为编辑） */}
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.followBtn}>
          <Text style={styles.followText}>{t('profileHome.edit')}</Text>
        </Pressable>
      </View>

      {/* 四栏：粉丝/关注/朋友/访客 */}
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.key} style={styles.statCol}>
            <Text style={styles.statNum}>{s.n}</Text>
            <Text style={styles.statLabel}>{t(`profileHome.${s.key}`)}</Text>
          </View>
        ))}
      </View>

      {/* 两个 tab：书评 / 收藏 */}
      <View style={styles.tabBar}>
        <Pressable style={styles.tabBtn} onPress={() => goTab(0)}>
          <Text style={[styles.tabText, tab === 0 && styles.tabTextOn]}>{t('profileHome.tabReviews')}</Text>
          {tab === 0 && <View style={styles.tabUnderline} />}
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => goTab(1)}>
          <Text style={[styles.tabText, tab === 1 && styles.tabTextOn]}>{t('profileHome.tabFavorites')}</Text>
          {tab === 1 && <View style={styles.tabUnderline} />}
        </Pressable>
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        style={{ flex: 1 }}
      >
        {/* 书评页 */}
        <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.pageContent}>
          {reviews.length === 0 ? (
            <Text style={styles.empty}>{t('profileHome.noReviews')}</Text>
          ) : (
            reviews.map((r, i) => (
              <Pressable key={i} style={styles.reviewCard} onPress={() => r.book && setDetailBook(r.book)}>
                <Text style={styles.reviewBook} numberOfLines={1}>
                  {r.book ? bookTitle(r.book, lang) : ''} <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}</Text>
                </Text>
                {!!r.text && <Text style={styles.reviewText} numberOfLines={3}>{r.text}</Text>}
              </Pressable>
            ))
          )}
        </ScrollView>

        {/* 收藏页 */}
        <ScrollView style={{ width: SCREEN_W }} contentContainerStyle={styles.pageContent}>
          {favorites.length === 0 ? (
            <Text style={styles.empty}>{t('profileHome.noFavorites')}</Text>
          ) : (
            favorites.map((b) => (
              <Pressable key={b.id} style={styles.favRow} onPress={() => setDetailBook(b)}>
                {b.cover_url ? (
                  <Image source={{ uri: b.cover_url }} style={styles.favCover} />
                ) : (
                  <View style={[styles.favCover, styles.favCoverFallback]}><Text>📖</Text></View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.favTitle} numberOfLines={1}>{bookTitle(b, lang)}</Text>
                  <Text style={styles.favAuthor} numberOfLines={1}>{bookAuthor(b, lang)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </ScrollView>

      <BookDetailModal visible={detailBook !== null} book={detailBook} onClose={() => setDetailBook(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { fontSize: 30, color: colors.textMuted },
  editLink: { ...typography.body, color: colors.terracotta },

  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  avatar: { width: 78, height: 78, borderRadius: 39, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  username: { ...typography.h2, fontFamily: 'ZCOOLKuaiLe_400Regular' },
  signature: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  followBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.terracotta },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  statsRow: { flexDirection: 'row', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  statCol: { flex: 1, alignItems: 'center' },
  statNum: { ...typography.h3, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  tabBar: { flexDirection: 'row', marginTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabText: { ...typography.body, color: colors.textMuted, fontWeight: '600' },
  tabTextOn: { color: colors.terracotta },
  tabUnderline: { height: 2, width: 40, backgroundColor: colors.terracotta, borderRadius: 2, marginTop: 6, position: 'absolute', bottom: 0 },

  pageContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { ...typography.body, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xxl },

  reviewCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.sm },
  reviewBook: { ...typography.body, fontWeight: '700' },
  reviewStars: { color: '#E6A23C', fontSize: 13 },
  reviewText: { ...typography.body, fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },

  favRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  favCover: { width: 44, height: 62, borderRadius: 6, backgroundColor: colors.snowShade },
  favCoverFallback: { alignItems: 'center', justifyContent: 'center' },
  favTitle: { ...typography.body, fontWeight: '600' },
  favAuthor: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
