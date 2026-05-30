import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** 莫兰迪辅色：rose / sage / sky / lavender / butter — 用于颜色多样的标签 */
  tone?: 'rose' | 'sage' | 'sky' | 'lavender' | 'butter' | 'default';
}

const toneMap = {
  rose: colors.rose,
  sage: colors.sage,
  sky: colors.sky,
  lavender: colors.lavender,
  butter: colors.butter,
  default: colors.primary,
};

export function Chip({ label, selected, onPress, disabled, tone = 'default' }: ChipProps) {
  const activeColor = toneMap[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: activeColor, borderColor: activeColor },
        disabled && styles.chipDisabled,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipDisabled: { opacity: 0.35 },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  labelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
