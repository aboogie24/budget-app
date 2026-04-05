// app/(tabs)/calendar.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';

// ── Types ──

type EventItem = {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  source: 'budget' | 'transaction' | 'bill';
  frequency?: string;
  note?: string;
  category?: string;
  billStatus?: string;
  isAutoPay?: boolean;
};

type DayEvents = Record<string, EventItem[]>;

// ── Constants ──

const INCOME_COLOR = '#34d399';
const EXPENSE_COLOR = '#f87171';
const BILL_COLOR = '#60a5fa';
const ACCENT = '#a855f7';
const PINK = '#ec4899';
const TEXT_PRIMARY = '#f8fafc';
const TEXT_MUTED = '#94a3b8';
const TEXT_DIM = 'rgba(255,255,255,0.3)';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.08)';

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Helpers ──

const formatCurrency = (v: number) =>
  '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toKeyYMD = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const parseCalDate = (raw: string): Date => new Date(raw.slice(0, 10) + 'T12:00:00');

const dateLabel = (s: string) => {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const shortDate = (s: string) => {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

const getWeekDates = (date: Date): Date[] => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

// ── Icon helper ──

const getEventIcon = (item: EventItem): string => {
  if (item.source === 'bill') return 'receipt-outline';
  if (item.type === 'income') return 'trending-up-outline';
  if (item.source === 'budget') return 'wallet-outline';
  return 'cart-outline';
};

const getEventIconColor = (item: EventItem): string => {
  if (item.source === 'bill') return BILL_COLOR;
  if (item.type === 'income') return INCOME_COLOR;
  return ACCENT;
};

const getEventAmountColor = (item: EventItem): string => {
  if (item.source === 'bill') return BILL_COLOR;
  if (item.type === 'income') return INCOME_COLOR;
  return EXPENSE_COLOR;
};

// ── Dot colors for calendar indicators ──

const getDotsForDay = (events: EventItem[]): string[] => {
  if (!events || events.length === 0) return [];
  const dots: string[] = [];
  const hasBill = events.some(e => e.source === 'bill');
  const hasIncome = events.some(e => e.type === 'income');
  const hasExpense = events.some(e => e.type === 'expense' && e.source !== 'bill');
  if (hasBill) dots.push(BILL_COLOR);
  if (hasIncome) dots.push(INCOME_COLOR);
  if (hasExpense && !hasBill) dots.push(ACCENT);
  if (dots.length === 0 && events.length > 0) dots.push(ACCENT);
  return dots;
};

// ── Status Chip ──

const StatusChip = ({ status, isAutoPay }: { status?: string; isAutoPay?: boolean }) => {
  if (!status) return null;
  const colorMap: Record<string, { bg: string; text: string; label: string }> = {
    paid: { bg: 'rgba(52,211,153,0.12)', text: INCOME_COLOR, label: 'Paid' },
    overdue: { bg: 'rgba(248,113,113,0.12)', text: EXPENSE_COLOR, label: 'Overdue' },
    due: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', label: 'Due' },
  };
  const c = colorMap[status] || colorMap.due;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ backgroundColor: c.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: c.text }}>{c.label}</Text>
      </View>
      {isAutoPay && (
        <View style={{
          backgroundColor: 'rgba(168,85,247,0.12)',
          paddingHorizontal: 5,
          paddingVertical: 2,
          borderRadius: 4,
        }}>
          <Text style={{ fontSize: 8, fontWeight: '700', color: ACCENT, letterSpacing: 0.3 }}>AUTO</Text>
        </View>
      )}
    </View>
  );
};

// ── Event Row ──

const EventRow = ({ item, dateBadge }: { item: EventItem; dateBadge?: string }) => {
  const isIncome = item.type === 'income';
  const isBill = item.source === 'bill';
  const iconColor = getEventIconColor(item);
  const amountColor = getEventAmountColor(item);
  const iconName = getEventIcon(item);
  const sourceLabel = isBill ? 'Bill' : item.source === 'budget' ? 'Budget' : 'Transaction';

  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={iconName as any} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
          {isBill && <StatusChip status={item.billStatus} isAutoPay={item.isAutoPay} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT }} />
          <Text style={{ fontSize: 10, color: TEXT_MUTED }}>
            {sourceLabel}
            {item.frequency ? ` \u00B7 ${item.frequency}` : ''}
            {dateBadge ? ` \u00B7 ${dateBadge}` : item.note ? ` \u00B7 ${item.note}` : ''}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: amountColor, flexShrink: 0 }}>
        {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
      </Text>
    </View>
  );
};

