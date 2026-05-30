import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { useI18n } from '../lib/LanguageContext';
import { signName, planetLabel } from '../lib/zodiacI18n';

const SIZE = 340;
const CENTER = SIZE / 2;
const OUTER_R = SIZE / 2 - 6;
const SIGN_INNER_R = OUTER_R - 28;   // 星座环内边
const HOUSE_INNER_R = SIGN_INNER_R - 20;  // 宫位数字环内边
const PLANET_BASE_R = HOUSE_INNER_R - 20; // 行星基础半径

const SIGNS = [
  { name: '白羊', glyph: '♈', element: '火' },
  { name: '金牛', glyph: '♉', element: '土' },
  { name: '双子', glyph: '♊', element: '风' },
  { name: '巨蟹', glyph: '♋', element: '水' },
  { name: '狮子', glyph: '♌', element: '火' },
  { name: '处女', glyph: '♍', element: '土' },
  { name: '天秤', glyph: '♎', element: '风' },
  { name: '天蝎', glyph: '♏', element: '水' },
  { name: '射手', glyph: '♐', element: '火' },
  { name: '摩羯', glyph: '♑', element: '土' },
  { name: '水瓶', glyph: '♒', element: '风' },
  { name: '双鱼', glyph: '♓', element: '水' },
];

const ELEMENT_COLOR: Record<string, string> = {
  火: colors.rose,
  土: colors.sage,
  风: colors.lavender,
  水: colors.sky,
};

const PLANET_SYMBOLS: Record<string, { glyph: string; label: string; color: string }> = {
  sun: { glyph: '☉', label: '日', color: '#E8A33C' },
  moon: { glyph: '☽', label: '月', color: '#8E8478' },
  mercury: { glyph: '☿', label: '水', color: colors.sky },
  venus: { glyph: '♀', label: '金', color: colors.rose },
  mars: { glyph: '♂', label: '火', color: colors.terracotta },
  jupiter: { glyph: '♃', label: '木', color: colors.sage },
  saturn: { glyph: '♄', label: '土', color: colors.primary },
  ascendant: { glyph: 'AC', label: '升', color: colors.lavender },
};

export interface ChartPlanet {
  sign: string;
  longitude: number;
}

export interface ChartData {
  sun: ChartPlanet;
  moon: ChartPlanet;
  mercury?: ChartPlanet;
  venus?: ChartPlanet;
  mars?: ChartPlanet;
  jupiter?: ChartPlanet;
  saturn?: ChartPlanet;
  ascendant?: ChartPlanet;
  houses?: number[];
  mc_longitude?: number;
}

interface Props {
  chart: ChartData;
}

/**
 * 把黄经转 SVG 角度。
 * 占星惯例：上升点（ascendant）在左侧 9 点钟方向。
 * 如果没有上升点，0° 白羊在 9 点钟方向。
 */
function makePolar(ascLongitude: number | null) {
  // SVG 0° 在右、顺时针递增。占星 0° 在左、逆时针递增
  // SVG 角度（rad）= ((180 + (asc - lon))) * π/180
  const ascRef = ascLongitude ?? 0;
  return (longitude: number, radius: number) => {
    const deg = 180 + (ascRef - longitude);
    const a = deg * (Math.PI / 180);
    return {
      x: CENTER + radius * Math.cos(a),
      y: CENTER - radius * Math.sin(a),
    };
  };
}

/** 输入度数 0-360，输出对应星座 index 0-11 */
function signIndex(lon: number): number {
  return Math.floor(((lon % 360) + 360) % 360 / 30);
}

/** 避免行星图标重叠：同区域内（黄经差 < 8°）的多颗行星往内侧错开半径 */
function assignRadii<T extends { lon: number }>(planets: T[], baseR: number, step: number = 18): Array<T & { radius: number }> {
  // 按黄经升序处理
  const sorted = [...planets].map((p, i) => ({ ...p, _i: i }));
  const out: Array<T & { radius: number }> = [];
  for (const p of sorted) {
    let r = baseR;
    while (out.some((o) => Math.abs(angleDiff(o.lon, p.lon)) < 7 && Math.abs(o.radius - r) < step - 2)) {
      r -= step;
      if (r < baseR - step * 4) break;
    }
    out.push({ ...p, radius: r });
  }
  return out;
}

