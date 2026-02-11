// app/(tabs)/calendar.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';

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
};

type DayEvents = Record<string, EventItem[]>;

const INCOME_COLOR = '#34d399';
const EXPENSE_COLOR = '#f87171';
const BILL_COLOR = '#60a5fa';
const ACCENT = '#c084fc';
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const formatCurrency = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const toKey = (d: Date) => d.toISOString().slice(0, 10);

const dateLabel = (s: string) => {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const shortDate = (s: string) => {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

/* ── Event row (extracted to avoid re-mount) ── */
const EventRow = ({ item, dateBadge }: { item: EventItem; dateBadge?: string }) => {
  const isInc = item.type === 'income';
  const isBill = item.source === 'bill';
  const bg = isBill ? 'rgba(96,165,250,0.12)' : isInc ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.08)';
  const icon = isBill ? 'receipt-outline' : item.source === 'budget' ? 'wallet-outline' : isInc ? 'trending-up-outline' : 'cart-outline';
  const ic = isBill ? BILL_COLOR : isInc ? INCOME_COLOR : ACCENT;
  const ac = isBill ? BILL_COLOR : isInc ? INCOME_COLOR : EXPENSE_COLOR;

  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={ic} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
          {isBill && item.billStatus && (
            <View style={[styles.statusChip, {
              backgroundColor: item.billStatus === 'paid' ? 'rgba(52,211,153,0.12)'
                : item.billStatus === 'overdue' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
            }]}>
              <Text style={{
                fontSize: 9, fontWeight: '700',
                color: item.billStatus === 'paid' ? '#34d399' : item.billStatus === 'overdue' ? '#f87171' : '#fbbf24',
              }}>
                {item.billStatus === 'paid' ? 'Paid' : item.billStatus === 'overdue' ? 'Overdue' : 'Due'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.eventMeta} numberOfLines={1}>
          {isBill ? 'Bill' : item.source === 'budget' ? 'Budget' : 'Transaction'}
          {item.frequency ? ` · ${item.frequency}` : ''}
          {dateBadge ? ` · ${dateBadge}` : item.note ? ` · ${item.note}` : ''}
        </Text>
      </View>
      <Text style={[styles.eventAmt, { color: ac }]}>
        {isInc ? '+' : '-'}{formatCurrency(item.amount)}
      </Text>
    </View>
  );
};

export default function CalendarScreen() {
  const today = useMemo(() => toKey(new Date()), []);

  const [marks, setMarks] = useState<any>({});
  const [dayEvents, setDayEvents] = useState<DayEvents>({});
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(today); // auto-select today
  const [expanded, setExpanded] = useState(false);
  const [calKey, setCalKey] = useState(0);

  /* ── Data loading (logic preserved from original) ── */
  const loadData = useCallback(async () => {
    const userId = await api.getUserId();
    if (!userId) return;
    setLoading(true);

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const m: any = {};
    const ev: DayEvents = {};

    const addEntry = (date: Date, item: EventItem) => {
      const key = toKey(date);
      const color = item.source === 'bill' ? BILL_COLOR : item.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR;
      const dot = { key: `${item.id}-${key}`, color };
      if (m[key]) { m[key].dots.push(dot); }
      else { m[key] = { dots: [dot], marked: true }; }
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
        api.get<any[]>(`/budgets/user/${userId}`).catch(() => []),
        api.get<any[]>('/auth/transactions', { user_id: userId }).catch(() => []),
        api.get<any[]>('/auth/bills', { user_id: userId }).catch(() => []),
      ]);

      (Array.isArray(budgets) ? budgets : []).forEach((b) => {
        if (!b.start_date) return;
        const date = new Date(b.start_date);
        if (isNaN(date.getTime())) return;
        expandFrequency(date, b.frequency || '', {
          id: b.id || b.name, name: b.name || 'Budget', amount: b.amount || 0,
          type: (b.type || '').toLowerCase() === 'income' ? 'income' : 'expense',
          source: 'budget', frequency: b.frequency,
        });
      });

      (Array.isArray(transactions) ? transactions : []).forEach((t) => {
        if (!t.date) return;
        const date = new Date(t.date);
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
          note: bill.payee || undefined, category: bill.category_name, billStatus: bill.status,
        });
      });
    } catch (e) {
      console.error('Failed to load calendar data:', e);
    }

    setMarks(m);
    setDayEvents(ev);
    setLoading(false);
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Derived state ── */
  const weekDates = useMemo(() => getWeekDates(new Date(selected + 'T12:00:00')), [selected]);

  const selEvents = dayEvents[selected] || [];
  const selIncome = selEvents.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const selExpense = selEvents.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  const monthTotals = useMemo(() => {
    let inc = 0, exp = 0;
    Object.values(dayEvents).forEach(evs => evs.forEach(e => {
      if (e.type === 'income') inc += e.amount; else exp += e.amount;
    }));
    return { inc, exp, net: inc - exp };
  }, [dayEvents]);

  const upcoming = useMemo(() => {
    const items: { date: string; event: EventItem }[] = [];
    for (const date of Object.keys(dayEvents).sort()) {
      if (date <= today) continue;
      for (const event of dayEvents[date]) items.push({ date, event });
      if (items.length >= 7) break;
    }
    return items.slice(0, 7);
  }, [dayEvents, today]);

  const displayMarks = useMemo(() => {
    const copy = { ...marks };
    if (selected) {
      copy[selected] = {
        ...(copy[selected] || {}),
        selected: true,
        selectedColor: 'rgba(192,132,252,0.3)',
        dots: copy[selected]?.dots || [],
        marked: copy[selected]?.marked || false,
      };
    }
    return copy;
  }, [marks, selected]);

  /* ── Navigation ── */
  const pick = (dateStr: string) => {
    setSelected(dateStr);
    const d = new Date(dateStr + 'T12:00:00');
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const shiftWeek = (dir: number) => {
    const d = new Date(selected + 'T12:00:00');
    d.setDate(d.getDate() + dir * 7);
    pick(toKey(d));
  };

  const toggleExpand = () => {
    if (!expanded) setCalKey(k => k + 1);
    setExpanded(!expanded);
  };

  const goToday = () => {
    setSelected(today);
    const t = new Date();
    if (t.getMonth() !== month.getMonth() || t.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
      if (expanded) setCalKey(k => k + 1);
    }
  };

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {loading && <ActivityIndicator color={ACCENT} size="small" />}
            {selected !== today && (
              <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.expandBtn} onPress={toggleExpand}>
              <Ionicons name={expanded ? 'contract-outline' : 'expand-outline'} size={18} color={ACCENT} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* ── Calendar View ── */}
          {expanded ? (
            <Calendar
              key={calKey}
              style={styles.fullCal}
              current={toKey(month)}
              onMonthChange={(m) => setMonth(new Date(m.dateString))}
              onDayPress={(d) => pick(d.dateString)}
              markedDates={displayMarks}
              markingType="multi-dot"
              theme={{
                calendarBackground: 'rgba(255,255,255,0.06)',
                dayTextColor: '#f8fafc',
                textDisabledColor: 'rgba(255,255,255,0.2)',
                monthTextColor: '#f8fafc',
                textMonthFontWeight: '700',
                textMonthFontSize: 18,
                arrowColor: ACCENT,
                todayTextColor: ACCENT,
                textDayFontSize: 15,
                textDayFontWeight: '500',
                textDayHeaderFontSize: 12,
                textDayHeaderFontWeight: '600',
                textSectionTitleColor: '#94a3b8',
              }}
            />
          ) : (
            <View style={styles.weekCard}>
              <View style={styles.weekNav}>
                <TouchableOpacity onPress={() => shiftWeek(-1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={18} color={ACCENT} />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleExpand}>
                  <Text style={styles.monthLabel}>{monthLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => shiftWeek(1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-forward" size={18} color={ACCENT} />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {weekDates.map((d, i) => {
                  const k = toKey(d);
                  const isSel = k === selected;
                  const isTod = k === today;
                  const dots = marks[k]?.dots || [];
                  return (
                    <TouchableOpacity key={k} style={styles.dayCell} onPress={() => pick(k)} activeOpacity={0.7}>
                      <Text style={[styles.dayName, isTod && !isSel && { color: ACCENT }]}>{DAY_NAMES[i]}</Text>
                      <View style={[styles.dayCircle, isSel && styles.dayCircleSel, isTod && !isSel && styles.dayCircleToday]}>
                        <Text style={[styles.dayNum, isSel && { color: '#fff' }, isTod && !isSel && { color: ACCENT }]}>
                          {d.getDate()}
                        </Text>
                      </View>
                      <View style={styles.dotRow}>
                        {dots.slice(0, 3).map((dot: any, j: number) => (
                          <View key={j} style={[styles.dot, { backgroundColor: dot.color }]} />
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

          {/* ── Day Detail (inline — no modal) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{dateLabel(selected)}</Text>
            {selEvents.length === 0 ? (
              <View style={styles.emptyDay}>
                <Ionicons name="sunny-outline" size={24} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>Nothing scheduled</Text>
              </View>
            ) : (
              <>
                {(selIncome > 0 || selExpense > 0) && (
                  <View style={styles.dayChips}>
                    {selIncome > 0 && (
                      <View style={styles.chip}>
                        <Ionicons name="trending-up-outline" size={12} color={INCOME_COLOR} />
                        <Text style={[styles.chipText, { color: INCOME_COLOR }]}>+{formatCurrency(selIncome)}</Text>
                      </View>
                    )}
                    {selExpense > 0 && (
                      <View style={styles.chip}>
                        <Ionicons name="trending-down-outline" size={12} color={EXPENSE_COLOR} />
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

          {/* ── Upcoming ── */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="time-outline" size={16} color={ACCENT} />
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

const styles = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Full calendar (expanded) */
  fullCal: {
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  /* Week strip (compact default) */
  weekCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthLabel: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', gap: 4 },
  dayName: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSel: { backgroundColor: ACCENT },
  dayCircleToday: { borderWidth: 1.5, borderColor: ACCENT },
  dayNum: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  /* Monthly summary bar */
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryAmt: { fontSize: 13, fontWeight: '700' },
  summaryDiv: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  netLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },

  /* Sections */
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 0 },

  /* Day detail */
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
  dayChips: { flexDirection: 'row', gap: 10, marginBottom: 12, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  /* Event row */
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  eventIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventName: { color: '#f8fafc', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  eventMeta: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  eventAmt: { fontSize: 14, fontWeight: '800' },
  statusChip: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
});