// ── Main Screen ──

export default function CalendarScreen() {
  const today = useMemo(() => toKey(new Date()), []);

  const [dayEvents, setDayEvents] = useState<DayEvents>({});
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState(today);
  const [expanded, setExpanded] = useState(false);

  // ── Data loading ──

  const loadData = useCallback(async () => {
    const userId = await api.getUserId();
    if (!userId) return;
    setLoading(true);

    const monthStart = new Date(month.year, month.month, 1);
    const monthEnd = new Date(month.year, month.month + 1, 0);
    const ev: DayEvents = {};

    const addEntry = (date: Date, item: EventItem) => {
      const key = toKey(date);
      if (!ev[key]) ev[key] = [];
      ev[key].push(item);
    };

    const expandFrequency = (startDate: Date, freq: string, item: EventItem) => {
      const f = (freq || '').toLowerCase();
      if (f === 'weekly' || f === 'biweekly') {
        const step = f === 'weekly' ? 7 : 14;
        const cur = new Date(startDate);
        while (cur < monthStart) cur.setDate(cur.getDate() + step);
        while (cur <= monthEnd) { addEntry(new Date(cur), item); cur.setDate(cur.getDate() + step); }
      } else if (f === 'monthly') {
        const d = new Date(monthStart);
        d.setDate(startDate.getDate());
        if (d <= monthEnd) addEntry(d, item);
      } else if (f === '1st-15th') {
        const d1 = new Date(monthStart); d1.setDate(1); addEntry(d1, item);
        const d15 = new Date(monthStart); d15.setDate(15); addEntry(d15, item);
      } else {
        if (startDate >= monthStart && startDate <= monthEnd) addEntry(startDate, item);
      }
    };

    try {
      const [budgets, transactions, bills] = await Promise.all([
        api.get<any[]>(`/auth/budgets/user/${userId}`).catch(() => []),
        api.get<any[]>('/auth/transactions', { user_id: userId }).catch(() => []),
        api.get<any[]>('/auth/bills', { user_id: userId }).catch(() => []),
      ]);

      // Note: Budgets represent expected amounts, not calendar events.
      // Transactions and bills are the actual events shown on the calendar.
      // Income budgets (like "Cisco weekly") would create duplicate entries
      // alongside real income transactions, so we skip them.

      (Array.isArray(transactions) ? transactions : []).forEach((t) => {
        if (!t.date) return;
        const date = parseCalDate(t.date);
        if (isNaN(date.getTime())) return;
        expandFrequency(date, t.frequency || '', {
          id: t.id || t.note || 'tx',
          name: t.category_name || t.category || t.note || 'Transaction',
          amount: t.amount || 0,
          type: (t.type || '').toLowerCase() === 'income' ? 'income' : 'expense',
          source: 'transaction', frequency: t.frequency, note: t.note,
          category: t.category_name || t.category,
        });
      });

      (Array.isArray(bills) ? bills : []).forEach((bill) => {
        if (!bill.due_day) return;
        const billDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), bill.due_day);
        if (billDate > monthEnd) return;
        expandFrequency(billDate, bill.frequency || 'monthly', {
          id: bill.id || bill.name, name: bill.name || 'Bill', amount: bill.amount_due || 0,
          type: 'expense', source: 'bill', frequency: bill.frequency,
          note: bill.payee || undefined, category: bill.category_name,
          billStatus: bill.status, isAutoPay: !!bill.is_autopay,
        });
      });
    } catch (e) {
      console.error('Failed to load calendar data:', e);
    }

    setDayEvents(ev);
    setLoading(false);
  }, [month]);

  // Reload on tab focus and when month changes
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Derived state ──

  const weekDates = useMemo(() => getWeekDates(new Date(selected + 'T12:00:00')), [selected]);

  const selEvents = dayEvents[selected] || [];
  const selIncome = selEvents.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const selExpense = selEvents.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  const monthTotals = useMemo(() => {
    let inc = 0, exp = 0;
    // Only sum events that belong to the current month
    const prefix = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
    Object.entries(dayEvents).forEach(([key, evs]) => {
      if (key.startsWith(prefix)) {
        evs.forEach(e => {
          if (e.type === 'income') inc += e.amount; else exp += e.amount;
        });
      }
    });
    return { inc, exp, net: inc - exp };
  }, [dayEvents, month]);

  const upcoming = useMemo(() => {
    const items: { date: string; event: EventItem }[] = [];
    for (const date of Object.keys(dayEvents).sort()) {
      if (date <= today) continue;
      for (const event of dayEvents[date]) items.push({ date, event });
      if (items.length >= 6) break;
    }
    return items.slice(0, 6);
  }, [dayEvents, today]);

  // ── Full month grid cells ──

  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
    const firstDayOfWeek = new Date(month.year, month.month, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [month]);

  // ── Navigation ──

  const pick = (dateStr: string) => {
    setSelected(dateStr);
    const d = new Date(dateStr + 'T12:00:00');
    if (d.getMonth() !== month.month || d.getFullYear() !== month.year) {
      setMonth({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const shiftWeek = (dir: number) => {
    const d = new Date(selected + 'T12:00:00');
    d.setDate(d.getDate() + dir * 7);
    pick(toKey(d));
  };

  const shiftMonth = (dir: number) => {
    let m = month.month + dir;
    let y = month.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth({ year: y, month: m });
  };

  const goToday = () => {
    const t = new Date();
    setSelected(today);
    if (t.getMonth() !== month.month || t.getFullYear() !== month.year) {
      setMonth({ year: t.getFullYear(), month: t.getMonth() });
    }
  };

  const toggleExpand = () => setExpanded(!expanded);

  const monthLabel = `${MONTHS[month.month]} ${month.year}`;

  // ── Render ──

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {loading && <ActivityIndicator color={ACCENT} size="small" />}
            {selected !== today && (
              <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.expandBtn} onPress={toggleExpand}>
              <Ionicons
                name={expanded ? 'contract-outline' : 'expand-outline'}
                size={16}
                color={ACCENT}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* ── Calendar View ── */}
          {expanded ? (
            /* Full Month Grid */
            <View style={styles.calCard}>
              {/* Month nav */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={18} color={ACCENT} />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY }}>{monthLabel}</Text>
                <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-forward" size={18} color={ACCENT} />
                </TouchableOpacity>
              </View>

              {/* Day headers */}
              <View style={styles.gridRow}>
                {DAY_NAMES.map((d, i) => (
                  <View key={i} style={styles.gridHeaderCell}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_MUTED }}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={styles.gridContainer}>
                {calendarCells.map((day, i) => {
                  if (day === null) {
                    return <View key={`empty-${i}`} style={styles.gridCell} />;
                  }
                  const key = toKeyYMD(month.year, month.month, day);
                  const isToday = key === today;
                  const isSelected = key === selected;
                  const dots = getDotsForDay(dayEvents[key] || []);

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.gridCell,
                        isSelected && { backgroundColor: 'rgba(168,85,247,0.2)', borderRadius: 10 },
                      ]}
                      onPress={() => pick(key)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.gridDayCircle,
                        isSelected && { backgroundColor: ACCENT },
                        isToday && !isSelected && { borderWidth: 1.5, borderColor: ACCENT },
                      ]}>
                        <Text style={{
                          fontSize: 14,
                          fontWeight: isSelected || isToday ? '700' : '500',
                          color: isSelected ? '#fff' : isToday ? ACCENT : TEXT_PRIMARY,
                        }}>{day}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: 3, height: 5 }}>
                        {dots.slice(0, 3).map((c, j) => (
                          <View key={j} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                {[
                  { color: BILL_COLOR, label: 'Bills' },
                  { color: INCOME_COLOR, label: 'Income' },
                  { color: PINK, label: 'Partner' },
                ].map((l, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.color }} />
                    <Text style={{ fontSize: 10, color: TEXT_MUTED }}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            /* Compact Week Strip */
            <View style={styles.calCard}>
              <View style={styles.weekNav}>
                <TouchableOpacity onPress={() => shiftWeek(-1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={16} color={ACCENT} />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleExpand}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY }}>{monthLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => shiftWeek(1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-forward" size={16} color={ACCENT} />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {weekDates.map((d, i) => {
                  const k = toKey(d);
                  const isSel = k === selected;
                  const isTod = k === today;
                  const dots = getDotsForDay(dayEvents[k] || []);
                  return (
                    <TouchableOpacity key={k} style={styles.dayCell} onPress={() => pick(k)} activeOpacity={0.7}>
                      <Text style={[
                        styles.dayName,
                        isTod && !isSel && { color: ACCENT },
                      ]}>{DAY_NAMES[i]}</Text>
                      <View style={[
                        styles.dayCircle,
                        isSel && styles.dayCircleSel,
                        isTod && !isSel && styles.dayCircleToday,
                      ]}>
                        <Text style={[
                          styles.dayNum,
                          isSel && { color: '#fff' },
                          isTod && !isSel && { color: ACCENT },
                        ]}>{d.getDate()}</Text>
                      </View>
                      <View style={styles.dotRow}>
                        {dots.slice(0, 3).map((c, j) => (
                          <View key={j} style={[styles.dot, { backgroundColor: c }]} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Monthly Summary Bar ── */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryCol}>
              <View style={[styles.legendDot, { backgroundColor: INCOME_COLOR }]} />
              <Text style={[styles.summaryAmt, { color: INCOME_COLOR }]}>+{formatCurrency(monthTotals.inc)}</Text>
            </View>
            <View style={styles.summaryDiv} />
            <View style={styles.summaryCol}>
              <View style={[styles.legendDot, { backgroundColor: EXPENSE_COLOR }]} />
              <Text style={[styles.summaryAmt, { color: EXPENSE_COLOR }]}>-{formatCurrency(monthTotals.exp)}</Text>
            </View>
            <View style={styles.summaryDiv} />
            <View style={styles.summaryCol}>
              <Text style={styles.netLabel}>Net</Text>
              <Text style={[styles.summaryAmt, { color: monthTotals.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                {monthTotals.net >= 0 ? '+' : ''}{formatCurrency(monthTotals.net)}
              </Text>
            </View>
          </View>

          {/* ── Day Detail Section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{dateLabel(selected)}</Text>

            {selEvents.length === 0 ? (
              <View style={styles.emptyDay}>
                <Ionicons name="sunny-outline" size={18} color={TEXT_DIM} />
                <Text style={styles.emptyText}>Nothing scheduled</Text>
              </View>
            ) : (
              <>
                {/* Day income/expense chips */}
                {(selIncome > 0 || selExpense > 0) && (
                  <View style={styles.dayChips}>
                    {selIncome > 0 && (
                      <View style={[styles.chip, {
                        backgroundColor: 'rgba(52,211,153,0.1)',
                        borderColor: 'rgba(52,211,153,0.15)',
                      }]}>
                        <Ionicons name="trending-up-outline" size={11} color={INCOME_COLOR} />
                        <Text style={[styles.chipText, { color: INCOME_COLOR }]}>+{formatCurrency(selIncome)}</Text>
                      </View>
                    )}
                    {selExpense > 0 && (
                      <View style={[styles.chip, {
                        backgroundColor: 'rgba(248,113,113,0.1)',
                        borderColor: 'rgba(248,113,113,0.15)',
                      }]}>
                        <Ionicons name="trending-down-outline" size={11} color={EXPENSE_COLOR} />
                        <Text style={[styles.chipText, { color: EXPENSE_COLOR }]}>-{formatCurrency(selExpense)}</Text>
                      </View>
                    )}
                  </View>
                )}
                {selEvents.map((item, idx) => (
                  <EventRow key={`${item.id}-${idx}`} item={item} />
                ))}
              </>
            )}
          </View>

          {/* ── Upcoming Section ── */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="time-outline" size={14} color={ACCENT} />
                <Text style={styles.sectionTitle}>Upcoming</Text>
              </View>
              {upcoming.map(({ date, event }, idx) => (
                <EventRow key={`up-${idx}`} item={event} dateBadge={shortDate(date)} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: '800' },
  todayBtn: {
    backgroundColor: 'rgba(192,132,252,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
  },
  todayBtnText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  expandBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shared calendar card
  calCard: {
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Full month grid
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  gridHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '14.28%' as any,
    alignItems: 'center',
    paddingVertical: 6,
  },
  gridDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  // Week strip (compact)
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', gap: 4 },
  dayName: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSel: { backgroundColor: ACCENT },
  dayCircleToday: { borderWidth: 1.5, borderColor: ACCENT },
  dayNum: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, height: 5, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  // Monthly summary bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryAmt: { fontSize: 12, fontWeight: '700' },
  summaryDiv: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  netLabel: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600' },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800', marginBottom: 2 },

  // Day detail
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  emptyText: { color: TEXT_DIM, fontSize: 13, fontWeight: '600' },
  dayChips: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '700' },

  // Event row
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventName: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
