import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../theme';
import { useI18n } from '../lib/LanguageContext';
import type { CheckinDay } from '../lib/storage';

interface Props {
  log: CheckinDay[];
}

const MONTHS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** 跟着用户手机当前时间的迷你月历，签到日有色块。 */
export function CheckinCalendar({ log }: Props) {
  const { t, lang } = useI18n();
  const months = lang === 'en' ? MONTHS_EN : MONTHS_ZH;
  const weekdays = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_ZH;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  const firstDay = new Date(year, month, 1);
  const lastDayNum = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstDay.getDay(); // 0=Sun

  // 用 Map 快速查每天的页数
  const pagesByDate = new Map<string, number>();
  for (const d of log) pagesByDate.set(d.date, d.pages);

  // 构建格子：先填月初前的空格，再填 1..lastDay
  type Cell = { day: number; pages: number; isToday: boolean } | null;
  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDayNum; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      pages: pagesByDate.get(ds) ?? 0,
      isToday: d === todayDate,
    });
  }
  // 补到 6 行（最多 42 格）保持高度稳定
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <Text style={styles.monthLabel}>{year} · {months[month]}</Text>

      {/* 星期表头 */}
      <View style={styles.row}>
        {weekdays.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      {/* 日期格子 */}
      <View style={styles.grid}>
        {cells.map((c, i) => {
          if (!c) return <View key={i} style={styles.cell} />;
          const hasCheck = c.pages > 0;
          return (
            <View key={i} style={styles.cell}>
              <View
                style={[
                  styles.bubble,
                  hasCheck && styles.bubbleChecked,
                  c.isToday && styles.bubbleToday,
                ]}
              >
                <Text
                  style={[
                    styles.cellText,
                    hasCheck && styles.cellTextChecked,
                    c.isToday && styles.cellTextToday,
                  ]}
                >
                  {c.day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* 图例 */}
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.sage }]} />
        <Text style={styles.legendText}>{t('cal.checked')}</Text>
        <View style={[styles.legendDot, { backgroundColor: colors.terracotta, marginLeft: spacing.md }]} />
        <Text style={styles.legendText}>{t('cal.today')}</Text>
      </View>
    </View>
  );
}

const CELL_SIZE = 32;

const styles = StyleSheet.create({
  monthLabel: {
    ...typography.h3,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: colors.textFaint,
    marginBottom: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleChecked: { backgroundColor: colors.sage },
  bubbleToday: {
    backgroundColor: colors.terracotta,
    borderWidth: 2,
    borderColor: colors.snowBlush,
  },
  cellText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  cellTextChecked: { color: '#fff', fontWeight: '700' },
  cellTextToday: { color: '#fff', fontWeight: '800' },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
});
