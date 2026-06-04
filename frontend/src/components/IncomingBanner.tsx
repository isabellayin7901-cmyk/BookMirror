import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Pressable, View, Text, StyleSheet, Image, AppState, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography, radius, shadow } from '../theme';
import { Snowman } from '../illustrations/Snowman';
import { storage } from '../lib/storage';
import { fetchIncoming, type DMIncoming } from '../lib/api';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const POLL_MS = 8000;
const SHOW_MS = 4200;

/** 全局：好友发来消息时，从顶部弹跳一个横幅（头像 + 用户名 + 内容）。点一下进聊天。 */
export function IncomingBanner() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<DMIncoming | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const lastSeenId = useRef<number>(-1);
  const uidRef = useRef<string>('');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当前所在路由（用来判断是不是正开着和发信人的聊天，避免重复打扰）
  const routeInfo = useNavigationState((s) => {
    if (!s) return null;
    const r = s.routes[s.index];
    return { name: r.name as string, params: (r.params as any) || {} };
  });

  const hide = useCallback(() => {
    Animated.timing(translateY, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => setBanner(null));
  }, [translateY]);

  const show = useCallback((m: DMIncoming) => {
    setBanner(m);
    translateY.setValue(-160);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, SHOW_MS);
  }, [hide, translateY]);

  const poll = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || AppState.currentState !== 'active') return;
    const after = lastSeenId.current;
    const isBaseline = after < 0;
    const items = await fetchIncoming(uid, isBaseline ? 0 : after);
    // 首轮只建立基线（记住当前最大 id），不弹历史未读
    if (isBaseline) {
      lastSeenId.current = items.length ? items[items.length - 1].id : 0;
      return;
    }
    if (items.length === 0) return;
    const newest = items[items.length - 1];
    lastSeenId.current = newest.id;
    // 如果正开着和发信人的聊天，就不弹
    if (routeInfo?.name === 'DMChat' && routeInfo.params?.peerId === newest.sender.user_id) return;
    show(newest);
  }, [routeInfo, show]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      uidRef.current = await storage.getUserId();
      await poll();                  // 建立基线
      timer = setInterval(poll, POLL_MS);
    })();
    return () => { if (timer) clearInterval(timer); if (hideTimer.current) clearTimeout(hideTimer.current); };
    // poll 依赖 routeInfo，但我们用 ref 读 uid；routeInfo 变化时重建 interval 没问题
  }, [poll]);

  if (!banner) return null;

  const name = banner.sender.username || '@' + banner.sender.handle;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { top: insets.top + (Platform.OS === 'android' ? 8 : 4), transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[styles.card, shadow.soft]}
        onPress={() => {
          hide();
          navigation.navigate('DMChat', {
            peerId: banner.sender.user_id,
            peerName: name,
            peerAvatar: banner.sender.avatar_url,
          });
        }}
      >
        <View style={styles.avatar}>
          {banner.sender.avatar_url ? (
            <Image source={{ uri: banner.sender.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Snowman size={36} pose="wave" />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.content} numberOfLines={2}>{banner.content}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 9999 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.snowShade, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  name: { ...typography.body, fontWeight: '700' },
  content: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
