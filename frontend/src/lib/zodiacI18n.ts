import type { Language } from '../types';

/**
 * 星座 / 元素 / 行星名是「语言无关的数据」，后端统一存中文（如「天秤座」「风」）。
 * 这里按界面语言做展示层翻译：英文界面显示英文，中文界面原样返回。
 */

// 星座中文核心名 → 英文（兼容带或不带「座」字）
const SIGN_EN: Record<string, string> = {
  白羊: 'Aries', 金牛: 'Taurus', 双子: 'Gemini', 巨蟹: 'Cancer',
  狮子: 'Leo', 处女: 'Virgo', 天秤: 'Libra', 天蝎: 'Scorpio',
  射手: 'Sagittarius', 摩羯: 'Capricorn', 水瓶: 'Aquarius', 双鱼: 'Pisces',
};

// 四元素中文 → 英文
const ELEMENT_EN: Record<string, string> = {
  火: 'Fire', 土: 'Earth', 风: 'Air', 水: 'Water',
};

// 行星单字标签（NatalChart 里的 sym.label）→ 英文
const PLANET_EN: Record<string, string> = {
  日: 'Sun', 月: 'Moon', 水: 'Mercury', 金: 'Venus',
  火: 'Mars', 木: 'Jupiter', 土: 'Saturn', 升: 'Asc',
};

/** 星座名：英文界面译成英文，中文界面原样（「天秤座」/「天秤」都能识别） */
export function signName(sign: string | undefined | null, lang: Language): string {
  if (!sign) return '';
  if (lang !== 'en') return sign;
  const core = sign.replace(/座$/, '');
  return SIGN_EN[core] ?? sign;
}

/** 元素名：英文界面 Fire/Earth/Air/Water，中文界面原样 */
export function elementName(element: string | undefined | null, lang: Language): string {
  if (!element) return '';
  if (lang !== 'en') return element;
  return ELEMENT_EN[element] ?? element;
}

/** 行星表标签：中文「日星/月星…」，英文「Sun/Moon…」。入参是单字 label。 */
export function planetLabel(label: string, lang: Language): string {
  if (lang !== 'en') return `${label}星`;
  return PLANET_EN[label] ?? label;
}
