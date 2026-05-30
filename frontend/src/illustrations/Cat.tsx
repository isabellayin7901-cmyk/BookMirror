import React from 'react';
import Svg, { Circle, Ellipse, Path, Line, G } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  size?: number;
}

/** 一只奶茶色小猫，圆头三角耳，蜷成一团。 */
export function Cat({ size = 100 }: Props) {
  const stroke = colors.primary;
  const sw = 1.6;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <G>
        {/* 尾巴 */}
        <Path
          d="M 78 70 Q 92 60 88 45 Q 86 38 80 38"
          stroke={stroke}
          strokeWidth={sw}
          fill={colors.catBody}
          strokeLinecap="round"
        />

        {/* 身体（蜷缩） */}
        <Ellipse cx="50" cy="68" rx="32" ry="20" fill={colors.catBody} stroke={stroke} strokeWidth={sw} />

        {/* 头 */}
        <Circle cx="50" cy="42" r="20" fill={colors.catBody} stroke={stroke} strokeWidth={sw} />

        {/* 三角耳朵（左） */}
        <Path d="M 34 30 L 30 16 L 42 25 Z" fill={colors.catBody} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <Path d="M 35 26 L 33 20 L 39 24 Z" fill={colors.bunnyBlush} opacity={0.5} />

        {/* 三角耳朵（右） */}
        <Path d="M 66 30 L 70 16 L 58 25 Z" fill={colors.catBody} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <Path d="M 65 26 L 67 20 L 61 24 Z" fill={colors.bunnyBlush} opacity={0.5} />

        {/* 腮红 */}
        <Ellipse cx="35" cy="48" rx="4" ry="2.5" fill={colors.bunnyBlush} opacity={0.6} />
        <Ellipse cx="65" cy="48" rx="4" ry="2.5" fill={colors.bunnyBlush} opacity={0.6} />

        {/* 眯眯眼 */}
        <Path d="M 40 41 Q 43 39 46 41" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
        <Path d="M 54 41 Q 57 39 60 41" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />

        {/* 鼻子 + 嘴 */}
        <Path d="M 48 47 L 52 47 L 50 49 Z" fill={stroke} />
        <Path d="M 50 49 L 50 52 M 50 52 Q 47 54 45 52 M 50 52 Q 53 54 55 52"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />

        {/* 胡须 */}
        <Line x1="30" y1="48" x2="22" y2="46" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
        <Line x1="30" y1="51" x2="22" y2="52" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
        <Line x1="70" y1="48" x2="78" y2="46" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
        <Line x1="70" y1="51" x2="78" y2="52" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
