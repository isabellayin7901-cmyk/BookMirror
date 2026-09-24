/**
 * 用户所在地区：决定展示哪些购书 / 阅读平台（见 platformLinks 的 availableIn）。
 *
 * 判断顺序：
 *  1. 用户在设置里手动选的地区（纠正 IP 误判，例如开着代理）
 *  2. 服务器按请求 IP 判断（/api/geo 读 CDN 边缘算好的国家头，不把 IP 发给第三方），缓存 1 天
 *  3. 手机系统设置里的地区（兜底，并在界面上注明是"按系统地区推断"）
 */
import { useEffect, useState } from 'react';
import { fetchGeo } from './api';
import { storage } from './storage';
import { systemRegion } from './locale';
import type { RegionInfo } from '../types';

const CACHE_MS = 24 * 60 * 60 * 1000;

export async function getRegion(force = false): Promise<RegionInfo> {
  const s = await storage.getSettings();
  if (s.regionOverride) return { country: s.regionOverride, source: 'manual' };

  if (!force) {
    const c = await storage.getRegionCache();
    if (c && c.source === 'ip' && Date.now() - c.at < CACHE_MS) {
      return { country: c.country, source: 'ip' };
    }
  }
  const geo = await fetchGeo();
  if (geo?.country) {
    await storage.setRegionCache({ country: geo.country, source: 'ip', at: Date.now() });
    return { country: geo.country, source: 'ip' };
  }
  return { country: systemRegion(), source: 'device' };
}

/** 组件里用：返回当前地区（加载中为 null）。设置页改了地区后 bump 一下 key 即可刷新。 */
export function useRegion(key?: unknown): RegionInfo | null {
  const [region, setRegion] = useState<RegionInfo | null>(null);
  useEffect(() => {
    let alive = true;
    getRegion().then((r) => { if (alive) setRegion(r); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return region;
}

/** 设置页「所在地区」可选项（地区名走 i18n：region.XX） */
export const REGION_CHOICES = ['CN', 'HK', 'MO', 'TW', 'US', 'GB', 'CA', 'AU', 'JP', 'DE', 'FR', 'SG'] as const;

/** 地区显示名：有翻译用翻译，否则直接显示国家码 */
export function regionName(country: string, t: (key: string) => string): string {
  const key = `region.${country}`;
  const name = t(key);
  return name === key ? country : name;
}
