/**
 * 各平台的治愈风手绘图标 —— SVG 实现，跟兔子/猫咪同一套画风。
 * 全部 48×48 viewBox，使用莫兰迪色系。
 */

import React from 'react';
import Svg, {
  Circle, Ellipse, Rect, Path, Line, G, Text as SvgText,
} from 'react-native-svg';

interface IconProps {
  size?: number;
}

// ===== 微信读书：狗尾草编织环绕的小书（真编织：两条藤交叉穿插） =====
function WeReadIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 编织底层 —— 左藤的"后半段"先画 */}
      <Path
        d="M 8 40 Q 18 36 16 28 Q 14 20 24 16 Q 32 13 30 6"
        stroke="#A8B89B"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* 右藤的"后半段" */}
      <Path
        d="M 40 40 Q 30 36 32 28 Q 34 20 24 16 Q 16 13 18 6"
        stroke="#A8B89B"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* 书本（在编织中间） */}
      <Path
        d="M 14 20 Q 14 18 16 18 L 32 18 Q 34 18 34 20 L 34 36 Q 34 38 32 38 L 16 38 Q 14 38 14 36 Z"
        fill="#7BA88A"
        stroke="#5E8B5C"
        strokeWidth="1.5"
      />
      {/* 书脊 */}
      <Line x1="24" y1="18" x2="24" y2="38" stroke="#5E8B5C" strokeWidth="1" opacity="0.6" />

      {/* 编织前层 —— 左藤的"前半段"穿过书后边再绕到上面 */}
      <Path
        d="M 18 12 Q 22 8 26 10"
        stroke="#7BA88A"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* 右藤的"前半段"对应交叉 */}
      <Path
        d="M 30 12 Q 26 8 22 10"
        stroke="#7BA88A"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />

      {/* 狗尾草穗（左顶） */}
      <Ellipse cx="18" cy="6" rx="2" ry="4" fill="#A8B89B" stroke="#7BA88A" strokeWidth="0.6" transform="rotate(-20 18 6)" />
      <Path d="M 17 3 L 17.5 9 M 16 5 L 19.5 4.5 M 16 7 L 19.5 6.5" stroke="#7BA88A" strokeWidth="0.6" strokeLinecap="round" transform="rotate(-20 18 6)" />

      {/* 狗尾草穗（右顶） */}
      <Ellipse cx="30" cy="6" rx="2" ry="4" fill="#A8B89B" stroke="#7BA88A" strokeWidth="0.6" transform="rotate(20 30 6)" />
      <Path d="M 29 3 L 29.5 9 M 28 5 L 31.5 4.5 M 28 7 L 31.5 6.5" stroke="#7BA88A" strokeWidth="0.6" strokeLinecap="round" transform="rotate(20 30 6)" />

      {/* 中心小爱心装饰 */}
      <Path
        d="M 24 30 L 22 28 Q 21 27 22 26 Q 23 25 24 26 Q 25 25 26 26 Q 27 27 26 28 Z"
        fill="#FFFBF4"
        opacity="0.9"
      />
    </Svg>
  );
}

// ===== 番茄小说：两个堆叠的小番茄 =====
function FanqieIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 下番茄（大） */}
      <Circle cx="26" cy="32" r="11" fill="#D88A8A" stroke="#B85A5A" strokeWidth="1.2" />
      <Ellipse cx="22" cy="28" rx="2.5" ry="3" fill="#FFFBF4" opacity="0.4" />
      {/* 上番茄（小） */}
      <Circle cx="20" cy="16" r="8" fill="#E8A0A0" stroke="#B85A5A" strokeWidth="1.2" />
      <Ellipse cx="17" cy="13" rx="2" ry="2.5" fill="#FFFBF4" opacity="0.4" />
      {/* 上面的小叶子 */}
      <Path d="M 16 8 Q 19 6 22 9" fill="#A8B89B" stroke="#7BA88A" strokeWidth="1" />
      <Path d="M 20 9 Q 23 6 25 10" fill="#A8B89B" stroke="#7BA88A" strokeWidth="1" />
      <Line x1="20" y1="10" x2="20" y2="7" stroke="#7BA88A" strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

