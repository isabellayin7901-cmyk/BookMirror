/**
 * 全量国家/地区电话区号。dial 形如 "+86"。
 * name_zh / name_en 用于按当前语言显示，flag 为 emoji 国旗。
 * 用于手机号注册时选择国号。
 */
export interface CountryCode {
  iso: string;     // ISO 3166-1 alpha-2
  dial: string;    // "+86"
  name_zh: string;
  name_en: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { iso: 'CN', dial: '+86', name_zh: '中国', name_en: 'China', flag: '🇨🇳' },
  { iso: 'HK', dial: '+852', name_zh: '中国香港', name_en: 'Hong Kong', flag: '🇭🇰' },
  { iso: 'MO', dial: '+853', name_zh: '中国澳门', name_en: 'Macao', flag: '🇲🇴' },
  { iso: 'TW', dial: '+886', name_zh: '中国台湾', name_en: 'Taiwan', flag: '🇹🇼' },
  { iso: 'US', dial: '+1', name_zh: '美国', name_en: 'United States', flag: '🇺🇸' },
  { iso: 'CA', dial: '+1', name_zh: '加拿大', name_en: 'Canada', flag: '🇨🇦' },
  { iso: 'GB', dial: '+44', name_zh: '英国', name_en: 'United Kingdom', flag: '🇬🇧' },
  { iso: 'JP', dial: '+81', name_zh: '日本', name_en: 'Japan', flag: '🇯🇵' },
  { iso: 'KR', dial: '+82', name_zh: '韩国', name_en: 'South Korea', flag: '🇰🇷' },
  { iso: 'SG', dial: '+65', name_zh: '新加坡', name_en: 'Singapore', flag: '🇸🇬' },
  { iso: 'MY', dial: '+60', name_zh: '马来西亚', name_en: 'Malaysia', flag: '🇲🇾' },
  { iso: 'AU', dial: '+61', name_zh: '澳大利亚', name_en: 'Australia', flag: '🇦🇺' },
  { iso: 'NZ', dial: '+64', name_zh: '新西兰', name_en: 'New Zealand', flag: '🇳🇿' },
  { iso: 'DE', dial: '+49', name_zh: '德国', name_en: 'Germany', flag: '🇩🇪' },
  { iso: 'FR', dial: '+33', name_zh: '法国', name_en: 'France', flag: '🇫🇷' },
  { iso: 'IT', dial: '+39', name_zh: '意大利', name_en: 'Italy', flag: '🇮🇹' },
  { iso: 'ES', dial: '+34', name_zh: '西班牙', name_en: 'Spain', flag: '🇪🇸' },
  { iso: 'PT', dial: '+351', name_zh: '葡萄牙', name_en: 'Portugal', flag: '🇵🇹' },
  { iso: 'NL', dial: '+31', name_zh: '荷兰', name_en: 'Netherlands', flag: '🇳🇱' },
  { iso: 'BE', dial: '+32', name_zh: '比利时', name_en: 'Belgium', flag: '🇧🇪' },
  { iso: 'CH', dial: '+41', name_zh: '瑞士', name_en: 'Switzerland', flag: '🇨🇭' },
  { iso: 'AT', dial: '+43', name_zh: '奥地利', name_en: 'Austria', flag: '🇦🇹' },
  { iso: 'SE', dial: '+46', name_zh: '瑞典', name_en: 'Sweden', flag: '🇸🇪' },
  { iso: 'NO', dial: '+47', name_zh: '挪威', name_en: 'Norway', flag: '🇳🇴' },
  { iso: 'DK', dial: '+45', name_zh: '丹麦', name_en: 'Denmark', flag: '🇩🇰' },
  { iso: 'FI', dial: '+358', name_zh: '芬兰', name_en: 'Finland', flag: '🇫🇮' },
  { iso: 'IS', dial: '+354', name_zh: '冰岛', name_en: 'Iceland', flag: '🇮🇸' },
  { iso: 'IE', dial: '+353', name_zh: '爱尔兰', name_en: 'Ireland', flag: '🇮🇪' },
  { iso: 'PL', dial: '+48', name_zh: '波兰', name_en: 'Poland', flag: '🇵🇱' },
  { iso: 'CZ', dial: '+420', name_zh: '捷克', name_en: 'Czechia', flag: '🇨🇿' },
  { iso: 'SK', dial: '+421', name_zh: '斯洛伐克', name_en: 'Slovakia', flag: '🇸🇰' },
  { iso: 'HU', dial: '+36', name_zh: '匈牙利', name_en: 'Hungary', flag: '🇭🇺' },
  { iso: 'RO', dial: '+40', name_zh: '罗马尼亚', name_en: 'Romania', flag: '🇷🇴' },
  { iso: 'BG', dial: '+359', name_zh: '保加利亚', name_en: 'Bulgaria', flag: '🇧🇬' },
  { iso: 'GR', dial: '+30', name_zh: '希腊', name_en: 'Greece', flag: '🇬🇷' },
  { iso: 'HR', dial: '+385', name_zh: '克罗地亚', name_en: 'Croatia', flag: '🇭🇷' },
  { iso: 'RS', dial: '+381', name_zh: '塞尔维亚', name_en: 'Serbia', flag: '🇷🇸' },
  { iso: 'SI', dial: '+386', name_zh: '斯洛文尼亚', name_en: 'Slovenia', flag: '🇸🇮' },
  { iso: 'UA', dial: '+380', name_zh: '乌克兰', name_en: 'Ukraine', flag: '🇺🇦' },
  { iso: 'RU', dial: '+7', name_zh: '俄罗斯', name_en: 'Russia', flag: '🇷🇺' },
  { iso: 'KZ', dial: '+7', name_zh: '哈萨克斯坦', name_en: 'Kazakhstan', flag: '🇰🇿' },
  { iso: 'TR', dial: '+90', name_zh: '土耳其', name_en: 'Turkey', flag: '🇹🇷' },
  { iso: 'IN', dial: '+91', name_zh: '印度', name_en: 'India', flag: '🇮🇳' },
  { iso: 'PK', dial: '+92', name_zh: '巴基斯坦', name_en: 'Pakistan', flag: '🇵🇰' },
  { iso: 'BD', dial: '+880', name_zh: '孟加拉国', name_en: 'Bangladesh', flag: '🇧🇩' },
  { iso: 'LK', dial: '+94', name_zh: '斯里兰卡', name_en: 'Sri Lanka', flag: '🇱🇰' },
  { iso: 'NP', dial: '+977', name_zh: '尼泊尔', name_en: 'Nepal', flag: '🇳🇵' },
  { iso: 'TH', dial: '+66', name_zh: '泰国', name_en: 'Thailand', flag: '🇹🇭' },
  { iso: 'VN', dial: '+84', name_zh: '越南', name_en: 'Vietnam', flag: '🇻🇳' },
  { iso: 'PH', dial: '+63', name_zh: '菲律宾', name_en: 'Philippines', flag: '🇵🇭' },
  { iso: 'ID', dial: '+62', name_zh: '印度尼西亚', name_en: 'Indonesia', flag: '🇮🇩' },
  { iso: 'KH', dial: '+855', name_zh: '柬埔寨', name_en: 'Cambodia', flag: '🇰🇭' },
  { iso: 'LA', dial: '+856', name_zh: '老挝', name_en: 'Laos', flag: '🇱🇦' },
  { iso: 'MM', dial: '+95', name_zh: '缅甸', name_en: 'Myanmar', flag: '🇲🇲' },
  { iso: 'BN', dial: '+673', name_zh: '文莱', name_en: 'Brunei', flag: '🇧🇳' },
  { iso: 'MN', dial: '+976', name_zh: '蒙古', name_en: 'Mongolia', flag: '🇲🇳' },
  { iso: 'AE', dial: '+971', name_zh: '阿联酋', name_en: 'United Arab Emirates', flag: '🇦🇪' },
  { iso: 'SA', dial: '+966', name_zh: '沙特阿拉伯', name_en: 'Saudi Arabia', flag: '🇸🇦' },
  { iso: 'QA', dial: '+974', name_zh: '卡塔尔', name_en: 'Qatar', flag: '🇶🇦' },
  { iso: 'KW', dial: '+965', name_zh: '科威特', name_en: 'Kuwait', flag: '🇰🇼' },
  { iso: 'BH', dial: '+973', name_zh: '巴林', name_en: 'Bahrain', flag: '🇧🇭' },
  { iso: 'OM', dial: '+968', name_zh: '阿曼', name_en: 'Oman', flag: '🇴🇲' },
  { iso: 'JO', dial: '+962', name_zh: '约旦', name_en: 'Jordan', flag: '🇯🇴' },
  { iso: 'LB', dial: '+961', name_zh: '黎巴嫩', name_en: 'Lebanon', flag: '🇱🇧' },
  { iso: 'IL', dial: '+972', name_zh: '以色列', name_en: 'Israel', flag: '🇮🇱' },
  { iso: 'IR', dial: '+98', name_zh: '伊朗', name_en: 'Iran', flag: '🇮🇷' },
  { iso: 'IQ', dial: '+964', name_zh: '伊拉克', name_en: 'Iraq', flag: '🇮🇶' },
  { iso: 'EG', dial: '+20', name_zh: '埃及', name_en: 'Egypt', flag: '🇪🇬' },
  { iso: 'ZA', dial: '+27', name_zh: '南非', name_en: 'South Africa', flag: '🇿🇦' },
  { iso: 'NG', dial: '+234', name_zh: '尼日利亚', name_en: 'Nigeria', flag: '🇳🇬' },
  { iso: 'KE', dial: '+254', name_zh: '肯尼亚', name_en: 'Kenya', flag: '🇰🇪' },
  { iso: 'GH', dial: '+233', name_zh: '加纳', name_en: 'Ghana', flag: '🇬🇭' },
  { iso: 'ET', dial: '+251', name_zh: '埃塞俄比亚', name_en: 'Ethiopia', flag: '🇪🇹' },
  { iso: 'TZ', dial: '+255', name_zh: '坦桑尼亚', name_en: 'Tanzania', flag: '🇹🇿' },
  { iso: 'UG', dial: '+256', name_zh: '乌干达', name_en: 'Uganda', flag: '🇺🇬' },
  { iso: 'MA', dial: '+212', name_zh: '摩洛哥', name_en: 'Morocco', flag: '🇲🇦' },
  { iso: 'DZ', dial: '+213', name_zh: '阿尔及利亚', name_en: 'Algeria', flag: '🇩🇿' },
  { iso: 'TN', dial: '+216', name_zh: '突尼斯', name_en: 'Tunisia', flag: '🇹🇳' },
  { iso: 'BR', dial: '+55', name_zh: '巴西', name_en: 'Brazil', flag: '🇧🇷' },
  { iso: 'MX', dial: '+52', name_zh: '墨西哥', name_en: 'Mexico', flag: '🇲🇽' },
  { iso: 'AR', dial: '+54', name_zh: '阿根廷', name_en: 'Argentina', flag: '🇦🇷' },
  { iso: 'CL', dial: '+56', name_zh: '智利', name_en: 'Chile', flag: '🇨🇱' },
  { iso: 'CO', dial: '+57', name_zh: '哥伦比亚', name_en: 'Colombia', flag: '🇨🇴' },
  { iso: 'PE', dial: '+51', name_zh: '秘鲁', name_en: 'Peru', flag: '🇵🇪' },
  { iso: 'VE', dial: '+58', name_zh: '委内瑞拉', name_en: 'Venezuela', flag: '🇻🇪' },
  { iso: 'EC', dial: '+593', name_zh: '厄瓜多尔', name_en: 'Ecuador', flag: '🇪🇨' },
  { iso: 'BO', dial: '+591', name_zh: '玻利维亚', name_en: 'Bolivia', flag: '🇧🇴' },
  { iso: 'PY', dial: '+595', name_zh: '巴拉圭', name_en: 'Paraguay', flag: '🇵🇾' },
  { iso: 'UY', dial: '+598', name_zh: '乌拉圭', name_en: 'Uruguay', flag: '🇺🇾' },
  { iso: 'CR', dial: '+506', name_zh: '哥斯达黎加', name_en: 'Costa Rica', flag: '🇨🇷' },
  { iso: 'PA', dial: '+507', name_zh: '巴拿马', name_en: 'Panama', flag: '🇵🇦' },
  { iso: 'GT', dial: '+502', name_zh: '危地马拉', name_en: 'Guatemala', flag: '🇬🇹' },
  { iso: 'CU', dial: '+53', name_zh: '古巴', name_en: 'Cuba', flag: '🇨🇺' },
  { iso: 'DO', dial: '+1809', name_zh: '多米尼加', name_en: 'Dominican Republic', flag: '🇩🇴' },
  { iso: 'LU', dial: '+352', name_zh: '卢森堡', name_en: 'Luxembourg', flag: '🇱🇺' },
  { iso: 'MT', dial: '+356', name_zh: '马耳他', name_en: 'Malta', flag: '🇲🇹' },
  { iso: 'CY', dial: '+357', name_zh: '塞浦路斯', name_en: 'Cyprus', flag: '🇨🇾' },
  { iso: 'EE', dial: '+372', name_zh: '爱沙尼亚', name_en: 'Estonia', flag: '🇪🇪' },
  { iso: 'LV', dial: '+371', name_zh: '拉脱维亚', name_en: 'Latvia', flag: '🇱🇻' },
  { iso: 'LT', dial: '+370', name_zh: '立陶宛', name_en: 'Lithuania', flag: '🇱🇹' },
  { iso: 'BY', dial: '+375', name_zh: '白俄罗斯', name_en: 'Belarus', flag: '🇧🇾' },
  { iso: 'GE', dial: '+995', name_zh: '格鲁吉亚', name_en: 'Georgia', flag: '🇬🇪' },
  { iso: 'AM', dial: '+374', name_zh: '亚美尼亚', name_en: 'Armenia', flag: '🇦🇲' },
  { iso: 'AZ', dial: '+994', name_zh: '阿塞拜疆', name_en: 'Azerbaijan', flag: '🇦🇿' },
  { iso: 'UZ', dial: '+998', name_zh: '乌兹别克斯坦', name_en: 'Uzbekistan', flag: '🇺🇿' },
  { iso: 'KG', dial: '+996', name_zh: '吉尔吉斯斯坦', name_en: 'Kyrgyzstan', flag: '🇰🇬' },
  { iso: 'TJ', dial: '+992', name_zh: '塔吉克斯坦', name_en: 'Tajikistan', flag: '🇹🇯' },
  { iso: 'TM', dial: '+993', name_zh: '土库曼斯坦', name_en: 'Turkmenistan', flag: '🇹🇲' },
  { iso: 'AF', dial: '+93', name_zh: '阿富汗', name_en: 'Afghanistan', flag: '🇦🇫' },
  { iso: 'MV', dial: '+960', name_zh: '马尔代夫', name_en: 'Maldives', flag: '🇲🇻' },
  { iso: 'FJ', dial: '+679', name_zh: '斐济', name_en: 'Fiji', flag: '🇫🇯' },
  { iso: 'PG', dial: '+675', name_zh: '巴布亚新几内亚', name_en: 'Papua New Guinea', flag: '🇵🇬' },
];

/** 默认国号：中国 +86。 */
export const DEFAULT_COUNTRY = COUNTRY_CODES[0];

/** 按关键词（中英文名 / 区号 / iso）过滤。 */
export function filterCountries(query: string): CountryCode[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRY_CODES;
  return COUNTRY_CODES.filter(
    (c) =>
      c.name_zh.includes(q) ||
      c.name_en.toLowerCase().includes(q) ||
      c.dial.includes(q) ||
      c.iso.toLowerCase().includes(q),
  );
}
