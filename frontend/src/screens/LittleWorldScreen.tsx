import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Sparkle } from '../illustrations/Sparkle';
import { WavyUnderline } from '../illustrations/Doodle';
import { Snowman } from '../illustrations/Snowman';
import { useI18n } from '../lib/LanguageContext';
import { storage } from '../lib/storage';
import { fetchConversations, type DMConversation } from '../lib/api';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const SCREEN_W = Dimensions.get('window').width;

interface Feature {
  emoji: string;
  icon?: ImageSourcePropType;
  title: string;
  subtitle: string;
  tone: string;
  badge?: string;
  onPress?: () => void;
}

export function LittleWorldScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState(0); // 0=小世界 1=好友列表
  const pagerRef = useRef<ScrollView>(null);

  const goTab = (i: number) => {
    setTab(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  };
  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== tab) setTab(i);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部两个栏目 */}
      <View style={styles.tabBar}>
        <Pressable style={styles.tabBtn} onPress={() => goTab(0)}>
          <Text style={[styles.tabText, tab === 0 && styles.tabTextOn]}>{t('world.tabWorld')}</Text>
          {tab === 0 && <View style={styles.tabUnderline} />}
        </Pressable>
        <Pressable style={styles.tabBtn} onPress={() => goTab(1)}>
          <Text style={[styles.tabText, tab === 1 && styles.tabTextOn]}>{t('world.tabFriends')}</Text>
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
        <View style={{ width: SCREEN_W }}>
          <WorldTab navigation={navigation} />
        </View>
        <View style={{ width: SCREEN_W }}>
          <FriendsTab active={tab === 1} navigation={navigation} lang={lang} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- 小世界栏 ----------
function WorldTab({ navigation }: { navigation: Nav }) {
  const { t } = useI18n();
  const features: Feature[] = [
    { emoji: '🌗', icon: require('../../assets/persona_icon.png'), title: t('world.persona'), subtitle: t('world.personaSub'), tone: colors.lavender, onPress: () => navigation.navigate('Persona') },
    { emoji: '🪞', icon: require('../../assets/mirror_icon.png'), title: t('world.mirror'), subtitle: t('world.mirrorSub'), tone: colors.sage, onPress: () => navigation.navigate('MirrorChat') },
    { emoji: '🌱', icon: require('../../assets/growth_icon.png'), title: t('world.growth'), subtitle: t('world.growthSub'), tone: colors.butter, onPress: () => navigation.navigate('Growth') },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <View style={styles.titleRow}>
        <Sparkle size={18} color={colors.terracotta} />
        <Text style={styles.title}>{t('world.title')}</Text>
      </View>
      <WavyUnderline width={70} />
      <Text style={styles.subtitle}>{t('world.subtitle')}</Text>

      <View style={{ marginTop: spacing.xl }}>
        {features.map((f) => (
          <Pressable
            key={f.title}
            onPress={f.onPress}
            disabled={!f.onPress}
            style={({ pressed }) => [styles.card, shadow.soft, pressed && f.onPress && { transform: [{ scale: 0.98 }] }, !f.onPress && { opacity: 0.7 }]}
          >
            {f.icon ? (
              <Image source={f.icon} style={styles.iconBubble} />
            ) : (
              <View style={[styles.emojiBubble, { backgroundColor: f.tone }]}><Text style={styles.emoji}>{f.emoji}</Text></View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{f.title}</Text>
                {f.badge && <View style={styles.badge}><Text style={styles.badgeText}>{f.badge}</Text></View>}
              </View>
              <Text style={styles.cardSubtitle}>{f.subtitle}</Text>
            </View>
            {f.onPress && <Text style={styles.arrow}>›</Text>}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------- 好友列表栏 ----------
function FriendsTab({ active, navigation, lang }: { active: boolean; navigation: Nav; lang: string }) {
  const { t } = useI18n();
  const [convs, setConvs] = useState<DMConversation[]>([]);
  const [uid, setUid] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const id = await storage.getUserId();
    setUid(id);
    setConvs(await fetchConversations(id));
    setLoaded(true);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  // 切到这个栏时刷新一下未读
  useEffect(() => { if (active) load(); }, [active, load]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <View style={styles.friendsHeader}>
        <Text style={styles.friendsTitle}>{t('world.friendsTitle')}</Text>
        <Pressable onPress={() => navigation.navigate('AddFriend')} hitSlop={10}>
          <Text style={styles.addLink}>＋ {t('world.addFriend')}</Text>
        </Pressable>
      </View>

      {loaded && convs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Snowman size={64} pose="wave" />
          <Text style={styles.empty}>{t('world.noFriends')}</Text>
          <Pressable onPress={() => navigation.navigate('AddFriend')} style={styles.findBtn}>
            <Text style={styles.findBtnText}>{t('world.findFriends')}</Text>
          </Pressable>
        </View>
      ) : (
        convs.map((c) => (
          <Pressable
            key={c.peer.user_id}
            style={styles.convRow}
            onPress={() => navigation.navigate('DMChat', {
              peerId: c.peer.user_id,
              peerName: c.remark || c.peer.username || '@' + c.peer.handle,
              peerAvatar: c.peer.avatar_url,
            })}
          >
            <View style={styles.convAvatar}>
              {c.peer.avatar_url ? (
                <Image source={{ uri: c.peer.avatar_url }} style={styles.convAvatarImg} />
              ) : (
                <Snowman size={40} pose="wave" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.convName} numberOfLines={1}>{c.remark || c.peer.username || '@' + c.peer.handle}</Text>
              <Text style={styles.convLast} numberOfLines={1}>
                {c.last_content || c.last_image
                  ? (c.last_from_me ? t('world.youPrefix') : '') + (c.last_content || t('dm.imageTag'))
                  : t('world.sayHi')}
              </Text>
            </View>
            {c.unread > 0 && (
              <View style={styles.unreadBadge}><Text style={styles.unreadText}>{c.unread > 99 ? '99+' : c.unread}</Text></View>
            )}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabText: { ...typography.body, color: colors.textMuted, fontWeight: '700', fontSize: 16 },
  tabTextOn: { color: colors.terracotta },
  tabUnderline: { height: 2, width: 44, backgroundColor: colors.terracotta, borderRadius: 2, marginTop: 6, position: 'absolute', bottom: 0 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h1, marginLeft: spacing.xs },
  subtitle: { ...typography.caption, marginTop: spacing.sm },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  emojiBubble: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  iconBubble: { width: 56, height: 56, borderRadius: 28 },
  emoji: { fontSize: 26 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.h3 },
  cardSubtitle: { ...typography.caption, marginTop: 2 },
  arrow: { fontSize: 26, color: colors.textMuted, marginLeft: spacing.sm },
  badge: { backgroundColor: colors.bgSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  badgeText: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

  friendsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  friendsTitle: { ...typography.h2 },
  addLink: { ...typography.body, color: colors.terracotta, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  empty: { ...typography.body, color: colors.textMuted },
  findBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.terracotta },
  findBtnText: { color: '#fff', fontWeight: '700' },

  convRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  convAvatar: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  convAvatarImg: { width: '100%', height: '100%' },
  convName: { ...typography.body, fontWeight: '700' },
  convLast: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.terracotta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: spacing.sm },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