// ===== QQ阅读：可爱小企鹅 =====
function QQReaderIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 身体 */}
      <Ellipse cx="24" cy="30" rx="12" ry="13" fill="#6A8FB5" stroke="#4A6F8F" strokeWidth="1.3" />
      {/* 肚子（白） */}
      <Ellipse cx="24" cy="32" rx="7.5" ry="10" fill="#FFFBF4" />
      {/* 头 */}
      <Ellipse cx="24" cy="18" rx="9" ry="8.5" fill="#6A8FB5" stroke="#4A6F8F" strokeWidth="1.3" />
      {/* 腮红 */}
      <Ellipse cx="17" cy="20" rx="2" ry="1.5" fill="#E8B5A8" opacity="0.7" />
      <Ellipse cx="31" cy="20" rx="2" ry="1.5" fill="#E8B5A8" opacity="0.7" />
      {/* 眼睛 */}
      <Circle cx="20" cy="17" r="1.4" fill="#3D362E" />
      <Circle cx="28" cy="17" r="1.4" fill="#3D362E" />
      <Circle cx="20.4" cy="16.6" r="0.5" fill="#fff" />
      <Circle cx="28.4" cy="16.6" r="0.5" fill="#fff" />
      {/* 喙 */}
      <Path d="M 22 20.5 L 24 23 L 26 20.5 Z" fill="#E8A33C" stroke="#A87040" strokeWidth="0.6" />
      {/* 脚 */}
      <Ellipse cx="19" cy="42" rx="3.5" ry="1.5" fill="#E8A33C" />
      <Ellipse cx="29" cy="42" rx="3.5" ry="1.5" fill="#E8A33C" />
    </Svg>
  );
}

// ===== Apple Books：书 + 苹果封面 =====
function AppleBooksIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 书本 */}
      <Path
        d="M 9 11 Q 9 9 11 9 L 37 9 Q 39 9 39 11 L 39 39 Q 39 41 37 41 L 11 41 Q 9 41 9 39 Z"
        fill="#D4A574"
        stroke="#A87E50"
        strokeWidth="1.5"
      />
      {/* 书脊 */}
      <Line x1="24" y1="9" x2="24" y2="41" stroke="#A87E50" strokeWidth="1" opacity="0.4" />
      {/* 粉红色小爱心（封面装饰） */}
      <Circle cx="16" cy="25" r="6" fill="#FFFBF4" />
      <Path
        d="M 16 29
           L 12.5 25.5
           Q 11 24 12 22.3
           Q 13 21 14.3 21.4
           Q 15.3 21.6 16 22.5
           Q 16.7 21.6 17.7 21.4
           Q 19 21 20 22.3
           Q 21 24 19.5 25.5 Z"
        fill="#E8A0A0"
        stroke="#D88A8A"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* 心上的小高光 */}
      <Ellipse cx="14" cy="23" rx="0.9" ry="1.4" fill="#FFFBF4" opacity="0.6" />
      {/* 右侧装饰横线（书名感） */}
      <Line x1="28" y1="20" x2="36" y2="20" stroke="#A87E50" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <Line x1="28" y1="24" x2="34" y2="24" stroke="#A87E50" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <Line x1="28" y1="28" x2="35" y2="28" stroke="#A87E50" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </Svg>
  );
}

// ===== Kindle：电子书设备 =====
function KindleIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 设备外框 */}
      <Rect x="11" y="6" width="26" height="36" rx="3" fill="#B89978" stroke="#8B7355" strokeWidth="1.5" />
      {/* 屏幕 */}
      <Rect x="14" y="9" width="20" height="26" rx="1" fill="#FFFBF4" />
      {/* 屏幕上的文字线 */}
      <Line x1="16" y1="14" x2="31" y2="14" stroke="#B89978" strokeWidth="1" strokeLinecap="round" />
      <Line x1="16" y1="18" x2="29" y2="18" stroke="#B89978" strokeWidth="1" strokeLinecap="round" />
      <Line x1="16" y1="22" x2="31" y2="22" stroke="#B89978" strokeWidth="1" strokeLinecap="round" />
      <Line x1="16" y1="26" x2="27" y2="26" stroke="#B89978" strokeWidth="1" strokeLinecap="round" />
      <Line x1="16" y1="30" x2="30" y2="30" stroke="#B89978" strokeWidth="1" strokeLinecap="round" />
      {/* Home 按键 */}
      <Circle cx="24" cy="39" r="1.6" fill="#FFFBF4" stroke="#8B7355" strokeWidth="0.6" />
    </Svg>
  );
}

