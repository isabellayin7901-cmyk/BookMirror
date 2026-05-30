import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../theme';
import { CHINA_PROVINCES, WORLD_COUNTRIES, type City, type Region } from '../data/locations';
import { useI18n } from '../lib/LanguageContext';

export interface SelectedLocation {
  region: string;      // 省份 / 国家
  city: City;          // 城市（含经纬度）
  scope: 'cn' | 'world';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (loc: SelectedLocation) => void;
}

export function LocationPicker({ visible, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [scope, setScope] = useState<'cn' | 'world'>('cn');
  const [region, setRegion] = useState<Region | null>(null);
  const [search, setSearch] = useState('');

  const list = scope === 'cn' ? CHINA_PROVINCES : WORLD_COUNTRIES;

  // 顶层（没选省/国）时如果在搜索，展平所有城市做模糊匹配
  // 例如打"广州"直接出现"广东 · 广州"；打"广"既出"广东"也出"广州"
  type FlatHit = { region: Region; city: City };

  const flatHits = useMemo<FlatHit[]>(() => {
    if (region || !search.trim()) return [];
    const s = search.trim();
    const hits: FlatHit[] = [];
    for (const r of list) {
      if (r.name.includes(s)) {
        for (const c of r.cities) hits.push({ region: r, city: c });
      } else {
        for (const c of r.cities) {
          if (c.name.includes(s)) hits.push({ region: r, city: c });
        }
      }
    }
    // 去重 + 限制数量
    const seen = new Set<string>();
    return hits.filter((h) => {
      const key = `${h.region.name}-${h.city.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
  }, [list, region, search]);

  const filteredRegions = useMemo(() => {
    if (search.trim()) return [];  // 搜索时不显示省份列表，只显示展平结果
    return list;
  }, [list, search]);

  const filteredCities = useMemo(() => {
    if (!region) return [];
    if (!search.trim()) return region.cities;
    const s = search.trim();
    return region.cities.filter((c) => c.name.includes(s));
  }, [region, search]);

  const close = () => {
    setRegion(null);
    setSearch('');
    onClose();
  };

  const pickCity = (city: City) => {
    onSelect({
      region: region!.name,
      city,
      scope,
    });
    setRegion(null);
    setSearch('');
  };

  return (
    <Modal transparent visible={visible} onRequestClose={close} animationType="slide">
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          {/* 顶部条 */}
          <View style={styles.header}>
            <Pressable onPress={close} hitSlop={12}>
              <Text style={styles.cancelText}>{t('loc.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>
              {region ? `${region.name} · ${t('loc.pickCity')}` : t('loc.pickLocation')}
            </Text>
            {region ? (
              <Pressable onPress={() => { setRegion(null); setSearch(''); }} hitSlop={12}>
                <Text style={styles.backText}>{t('loc.back')}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* 国内/国外 切换 */}
          {!region && (
            <View style={styles.scopeRow}>
              <Pressable
                onPress={() => { setScope('cn'); setSearch(''); }}
                style={[styles.scopeBtn, scope === 'cn' && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeText, scope === 'cn' && styles.scopeTextActive]}>
                  {t('loc.cn')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setScope('world'); setSearch(''); }}
                style={[styles.scopeBtn, scope === 'world' && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeText, scope === 'world' && styles.scopeTextActive]}>
                  {t('loc.world')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* 搜索框 —— 可以直接打省/市，自动匹配 */}
          <TextInput
            style={styles.searchInput}
            placeholder={
              region
                ? t('loc.searchCityIn', { region: region.name })
                : scope === 'cn'
                ? t('loc.searchCn')
                : t('loc.searchWorld')
            }
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
          />

          {/* 列表 */}
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* 1) 在某省份内 —— 显示该省份城市 */}
            {region && filteredCities.map((c) => (
              <Pressable
                key={c.name}
                onPress={() => pickCity(c)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowText}>{c.name}</Text>
                <Text style={styles.rowMeta}>
                  {c.latitude.toFixed(2)}°, {c.longitude.toFixed(2)}°
                </Text>
              </Pressable>
            ))}

            {/* 2) 顶层 + 有搜索词 —— 显示扁平的"省份 · 城市"结果 */}
            {!region && search.trim() && flatHits.map((h) => (
              <Pressable
                key={`${h.region.name}-${h.city.name}`}
                onPress={() => {
                  onSelect({ region: h.region.name, city: h.city, scope });
                  setRegion(null);
                  setSearch('');
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{h.city.name}</Text>
                  <Text style={styles.rowSub}>{h.region.name}</Text>
                </View>
                <Text style={styles.rowMeta}>
                  {h.city.latitude.toFixed(2)}°, {h.city.longitude.toFixed(2)}°
                </Text>
              </Pressable>
            ))}

            {/* 3) 顶层 + 无搜索词 —— 显示省/国列表 */}
            {!region && !search.trim() && filteredRegions.map((r) => (
              <Pressable
                key={r.name}
                onPress={() => { setRegion(r); setSearch(''); }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowText}>{r.name}</Text>
                <Text style={styles.rowArrow}>›</Text>
              </Pressable>
            ))}

            {/* 空提示 */}
            {((!region && search.trim() && flatHits.length === 0) ||
              (region && filteredCities.length === 0)) && (
              <Text style={styles.emptyHint}>
                {t('loc.notFound', { q: search.trim() })}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  cancelText: { color: colors.textMuted, fontSize: 14 },
  backText: { color: colors.terracotta, fontSize: 14, fontWeight: '600' },
  title: { ...typography.h3, fontSize: 16 },

  scopeRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    padding: 4,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  scopeBtnActive: { backgroundColor: colors.surface },
  scopeText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  scopeTextActive: { color: colors.primary },

  searchInput: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.bgSoft },
  rowText: { ...typography.body, fontSize: 15 },
  rowSub: { ...typography.caption, fontSize: 11, marginTop: 2, color: colors.textMuted },
  rowMeta: { ...typography.caption, fontSize: 11, color: colors.textFaint, marginLeft: 8 },
  rowArrow: { fontSize: 18, color: colors.textMuted },

  emptyHint: {
    ...typography.caption,
    textAlign: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
