import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  size?: number;
  color?: string;
}

/** 四角星点缀，用于标题/卡片边角的小装饰。 */
export function Sparkle({ size = 16, color = colors.terracotta }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 12 2 L 13.5 10.5 L 22 12 L 13.5 13.5 L 12 22 L 10.5 13.5 L 2 12 L 10.5 10.5 Z"
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
}

/** 小爱心，用于结果页关键词标签 */
export function Heart({ size = 14, color = colors.rose }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 12 20 C 12 20 4 14 4 9 C 4 6 6 4 9 4 C 10.5 4 12 5 12 7 C 12 5 13.5 4 15 4 C 18 4 20 6 20 9 C 20 14 12 20 12 20 Z"
        fill={color}
      />
    </Svg>
  );
}

/** 一缕飘叶子，用于装饰角落 */
export function Leaf({ size = 24, color = colors.sage }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M 3 21 Q 12 16 18 8 Q 20 5 21 3 Q 16 4 11 8 Q 5 13 3 21 Z"
        fill={color}
        opacity={0.7}
      />
      <Path d="M 3 21 Q 9 14 16 8" stroke={colors.primary} strokeWidth={1} fill="none" opacity={0.4} />
    </Svg>
  );
}