// ===== 京东：白色长耳狗 + 红围巾 =====
function JdIcon({ size = 42 }: IconProps) {
  const dogFill = '#FFFBF4';        // 奶白色
  const dogStroke = '#B8AFA2';      // 灰褐描边
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 长长的垂耳（左） */}
      <Path
        d="M 11 14 Q 7 18 8 26 Q 9 30 13 30 Q 16 30 16 26 L 16 16 Q 16 13 13 13 Q 11 13 11 14 Z"
        fill={dogFill}
        stroke={dogStroke}
        strokeWidth="1.3"
      />
      {/* 长长的垂耳（右） */}
      <Path
        d="M 37 14 Q 41 18 40 26 Q 39 30 35 30 Q 32 30 32 26 L 32 16 Q 32 13 35 13 Q 37 13 37 14 Z"
        fill={dogFill}
        stroke={dogStroke}
        strokeWidth="1.3"
      />
      {/* 头 */}
      <Circle cx="24" cy="22" r="11" fill={dogFill} stroke={dogStroke} strokeWidth="1.3" />
      {/* 腮红（粉嫩） */}
      <Ellipse cx="17" cy="25" rx="2" ry="1.5" fill="#E8A0A0" opacity="0.7" />
      <Ellipse cx="31" cy="25" rx="2" ry="1.5" fill="#E8A0A0" opacity="0.7" />
      {/* 眼睛 */}
      <Circle cx="20" cy="21" r="1.5" fill="#3D362E" />
      <Circle cx="28" cy="21" r="1.5" fill="#3D362E" />
      <Circle cx="20.4" cy="20.6" r="0.5" fill="#fff" />
      <Circle cx="28.4" cy="20.6" r="0.5" fill="#fff" />
      {/* 鼻子 */}
      <Ellipse cx="24" cy="25" rx="1.6" ry="1.2" fill="#3D362E" />
      {/* 嘴 */}
      <Path d="M 22 27 Q 24 29 26 27" stroke="#3D362E" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* 红围巾 */}
      <Path
        d="M 14 34 Q 24 38 34 34 L 34 38 Q 24 42 14 38 Z"
        fill="#C26565"
        stroke="#9B3F3F"
        strokeWidth="1.2"
      />
      {/* 围巾打结 */}
      <Path
        d="M 30 36 L 36 34 L 36 40 L 32 41 Z"
        fill="#D87878"
        stroke="#9B3F3F"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* 围巾纹理 */}
      <Path d="M 18 35 L 20 38 M 22 35 L 24 38 M 26 35 L 28 38" stroke="#FFFBF4" strokeWidth="0.6" opacity="0.5" />
    </Svg>
  );
}

// ===== 淘宝：购物袋 =====
function TaobaoIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 袋身 */}
      <Path
        d="M 10 18 L 38 18 L 35 41 Q 35 43 33 43 L 15 43 Q 13 43 13 41 Z"
        fill="#D88E5C"
        stroke="#A86840"
        strokeWidth="1.5"
      />
      {/* 袋耳（提手） */}
      <Path
        d="M 17 18 Q 17 9 24 9 Q 31 9 31 18"
        stroke="#A86840"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* "淘"字（白色） */}
      <SvgText x="24" y="35" fontSize="14" fontWeight="700" fill="#FFFBF4" textAnchor="middle">
        淘
      </SvgText>
    </Svg>
  );
}

// ===== 当当：暖黄小铃铛 =====
function DangdangIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 顶部小圈 */}
      <Circle cx="24" cy="9" r="2.2" fill="#E8C56A" stroke="#B89540" strokeWidth="1" />
      <Line x1="24" y1="11" x2="24" y2="14" stroke="#B89540" strokeWidth="1" />
      {/* 顶部小蝴蝶结 */}
      <Path
        d="M 19 7 Q 17 5 19 4 Q 22 4 22 7 Z M 29 7 Q 31 5 29 4 Q 26 4 26 7 Z"
        fill="#E8A0A0"
        stroke="#B85A5A"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {/* 铃铛主体 —— 暖黄 */}
      <Path
        d="M 13 32 Q 13 14 24 14 Q 35 14 35 32 L 38 32 Q 38 35 35 35 L 13 35 Q 10 35 10 32 Z"
        fill="#F0C963"
        stroke="#B89540"
        strokeWidth="1.5"
      />
      {/* 高光 */}
      <Path d="M 18 22 Q 20 18 24 18" stroke="#FFFBF4" strokeWidth="1.4" fill="none" opacity="0.6" strokeLinecap="round" />
      {/* 中线（铃铛瓣感） */}
      <Line x1="24" y1="17" x2="24" y2="33" stroke="#B89540" strokeWidth="0.8" opacity="0.3" />
      {/* 铃舌 */}
      <Circle cx="24" cy="40" r="3" fill="#E8C56A" stroke="#B89540" strokeWidth="1.2" />
      {/* 铃舌摆动小线 */}
      <Path d="M 22 37 Q 24 36 26 37" stroke="#B89540" strokeWidth="0.6" fill="none" opacity="0.5" />
    </Svg>
  );
}

