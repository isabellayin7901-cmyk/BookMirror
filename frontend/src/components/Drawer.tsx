import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(SCREEN_W * 0.82, 340);
const DURATION = 300;
const EASING = Easing.inOut(Easing.ease);

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, children }: Props) {
  // mounted 决定 Modal 是否渲染；open 只控制动画方向。
  // 这样关闭动画跑完后才卸载 Modal，每次开关都能看到完整过渡。
  const [mounted, setMounted] = useState(open);
  const slide = useRef(new Animated.Value(-DRAWER_W)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: DURATION, easing: EASING, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.4, duration: DURATION, easing: EASING, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slide, { toValue: -DRAWER_W, duration: DURATION, easing: EASING, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: DURATION, easing: EASING, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, slide, fade, mounted]);

  if (!mounted) return null;

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="none">
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left']}>
            {children}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: colors.bg,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
});