function angleDiff(a: number, b: number): number {
  const d = ((a - b) % 360 + 540) % 360 - 180;
  return d;
}

export function NatalChart({ chart }: Props) {
  const { lang } = useI18n();
  const asc = chart.ascendant?.longitude ?? null;
  const polar = makePolar(asc);

  const planetEntries = [
    chart.sun && { key: 'sun', planet: chart.sun },
    chart.moon && { key: 'moon', planet: chart.moon },
    chart.mercury && { key: 'mercury', planet: chart.mercury },
    chart.venus && { key: 'venus', planet: chart.venus },
    chart.mars && { key: 'mars', planet: chart.mars },
    chart.jupiter && { key: 'jupiter', planet: chart.jupiter },
    chart.saturn && { key: 'saturn', planet: chart.saturn },
    chart.ascendant && { key: 'ascendant', planet: chart.ascendant },
  ].filter(Boolean) as Array<{ key: string; planet: ChartPlanet }>;

  // 给所有行星算出非冲突的半径
  const positioned = assignRadii(
    planetEntries.map((p) => ({ key: p.key, lon: p.planet.longitude, planet: p.planet })),
    PLANET_BASE_R,
    16,
  );

  // 12 等分线（星座分界）
  const signDividers = Array.from({ length: 12 }, (_, i) => i * 30);

  // 宫位 cusps（如果有）
  const houseCusps = chart.houses ?? [];

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* 外环背景 */}
        <Circle cx={CENTER} cy={CENTER} r={OUTER_R} fill={colors.surface} stroke={colors.border} strokeWidth={1.5} />
        {/* 星座环内边 */}
        <Circle cx={CENTER} cy={CENTER} r={SIGN_INNER_R} fill={colors.bg} stroke={colors.border} strokeWidth={1} />
        {/* 宫位环内边（只有在算了宫位时画） */}
        {houseCusps.length > 0 && (
          <Circle cx={CENTER} cy={CENTER} r={HOUSE_INNER_R} fill={colors.bg} stroke={colors.borderDashed} strokeWidth={0.8} />
        )}

        {/* 12 星座分界线 */}
        {signDividers.map((deg, i) => {
          const inner = polar(deg, SIGN_INNER_R);
          const outer = polar(deg, OUTER_R);
          return (
            <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={colors.borderDashed} strokeWidth={0.8} />
          );
        })}

        {/* 每 5° 刻度 */}
        {Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => {
          const inner = polar(deg, SIGN_INNER_R);
          const tick = polar(deg, SIGN_INNER_R - (deg % 30 === 0 ? 6 : deg % 10 === 0 ? 4 : 2));
          return (
            <Line key={deg}
              x1={inner.x} y1={inner.y} x2={tick.x} y2={tick.y}
              stroke={colors.borderDashed} strokeWidth={0.5} />
          );
        })}

        {/* 12 星座 glyph */}
        {SIGNS.map((s, i) => {
          const midLon = i * 30 + 15;
          const r = (OUTER_R + SIGN_INNER_R) / 2;
          const { x, y } = polar(midLon, r);
          return (
            <SvgText
              key={s.name}
              x={x} y={y + 6}
              fontSize={17}
              fill={ELEMENT_COLOR[s.element]}
              textAnchor="middle"
              fontWeight="700"
            >
              {s.glyph}
            </SvgText>
          );
        })}

        {/* 宫位分界线 + 宫位号码（只有提供 cusps 时显示） */}
        {houseCusps.length === 12 && (
          <>
            {houseCusps.map((cuspLon, i) => {
              const isAngular = i === 0 || i === 3 || i === 6 || i === 9;
              const inner = polar(cuspLon, 30);
              const outer = polar(cuspLon, HOUSE_INNER_R);
              return (
                <Line key={`h-${i}`}
                  x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke={isAngular ? colors.primary : colors.borderDashed}
                  strokeWidth={isAngular ? 1.4 : 0.6} />
              );
            })}
            {houseCusps.map((cuspLon, i) => {
              const nextLon = houseCusps[(i + 1) % 12];
              // 宫位中点：cusp 到下一个 cusp 的中间
              let mid = cuspLon + ((nextLon - cuspLon + 360) % 360) / 2;
              mid = ((mid % 360) + 360) % 360;
              const r = (HOUSE_INNER_R + SIGN_INNER_R) / 2 - 6;
              const { x, y } = polar(mid, r);
              return (
                <SvgText
                  key={`hn-${i}`}
                  x={x} y={y + 4}
                  fontSize={11}
                  fill={colors.textMuted}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {i + 1}
                </SvgText>
              );
            })}
          </>
        )}

        {/* 行星位置 */}
        {positioned.map(({ key, lon, radius }) => {
          const { x, y } = polar(lon, radius);
          const sym = PLANET_SYMBOLS[key];
          // 上升点用箭头标，不画圆圈
          if (key === 'ascendant') {
            const tip = polar(lon, OUTER_R + 2);
            const tail = polar(lon, OUTER_R - 18);
            return (
              <G key={key}>
                <Line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y}
                  stroke={sym.color} strokeWidth={2.5} />
                <Circle cx={tail.x} cy={tail.y} r={11} fill={sym.color} />
                <SvgText x={tail.x} y={tail.y + 4} fontSize={9} fill="#fff" textAnchor="middle" fontWeight="800">
                  AC
                </SvgText>
              </G>
            );
          }
          return (
            <G key={key}>
              <Circle cx={x} cy={y} r={13} fill={sym.color} stroke={colors.surface} strokeWidth={2} />
              <SvgText x={x} y={y + 5} fontSize={14} fill="#fff" textAnchor="middle" fontWeight="700">
                {sym.glyph}
              </SvgText>
            </G>
          );
        })}

        {/* 中心点 */}
        <Circle cx={CENTER} cy={CENTER} r={2.5} fill={colors.primary} />
      </Svg>

      {/* 行星表 —— 治愈风 */}
      <View style={styles.legend}>
        {planetEntries.map(({ key, planet }) => {
          const sym = PLANET_SYMBOLS[key];
          const degInSign = ((planet.longitude % 30) + 30) % 30;
          return (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: sym.color }]}>
                <Text style={styles.legendDotText}>{sym.glyph}</Text>
              </View>
              <Text
                style={[styles.legendLabel, lang === 'en' && styles.legendLabelEn]}
                numberOfLines={1}
              >
                {planetLabel(sym.label, lang)}
              </Text>
              <Text
                style={[styles.legendSign, lang === 'en' && styles.legendSignEn]}
                numberOfLines={1}
              >
                {signName(planet.sign, lang)}
              </Text>
              <Text style={styles.legendDeg}>{degInSign.toFixed(1)}°</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ZCOOL 快乐体 —— 圆头圆脑的可爱中文字体（已通过 expo-google-fonts 加载）
const CUTE_FONT = 'ZCOOLKuaiLe_400Regular';
const NUM_FONT = 'PingFang SC';

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  legend: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.bgSoft,
    borderRadius: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  legendDot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
    opacity: 0.92,
  },
  legendDotText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // 「日星 / 月星 / 水星…」标签：圆头可爱字体
  legendLabel: {
    fontSize: 15,
    color: colors.textMuted,
    width: 46,
    fontFamily: CUTE_FONT,
    letterSpacing: 2,
  },
  // 英文行星名（Mercury / Jupiter…）较长：保留圆圆的可爱字体，仅缩小字号、去字距、加宽以保证一行写完
  legendLabelEn: {
    fontSize: 11,
    width: 68,
    letterSpacing: 0,
  },
  // 「天秤座」星座名：陶土色 + 可爱字体
  legendSign: {
    fontSize: 17,
    color: colors.terracotta,
    flex: 1,
    fontFamily: CUTE_FONT,
    marginLeft: 4,
    marginRight: 6,
    letterSpacing: 2,
  },
  // 英文星座名（Sagittarius / Capricorn…）较长：保留可爱字体，缩小字号、去字距以一行内显示完整
  legendSignEn: {
    fontSize: 13,
    letterSpacing: 0,
  },
  // 度数：数字字体
  legendDeg: {
    fontSize: 13,
    color: colors.textFaint,
    minWidth: 52,
    textAlign: 'right',
    fontFamily: NUM_FONT,
    fontWeight: '400',
  },
});
