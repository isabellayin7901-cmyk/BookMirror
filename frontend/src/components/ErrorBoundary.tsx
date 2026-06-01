import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

/**
 * 全局错误兜底：任意子组件渲染抛错时，显示一个友好的重试页，
 * 而不是整屏白屏 / 闪退。包在 LanguageProvider 外层，故文案用中英双语静态文本。
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 预留上报点：接入 Sentry 后在此 Sentry.captureException(error)
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.emoji}>⛄💦</Text>
        <Text style={styles.title}>出了点小状况</Text>
        <Text style={styles.titleEn}>Something went wrong</Text>
        <Text style={styles.hint}>
          桥豆麻袋…可以点下面重试一下{'\n'}Please try again
        </Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          onPress={this.handleReset}
        >
          <Text style={styles.btnText}>重试 / Retry</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  emoji: { fontSize: 44, marginBottom: spacing.md },
  title: { ...typography.h2, marginBottom: 2 },
  titleEn: { ...typography.caption, marginBottom: spacing.md },
  hint: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  btn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    backgroundColor: colors.terracotta,
    borderRadius: radius.pill,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
