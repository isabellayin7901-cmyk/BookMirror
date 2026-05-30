/**
 * BookMirror 视觉系统
 * 风格：莫兰迪色 + 铅笔手绘感
 * 灵感：温柔、慢节奏、像一本旧绘本
 */

export const colors = {
  // 背景层
  bg: '#F5EFE6',          // 暖奶油
  bgSoft: '#EFE7DA',      // 比 bg 深一点，用于卡片对比
  surface: '#FFFBF4',     // 卡片白（带一丢丢奶黄）

  // 主色 — 莫兰迪暖灰棕
  primary: '#7A6B5D',     // 旧木头色
  primarySoft: '#A89888',

  // 莫兰迪辅色（用于标签、点缀）
  rose: '#D4A5A5',        // 干玫瑰
  sage: '#A8B89B',        // 鼠尾草
  sky: '#A8B8C8',         // 雾霾蓝
  lavender: '#C4B5C5',    // 淡紫
  butter: '#E8C893',      // 黄油色
  terracotta: '#C9846B',  // 陶土

  // 文字
  text: '#3D362E',        // 墨色（不是纯黑）
  textMuted: '#8E8478',
  textFaint: '#B8AFA2',

  // 边框 & 阴影
  border: '#E4DACA',
  borderDashed: '#C9B998',  // 用于描边像铅笔轮廓
  shadow: 'rgba(122, 107, 93, 0.08)',

  // 状态
  success: '#8FA582',
  danger: '#B8624C',

  // 兔子/猫咪填充
  bunnyBody: '#F3E6D7',
  bunnyEar: '#E8D5BD',
  bunnyBlush: '#E8B5A8',
  catBody: '#D4C5B0',
  catShadow: '#A89888',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,    // 卡片普遍用大圆角，更软
  xl: 32,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 30, fontWeight: '700' as const, color: colors.text, letterSpacing: 0.3 },
  h2: { fontSize: 22, fontWeight: '600' as const, color: colors.text, letterSpacing: 0.3 },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 25 },
  caption: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  cute: { fontSize: 13, color: colors.terracotta, fontWeight: '600' as const, letterSpacing: 0.5 },
};

export const shadow = {
  // 软软的阴影，像水彩晕染
  soft: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
};