// ===== Amazon：纸箱 + 微笑曲线 =====
function AmazonIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 箱体侧面 */}
      <Path
        d="M 8 20 L 40 20 L 36 42 Q 36 44 34 44 L 14 44 Q 12 44 12 42 Z"
        fill="#E5A36A"
        stroke="#A87040"
        strokeWidth="1.5"
      />
      {/* 箱顶 */}
      <Path
        d="M 8 20 L 24 12 L 40 20 L 24 28 Z"
        fill="#F0BA80"
        stroke="#A87040"
        strokeWidth="1.5"
      />
      {/* 中心线 */}
      <Line x1="24" y1="28" x2="24" y2="44" stroke="#A87040" strokeWidth="1" opacity="0.5" />
      {/* 微笑曲线（带箭头） */}
      <Path
        d="M 16 36 Q 24 41 32 36"
        stroke="#FFFBF4"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 30 34 L 32 36 L 30 38"
        stroke="#FFFBF4"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ===== 豆瓣：两颗小豆豆 =====
function DoubanIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 豆 1（深绿） */}
      <Ellipse cx="17" cy="26" rx="7.5" ry="10" fill="#5E8B5C" stroke="#3D6B3B" strokeWidth="1.3" transform="rotate(-15 17 26)" />
      <Path d="M 14 21 Q 17 17 20 21" stroke="#3D6B3B" strokeWidth="1.2" fill="none" transform="rotate(-15 17 26)" strokeLinecap="round" />
      {/* 豆豆高光 */}
      <Ellipse cx="14" cy="22" rx="1.5" ry="2.5" fill="#FFFBF4" opacity="0.35" transform="rotate(-15 17 26)" />
      {/* 豆 2（浅绿） */}
      <Ellipse cx="31" cy="24" rx="7.5" ry="10" fill="#7BA88A" stroke="#5E8B5C" strokeWidth="1.3" transform="rotate(20 31 24)" />
      <Path d="M 28 19 Q 31 15 34 19" stroke="#5E8B5C" strokeWidth="1.2" fill="none" transform="rotate(20 31 24)" strokeLinecap="round" />
      <Ellipse cx="28" cy="20" rx="1.5" ry="2.5" fill="#FFFBF4" opacity="0.35" transform="rotate(20 31 24)" />
    </Svg>
  );
}

// ===== Goodreads：打开的书 + GR =====
function GoodreadsIcon({ size = 42 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* 书底（阴影感） */}
      <Path d="M 6 14 L 42 14 L 42 38 L 6 38 Z" fill="#9B7B5E" stroke="#7A5E40" strokeWidth="1" opacity="0.3" />
      {/* 左页 */}
      <Path d="M 6 12 L 24 14 L 24 38 L 6 36 Z" fill="#FFFBF4" stroke="#9B7B5E" strokeWidth="1.4" />
      {/* 右页 */}
      <Path d="M 24 14 L 42 12 L 42 36 L 24 38 Z" fill="#FFFBF4" stroke="#9B7B5E" strokeWidth="1.4" />
      {/* 文字线 */}
      <Line x1="10" y1="20" x2="20" y2="20.8" stroke="#9B7B5E" strokeWidth="0.8" opacity="0.5" />
      <Line x1="10" y1="24" x2="20" y2="24.8" stroke="#9B7B5E" strokeWidth="0.8" opacity="0.5" />
      <Line x1="28" y1="20.8" x2="38" y2="20" stroke="#9B7B5E" strokeWidth="0.8" opacity="0.5" />
      <Line x1="28" y1="24.8" x2="38" y2="24" stroke="#9B7B5E" strokeWidth="0.8" opacity="0.5" />
      {/* GR 字母 */}
      <SvgText x="24" y="32" fontSize="9" fontWeight="700" fill="#9B7B5E" textAnchor="middle">
        GR
      </SvgText>
    </Svg>
  );
}

// ===== 平台 ID → 图标组件 =====
export const PLATFORM_ICONS: Record<string, React.FC<IconProps>> = {
  weread: WeReadIcon,
  fanqie: FanqieIcon,
  qqreader: QQReaderIcon,
  applebooks: AppleBooksIcon,
  kindle: KindleIcon,
  jd: JdIcon,
  taobao: TaobaoIcon,
  dangdang: DangdangIcon,
  amazon_us: AmazonIcon,
  douban: DoubanIcon,
  goodreads: GoodreadsIcon,
};

/** 统一入口 —— 根据 platform id 渲染对应图标 */
export function PlatformIcon({ id, size = 42 }: { id: string; size?: number }) {
  const Icon = PLATFORM_ICONS[id];
  if (!Icon) return null;
  return <Icon size={size} />;
}
