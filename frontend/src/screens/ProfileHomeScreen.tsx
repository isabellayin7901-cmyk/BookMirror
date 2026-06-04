import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { storage } from '../lib/storage';
import { useI18n } from '../lib/LanguageContext';
import { bookTitle, bookAuthor } from '../lib/bookDisplay';
import { signName, elementName } from '../lib/zodiacI18n';
import {
  fetchUserReviews, type UserReviewItem,
  fetchPublicProfile, followUser, unfollowUser, syncFavorites,
  fetchFavoriteIds, fetchBooksByIds, type PublicProfile,
} from '../lib/api';
import { BookDetailModal } from '../components/BookDetailModal';
import type { Book, RootStackParamList, UserProfile } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'ProfileHome'>;
const SCREEN_W = Dimensions.get('window').width;

export function ProfileHomeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { t, lang } = useI18n();

  const [selfId, setSelfId] = useState('');
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [pub, setPub] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<UserReviewItem[]>([]);
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [tab, setTab] = useState(0); // 0=书评 1=收藏
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const pagerRef = useRef<ScrollView>(null);

  const paramId = route.params?.userId;

  const load = useCallback(async () => {
    const me = await storage.getUserId();
    setSelfId(me);
    const targetId = paramId || me;
    const viewing = targetId !== me;

    const [p, profile] = await Promise.all([
      fetchPublicProfile(targetId, me),
      viewing ? Promise.resolve(null) : storage.getUserProfile(),
    ]);
    setPub(p);
    setLocalProfile(profile);

    // 书评
    if (!p || p.show_reviews) {
      setReviews(await fetchUserReviews(targetId));
    } else {
      setReviews([]);
    }

    // 收藏
    if (viewing) {
      if (!p || p.show_favorites) {
        const ids = await fetchFavoriteIds(targetId, me);
        setFavorites(ids.length ? await fetchBooksByIds(ids) : []);
      } else {
        setFavorites([]);
      }
    } else {
      const favs = await storage.getFavorites();
      setFavorites(favs);
      // 顺手把自己的收藏同步到服务器，供别人查看
      syncFavorites(me, favs.map((b) => b.id));
    }
  }, [paramId]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  const targetId = paramId || selfId;
  const viewing = !!selfId && targetId !== selfId;

  const goTab = (i: number) => {
    setTab(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  };
  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== tab) setTab(i);
  };

  const onToggleFollow = async () => {
    if (!pub || busy) return;
    setBusy(true);
    try {
      const r = pub.is_following
        ? await unfollowUser(selfId, targetId)
        : await followUser(selfId, targetId);
      setPub({
        ...pub,
        is_following: r.following,
        is_mutual: r.mutual,
        counts: { ...pub.counts, fans: pub.counts.fans + (r.following ? 1 : -1) },
      });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const counts = pub?.counts || { fans: 0, following: 0, friends: 0, visitors: 0 };
  const stats: { key: 'fans' | 'following' | 'friends' | 'visitors'; n: number }[] = [
    { key: 'fans', n: counts.fans },
    { key: 'following', n: counts.following },
    { key: 'friends', n: counts.friends },
    { key: 'visitors', n: counts.visitors },
  ];

  // 头像：自己用本地（带 avatarUri），别人用服务器 avatar_url
  const avatarUri = viewing ? pub?.avatar_url || null : localProfile?.avatarUri || null;
  const username = viewing
    ? (pub?.username || t('profileHome.noName'))
    : (localProfile?.username?.trim() || t('profileHome.noName'));
  const signature = viewing
    ? (pub?.signature || '')
    : (localProfile?.signature?.trim() || '');

  const showReviews = !pub || pub.show_reviews;
  const showFavorites = !pub || pub.show_favorites;

  const followLabel = pub?.is_mutual
    ? t('social.friendsTag')
    : pub?.is_following
      ? t('social.following')
      : t('social.follow');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        {!viewing && (
          <Pressable onPress={() => navigation.navigate('Privacy')} hitSlop={12}>
            <Text style={styles.gear}>⚙︎</Text>
          </Pressable>
        )}
      </View>

      {/* 头像 + 用户名 + 签名 */}
      <View style={styles.top}>
        <View style={styles.avatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Snowman size={72} pose="wave" />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.username}>{username}</Text>
          {!!signature && <Text style={styles.signature} numberOfLines={2}>{signature}</Text>}
          {/* 资料行：星座 / MBTI / 职业 */}
          <View style={styles.metaRow}>
            {pub?.zodiac_sun && (
              <Text style={styles.metaTag}>
                {signName(pub.zodiac_sun, lang)}
                {pub.zodiac_element ? ` · ${elementName(pub.zodiac_element, lang)}` : ''}
              </Text>
            )}
            {pub?.mbti && <Text style={styles.metaTag}>{pub.mbti}</Text>}
            {pub?.occupation && <Text style={styles.metaTag}>{pub.occupation}</Text>}
          </View>
        </View>
        {viewing ? (
          <Pressable
            onPress={onToggleFollow}
            style={[styles.followBtn, pub?.is_following && styles.followingBtn]}
          >
            <Text style={[styles.followText, pub?.is_following && styles.followingText]}>{followLabel}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate('Profile')} style={[styles.followBtn, styles.followingBtn]}>
            <Text style={[styles.followText, styles.followingText]}>{t('profileHome.edit')}</Text>
          </Pressable>
        )}
      </View>

      {/* 四栏：粉丝/关注/朋友/访客（可点进列表） */}
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Pressable
            key={s.key}
            style={styles.statCol}
            onPress={() => navigation.navigate('SocialList', { userId: targetId, type: s.key })}
          >
            <Text style={styles.statNum}>{s.n}</Text>
            <Text style={styles.statLabel}>{t(`profileHome.${s.key}`)}</Text>
          </Pressable>
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
          {!showReviews ? (
            <Text style={styles.empty}>{t('social.reviewsHidden')}</Text>
          ) : reviews.length === 0 ? (
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
          {!showFavorites ? (
            <Text style={styles.empty}>{t('social.favoritesHidden')}</Text>
          ) : favorites.length === 0 ? (
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
  gear: { fontSize: 22, color: colors.textMuted },

  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  avatar: { width: 78, height: 78, borderRadius: 39, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  username: { ...typography.h2, fontFamily: 'ZCOOLKuaiLe_400Regular' },
  signature: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 6 },
  metaTag: { ...typography.caption, color: colors.primary, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, overflow: 'hidden', fontSize: 11 },
  followBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.terracotta, minWidth: 64, alignItems: 'center' },
  followingBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  followText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingText: { color: colors.textMuted },

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
