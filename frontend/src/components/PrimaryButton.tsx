import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadow } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: Props) {
  const isSecondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isSecondary ? styles.secondary : styles.primary,
        !isSecondary && shadow.soft,
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.label, isSecondary ? styles.labelSecondary : styles.labelPrimary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,  // 更圆润
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderDashed,
    borderStyle: 'dashed',     // 铅笔轮廓感
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  labelPrimary: { color: '#fff' },
  labelSecondary: { color: colors.primary },
});
