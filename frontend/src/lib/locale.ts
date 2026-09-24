/**
 * 读手机系统的语言与地区。不依赖额外原生模块（改动可以走 OTA 下发）：
 *  - iOS：读系统偏好（AppleLanguages / AppleLocale），不受 App 自身声明的本地化影响
 *  - Android：Hermes 内置 Intl 返回系统默认 locale
 */
import { Platform, Settings } from 'react-native';
import type { Language } from '../types';

function systemLocaleTag(): string {
  if (Platform.OS === 'ios') {
    try {
      const langs = Settings.get('AppleLanguages') as string[] | undefined;
      if (Array.isArray(langs) && langs[0]) return String(langs[0]);
    } catch { /* fall through */ }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || '';
  } catch {
    return '';
  }
}

/** 系统语言映射到 App 支持的界面语言：中文系（zh-*）→ zh，其它一律 en。 */
export function systemLanguage(): Language {
  return /^zh\b/i.test(systemLocaleTag()) ? 'zh' : 'en';
}

/** 系统设置里的地区（两位国家码），拿不到返回 null。只作为 IP 判断失败时的兜底。 */
export function systemRegion(): string | null {
  const candidates: string[] = [];
  if (Platform.OS === 'ios') {
    try {
      const loc = Settings.get('AppleLocale');
      if (loc) candidates.push(String(loc)); // 如 zh_CN、en_US
    } catch { /* ignore */ }
  }
  candidates.push(systemLocaleTag());
  for (const tag of candidates) {
    // 取最后一个两位大写子标签：zh-Hans-CN → CN，en_US → US
    const parts = tag.split(/[-_@]/).filter((p) => /^[A-Z]{2}$/.test(p));
    if (parts.length) return parts[parts.length - 1];
  }
  return null;
}
