import React from 'react';
import Svg, { Circle, Ellipse, Path, Line, G } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  size?: number;
  pose?: 'reading' | 'wave' | 'sit';
}

/**
 * 一只手绘风格的兔子 —— 米色身体、长耳朵、腮红、坐姿。
 * 全部用线条 + 实色填充，类似铅笔轮廓 + 水彩填充。
 */
export function Bunny({ size = 140, pose = 'sit' }: Props) {
  const stroke = colors.primary;
  const sw = 1.6; // stroke width

  return (
    <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
      <G>
        {/* 长耳朵（左） */}
        <Ellipse cx="50" cy="32" rx="9" ry="22" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
        <Ellipse cx="50" cy="34" rx="4" ry="14" fill={colors.bunnyEar} />

        {/* 长耳朵（右） */}
        <Ellipse cx="78" cy="32" rx="9" ry="22" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
        <Ellipse cx="78" cy="34" rx="4" ry="14" fill={colors.bunnyEar} />

        {/* 身体（坐姿，下宽上窄） */}
        <Path
          d="M 35 110 Q 32 80 50 72 Q 70 65 90 72 Q 108 80 105 110 Q 100 122 70 122 Q 40 122 35 110 Z"
          fill={colors.bunnyBody}
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* 头 */}
        <Ellipse cx="64" cy="68" rx="28" ry="25" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />

        {/* 腮红 */}
        <Ellipse cx="46" cy="74" rx="5" ry="3" fill={colors.bunnyBlush} opacity={0.7} />
        <Ellipse cx="82" cy="74" rx="5" ry="3" fill={colors.bunnyBlush} opacity={0.7} />

        {/* 眼睛 */}
        <Circle cx="54" cy="66" r="2" fill={stroke} />
        <Circle cx="74" cy="66" r="2" fill={stroke} />

        {/* 鼻子 */}
        <Path d="M 62 72 Q 64 74 66 72" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />

        {/* 嘴 */}
        <Path d="M 64 74 L 64 78 M 64 78 Q 60 81 58 79 M 64 78 Q 68 81 70 79"
          stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />

        {/* 手手（捧着的姿态） */}
        {pose === 'reading' && (
          <>
            <Ellipse cx="48" cy="100" rx="8" ry="6" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
            <Ellipse cx="80" cy="100" rx="8" ry="6" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
          </>
        )}
        {pose === 'sit' && (
          <>
            <Ellipse cx="42" cy="105" rx="7" ry="9" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
            <Ellipse cx="86" cy="105" rx="7" ry="9" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
          </>
        )}
        {pose === 'wave' && (
          <>
            <Ellipse cx="42" cy="105" rx="7" ry="9" fill={colors.bunnyBody} stroke={stroke} strokeWidth={sw} />
            <Path d="M 86 100 Q 95 88 92 80" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill={colors.bunnyBody} />
          </>
        )}
      </G>
    </Svg>
  );
}
