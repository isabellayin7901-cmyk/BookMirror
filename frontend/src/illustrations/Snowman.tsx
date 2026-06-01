import React from 'react';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  size?: number;
  pose?: 'reading' | 'wave' | 'sit';
}

/**
 * 手绘风格的雪人 Wren —— 米白身体、鼠尾草绿格子尖帽（带白绒球）、
 * 豆沙粉围巾、胡萝卜鼻、腮红。线条 + 实色填充，温柔治愈风。
 * 与旧 Bunny 同 API（size / pose），可直接替换。
 */
export function Snowman({ size = 140, pose = 'sit' }: Props) {
  const stroke = colors.primary;
  const sw = 1.6;

  return (
    <Svg width={size} height={size} viewBox="0 0 140 140" fill="none">
      <G>
        {/* 身体（下大球） */}
        <Circle cx="70" cy="96" r="30" fill={colors.snowBody} stroke={stroke} strokeWidth={sw} />
        {/* 身体暗部 */}
        <Path d="M 52 118 Q 70 128 88 118" stroke={colors.snowShade} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
        {/* 纽扣 */}
        <Circle cx="70" cy="88" r="2.4" fill={colors.snowShade} />
        <Circle cx="70" cy="100" r="2.4" fill={colors.snowShade} />

        {/* 头（上小球） */}
        <Circle cx="70" cy="58" r="22" fill={colors.snowBody} stroke={stroke} strokeWidth={sw} />

        {/* 格子尖帽 */}
        <Path d="M 50 50 Q 70 8 94 40 Q 86 52 70 52 Q 58 52 50 50 Z" fill={colors.snowHat} stroke={stroke} strokeWidth={sw} />
        {/* 帽子格纹 */}
        <Path d="M 58 48 Q 66 26 78 22" stroke={colors.snowHatDark} strokeWidth={1.2} fill="none" opacity={0.7} />
        <Path d="M 70 51 Q 76 30 86 34" stroke={colors.snowHatDark} strokeWidth={1.2} fill="none" opacity={0.7} />
        <Path d="M 52 44 Q 72 40 92 42" stroke={colors.snowHatDark} strokeWidth={1.2} fill="none" opacity={0.7} />
        {/* 帽檐 */}
        <Path d="M 48 50 Q 70 44 96 40" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
        {/* 白绒球 */}
        <Circle cx="92" cy="36" r="6" fill={colors.snowBody} stroke={stroke} strokeWidth={sw} />

        {/* 围巾 */}
        <Path d="M 50 74 Q 70 84 90 74 Q 88 80 86 82 Q 70 90 54 82 Q 52 80 50 74 Z" fill={colors.snowScarf} stroke={stroke} strokeWidth={sw} />
        <Path d="M 84 80 Q 90 90 86 100 L 80 98 Q 82 88 80 81 Z" fill={colors.snowScarf} stroke={stroke} strokeWidth={sw} />

        {/* 腮红 */}
        <Ellipse cx="56" cy="62" rx="4.5" ry="2.8" fill={colors.snowBlush} opacity={0.75} />
        <Ellipse cx="84" cy="62" rx="4.5" ry="2.8" fill={colors.snowBlush} opacity={0.75} />

        {/* 眼睛 */}
        <Circle cx="62" cy="56" r="2.2" fill={stroke} />
        <Circle cx="78" cy="56" r="2.2" fill={stroke} />

        {/* 胡萝卜鼻 */}
        <Path d="M 70 60 L 64 63 L 70 65 Z" fill={colors.snowCarrot} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />

        {/* 树枝手手 */}
        {pose === 'reading' && (
          <>
            <Path d="M 44 96 Q 36 92 32 96 M 36 94 L 34 90 M 36 95 L 32 99" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
            <Path d="M 96 96 Q 104 92 108 96 M 104 94 L 106 90 M 104 95 L 108 99" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
          </>
        )}
        {pose === 'sit' && (
          <>
            <Path d="M 44 94 Q 34 92 30 98 M 34 93 L 31 89 M 34 94 L 29 96" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
            <Path d="M 96 94 Q 106 92 110 98 M 106 93 L 109 89 M 106 94 L 111 96" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
          </>
        )}
        {pose === 'wave' && (
          <>
            <Path d="M 44 96 Q 34 94 30 100 M 34 95 L 31 91 M 34 96 L 29 98" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
            {/* 举起来挥手的那只 */}
            <Path d="M 96 86 Q 106 74 110 64 M 108 70 L 112 70 M 107 66 L 110 62" stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none" />
          </>
        )}
      </G>
    </Svg>
  );
}
