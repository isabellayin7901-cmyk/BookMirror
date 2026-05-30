import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  width?: number;
  color?: string;
}

/** 手绘风波浪下划线，标题下面 */
export function WavyUnderline({ width = 80, color = colors.terracotta }: Props) {
  return (
    <Svg width={width} height={6} viewBox={`0 0 ${width} 6`} fill="none">
      <Path
        d={`M 0 3 Q ${width / 4} 0 ${width / 2} 3 T ${width} 3`}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** 虚线分隔线 */
export function DashDivider({ width = 100, color = colors.borderDashed }: Props) {
  return (
    <Svg width={width} height={2} viewBox={`0 0 ${width} 2`} fill="none">
      <Path
        d={`M 0 1 L ${width} 1`}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
    </Svg>
  );
}
