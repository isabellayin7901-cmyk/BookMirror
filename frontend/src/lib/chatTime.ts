// 聊天消息时间分组：什么时候插时间分隔条、分隔条显示什么文案。
import type { Language } from '../types';

const GAP_MS = 5 * 60 * 1000; // 间隔超过 5 分钟就插一条时间分隔

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 时间分隔条文案：今天只显示时分；昨天显示「昨天 HH:MM」；今年显示月日；更早带年份。 */
export function formatDivider(iso: string | null | undefined, lang: Language): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) return hhmm(d);
  if (sameDay(d, yesterday)) return lang === 'en' ? `Yesterday ${hhmm(d)}` : `昨天 ${hhmm(d)}`;
  if (d.getFullYear() === now.getFullYear()) {
    return lang === 'en'
      ? `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${hhmm(d)}`
      : `${d.getMonth() + 1}月${d.getDate()}日 ${hhmm(d)}`;
  }
  return lang === 'en'
    ? `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${hhmm(d)}`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hhmm(d)}`;
}

/** 是否需要在这条消息前插时间分隔（首条，或与上一条间隔超过阈值）。 */
export function shouldShowDivider(prevIso: string | null | undefined, curIso: string | null | undefined): boolean {
  if (!curIso) return false;
  if (!prevIso) return true;
  const prev = new Date(prevIso).getTime();
  const cur = new Date(curIso).getTime();
  if (isNaN(prev) || isNaN(cur)) return true;
  return cur - prev > GAP_MS;
}
