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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

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

const getWeekDates = (date: Date): Date[] => {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

// ── Actual vs Projected — the single source of truth ──
// A bill that isn't paid for the period is a *projection* (upcoming money out).
// Everything else — real income, real expenses, and paid bills (which arrive as
// transactions) — is *actual*.
const isProjected = (e: EventItem) => e.source === 'bill' && e.billStatus !== 'paid';
const isOverdue = (e: EventItem) => isProjected(e) && e.billStatus === 'overdue';

// Per-day / per-month split. spent and due are kept SEPARATE end-to-end — never
// summed before display. That separation is the regression guard against the
// bill double-count bug.
type Buckets = { income: number; spent: number; due: number; incomeCount: number; spentCount: number; dueCount: number };
const bucket = (events: EventItem[]): Buckets => {
  const b: Buckets = { income: 0, spent: 0, due: 0, incomeCount: 0, spentCount: 0, dueCount: 0 };
  events.forEach((e) => {
    if (e.type === 'income') { b.income += e.amount; b.incomeCount++; }
    else if (isProjected(e)) { b.due += e.amount; b.dueCount++; }
    else { b.spent += e.amount; b.spentCount++; }
  });
  return b;
};

// ── Day-cell markers ──
// One marker per kind: solid = it happened, hollow ring = it's coming.
type Marker = { solid: boolean; color: string };
const getDayMarkers = (events: EventItem[]): Marker[] => {
  if (!events || events.length === 0) return [];
  const markers: Marker[] = [];
  if (events.some((e) => e.type === 'income')) markers.push({ solid: true, color: colors.success });
  if (events.some((e) => e.type === 'expense' && !isProjected(e))) markers.push({ solid: true, color: colors.error });
  const projected = events.filter(isProjected);
  if (projected.length > 0) {
    markers.push({ solid: false, color: projected.some(isOverdue) ? colors.error : colors.warning });
  }
  return markers;
};

const DayMarkers = ({ markers }: { markers: Marker[] }) => (
  <View style={styles.markerRow}>
    {markers.slice(0, 3).map((m, i) =>
      m.solid ? (
        <View key={i} style={[styles.markerDot, { backgroundColor: m.color }]} />
      ) : (
        <View key={i} style={[styles.markerRing, { borderColor: m.color }]} />
      ),
    )}
  </View>
);

// ── Icon helper ──

const getEventIcon = (item: EventItem): string => {
  if (item.source === 'bill') return isProjected(item) ? 'receipt-outline' : 'receipt';
  if (item.type === 'income') return 'trending-up-outline';
  if (item.source === 'budget') return 'wallet-outline';
  return 'cart-outline';
};

// ── Status / AutoPay chips (projected bills) ──

const ProjectedChips = ({ status, isAutoPay }: { status?: string; isAutoPay?: boolean }) => {
  const overdue = status === 'overdue';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={[styles.miniChip, { backgroundColor: overdue ? 'rgba(239,68,68,0.14)' : 'rgba(234,179,8,0.14)' }]}>
        <Text style={[styles.miniChipText, { color: overdue ? colors.error : colors.warning }]}>
          {overdue ? 'OVERDUE' : 'DUE'}
        </Text>
      </View>
      {isAutoPay && (
        <View style={[styles.miniChip, { backgroundColor: 'rgba(168,85,247,0.14)' }]}>
          <Text style={[styles.miniChipText, { color: colors.primary2 }]}>AUTO</Text>
        </View>
      )}
    </View>
  );
};

// ── Event Row ── actual = solid, projected = dashed/ghosted

const EventRow = ({ item }: { item: EventItem }) => {
  const projected = isProjected(item);
  const isIncome = item.type === 'income';
  const iconName = getEventIcon(item);
  const iconColor = projected
    ? (isOverdue(item) ? colors.error : colors.warning)
    : isIncome ? colors.success : colors.primary2;
  const amountColor = projected
    ? (isOverdue(item) ? colors.error : colors.warning)
    : isIncome ? colors.success : colors.error;

  const subtitle = projected
    ? `Bill · projected${item.isAutoPay ? ' · autopay' : ''}`
    : `${item.source === 'budget' ? 'Budget' : 'Transaction'}${item.note ? ` · ${item.note}` : ''}`;

  return (
    <View style={[styles.eventRow, projected ? styles.eventRowProjected : styles.eventRowActual]}>
      <View style={[styles.eventIcon, { backgroundColor: `${iconColor}1F` }]}>
        <Ionicons name={iconName as any} size={15} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={[styles.eventName, projected && styles.projectedText]} numberOfLines={1}>
            {item.name}
          </Text>
          {projected && <ProjectedChips status={item.billStatus} isAutoPay={item.isAutoPay} />}
        </View>
        <Text style={[styles.eventSub, projected && styles.projectedText]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.eventAmount, { color: amountColor }, projected && styles.projectedText]}>
        {projected ? '~' : isIncome ? '+' : '-'}{formatCurrency(item.amount)}
      </Text>
    </View>
  );
};

// ── Summary header — Spent so far / Still due / Income ──

const SummaryColumn = ({
  label, value, count, color, projected,
}: { label: string; value: number; count: string; color: string; projected?: boolean }) => (
  <View style={styles.sumCol}>
    <Text style={styles.sumLabel}>{label}</Text>
    <Text style={[styles.sumValue, { color }]} numberOfLines={1}>
      {projected ? '~' : ''}{formatCurrency(value)}
    </Text>
    <View style={[styles.sumUnderline, projected ? { borderColor: color, borderStyle: 'dashed' } : { backgroundColor: color }]} />
    <Text style={styles.sumCount}>{count}</Text>
  </View>
);

// ── Main Screen ──

export default function CalendarScreen() {
  const router = useRouter();
  const today = useMemo(() => toKey(new Date()), []);

  const [dayEvents, setDayEvents] = useState<DayEvents>({});
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState(today);
  const [expanded, setExpanded] = useState(false);

  // ── Data loading ──

  const loadData = useCallback(async () => {
    const userId = await api.getUserId();
    if (!userId) return;
    setLoading(true);
    setErrored(false);

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
        // Clamp day 29-31 to the displayed month's length — setDate(31) in a
        // 30-day month rolls into the next month and the entry silently drops.
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        const d = new Date(monthStart);
        d.setDate(Math.min(startDate.getDate(), daysInMonth));
        if (d <= monthEnd) addEntry(d, item);
      } else if (f === '1st-15th') {
        const d1 = new Date(monthStart); d1.setDate(1); addEntry(d1, item);
        const d15 = new Date(monthStart); d15.setDate(15); addEntry(d15, item);
      } else {
        if (startDate >= monthStart && startDate <= monthEnd) addEntry(startDate, item);
      }
    };

    try {
      const [transactions, bills, billPayments] = await Promise.all([
        api.get<any[]>('/auth/transactions', { user_id: userId }),
        api.get<any[]>('/auth/bills', { user_id: userId }),
        // Which bills were paid for a period overlapping THIS displayed month —
        // so we suppress the scheduled bill correctly in any month, not just the
        // current period (paid_this_period on /bills is current-period only).
        api
          .get<{ payments?: { bill_id: string }[] }>('/auth/bill-payments', {
            start: toKey(monthStart),
            end: toKey(monthEnd),
          })
          .catch(() => ({ payments: [] as { bill_id: string }[] })),
      ]);

      const paidBillIds = new Set(
        (billPayments?.payments || []).map((p) => String(p.bill_id)),
      );

      (Array.isArray(transactions) ? transactions : []).forEach((t) => {
        if (!t.date) return;
        // Internal transfers between the user's accounts shouldn't appear on
        // the calendar — they're not income or expense, just money moving.
        if ((t.type || '').toLowerCase() === 'transfer') return;
        const date = parseCalDate(t.date);
        if (isNaN(date.getTime())) return;
        // Only manual templates (source null/'manual') project forward by
        // frequency. Recurring children + bank-synced rows are real dated events.
        const isTemplate = !t.source || t.source === 'manual';
        const freq = isTemplate ? (t.frequency || '') : '';
        expandFrequency(date, freq, {
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
        // Once a bill is paid for the displayed month's period, its real
        // transaction already represents it (added in the transaction loop) —
        // suppress the scheduled bill so it isn't double-counted. paidBillIds is
        // month-accurate; paid_this_period is a current-period fallback.
        if (paidBillIds.has(String(bill.id)) || bill.paid_this_period) return;
        // Clamp due_day 29-31 to the month's last day — otherwise the Date
        // rolls into next month and the bill vanishes from short months.
        const dim = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        const billDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(bill.due_day, dim));
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
      setErrored(true);
    }

    setDayEvents(ev);
    setLoading(false);
    setLoadedOnce(true);
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Derived state ──

  const weekDates = useMemo(() => getWeekDates(new Date(selected + 'T12:00:00')), [selected]);

  const selEvents = dayEvents[selected] || [];
  const selBuckets = useMemo(() => bucket(selEvents), [selEvents]);
  const selActual = useMemo(() => selEvents.filter((e) => !isProjected(e)), [selEvents]);
  const selProjected = useMemo(() => selEvents.filter(isProjected), [selEvents]);

  const monthBuckets = useMemo(() => {
    const prefix = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
    const all: EventItem[] = [];
    Object.entries(dayEvents).forEach(([key, evs]) => {
      if (key.startsWith(prefix)) all.push(...evs);
    });
    return bucket(all);
  }, [dayEvents, month]);

  const netSoFar = monthBuckets.income - monthBuckets.spent;
  const projectedNet = monthBuckets.income - (monthBuckets.spent + monthBuckets.due);

  const monthHasData = useMemo(() => {
    const prefix = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
    return Object.keys(dayEvents).some((k) => k.startsWith(prefix) && dayEvents[k].length > 0);
  }, [dayEvents, month]);

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
  const showSkeleton = loading && !loadedOnce;

  // ── Render ──

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Calendar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {loading && loadedOnce && <ActivityIndicator color={colors.primary2} size="small" />}
            {selected !== today && (
              <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={toggleExpand}>
              <Ionicons name={expanded ? 'contract-outline' : 'expand-outline'} size={16} color={colors.primary2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {showSkeleton ? (
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              <Skeleton height={120} borderRadius={radius.xl} />
              <Skeleton height={92} borderRadius={radius.lg} />
              <Skeleton height={64} borderRadius={radius.md} />
              <Skeleton height={64} borderRadius={radius.md} />
            </View>
          ) : (
          <>
          {/* ── Calendar (week strip / month grid) ── */}
          {expanded ? (
            <View style={styles.card}>
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={18} color={colors.primary2} />
                </TouchableOpacity>
                <Text style={styles.monthNavLabel}>{monthLabel}</Text>
                <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary2} />
                </TouchableOpacity>
              </View>

              <View style={styles.gridRow}>
                {DAY_NAMES.map((d, i) => (
                  <View key={i} style={styles.gridHeaderCell}>
                    <Text style={styles.gridHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.gridContainer}>
                {calendarCells.map((day, i) => {
                  if (day === null) return <View key={`empty-${i}`} style={styles.gridCell} />;
                  const key = toKeyYMD(month.year, month.month, day);
                  const isToday = key === today;
                  const isSelected = key === selected;
                  const markers = getDayMarkers(dayEvents[key] || []);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.gridCell, isSelected && styles.gridCellSelected]}
                      onPress={() => pick(key)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.dayCircle,
                        isSelected && styles.dayCircleSel,
                        isToday && !isSelected && styles.dayCircleToday,
                      ]}>
                        <Text style={[
                          styles.dayNum,
                          isSelected && { color: '#fff' },
                          isToday && !isSelected && { color: colors.primary2 },
                        ]}>{day}</Text>
                      </View>
                      <DayMarkers markers={markers} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.legend}>
                {[
                  { solid: true, color: colors.error, label: 'Spent' },
                  { solid: true, color: colors.success, label: 'Income' },
                  { solid: false, color: colors.warning, label: 'Upcoming' },
                ].map((l, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {l.solid
                      ? <View style={[styles.markerDot, { backgroundColor: l.color }]} />
                      : <View style={[styles.markerRing, { borderColor: l.color }]} />}
                    <Text style={styles.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => shiftWeek(-1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-back" size={16} color={colors.primary2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleExpand}>
                  <Text style={styles.monthNavLabel}>{monthLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => shiftWeek(1)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary2} />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {weekDates.map((d, i) => {
                  const k = toKey(d);
                  const isSel = k === selected;
                  const isTod = k === today;
                  const markers = getDayMarkers(dayEvents[k] || []);
                  return (
                    <TouchableOpacity key={k} style={styles.weekCell} onPress={() => pick(k)} activeOpacity={0.7}>
                      <Text style={[styles.weekDayName, isTod && !isSel && { color: colors.primary2 }]}>{DAY_NAMES[i]}</Text>
                      <View style={[
                        styles.dayCircle,
                        isSel && styles.dayCircleSel,
                        isTod && !isSel && styles.dayCircleToday,
                      ]}>
                        <Text style={[
                          styles.dayNum,
                          isSel && { color: '#fff' },
                          isTod && !isSel && { color: colors.primary2 },
                        ]}>{d.getDate()}</Text>
                      </View>
                      <DayMarkers markers={markers} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Summary header: Spent so far / Still due / Income ── */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <SummaryColumn
                label="Spent so far" value={monthBuckets.spent} color={colors.error}
                count={`${monthBuckets.spentCount} ${monthBuckets.spentCount === 1 ? 'transaction' : 'transactions'}`}
              />
              <SummaryColumn
                label="Still due" value={monthBuckets.due} color={colors.warning} projected
                count={`${monthBuckets.dueCount} ${monthBuckets.dueCount === 1 ? 'bill' : 'bills'} unpaid`}
              />
              <SummaryColumn
                label="Income" value={monthBuckets.income} color={colors.success}
                count={`${monthBuckets.incomeCount} ${monthBuckets.incomeCount === 1 ? 'deposit' : 'deposits'}`}
              />
            </View>
            <View style={styles.netLine}>
              <Text style={styles.netLineText}>
                Net so far <Text style={{ color: netSoFar >= 0 ? colors.success : colors.error, fontWeight: '700' }}>
                  {netSoFar >= 0 ? '+' : '-'}{formatCurrency(netSoFar)}
                </Text>
              </Text>
              <Text style={styles.netDot}>·</Text>
              <Text style={styles.netLineMuted}>
                Projected net {projectedNet >= 0 ? '+' : '-'}{formatCurrency(projectedNet)}
              </Text>
            </View>
          </View>

          {/* ── Day detail ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{dateLabel(selected)}</Text>

            {selEvents.length === 0 ? (
              <View style={styles.emptyDay}>
                <Ionicons name="sunny-outline" size={20} color={colors.textDark} />
                <Text style={styles.emptyDayText}>Nothing scheduled</Text>
              </View>
            ) : (
              <>
                {/* per-day split chips */}
                <View style={styles.dayChips}>
                  {selBuckets.income > 0 && (
                    <View style={[styles.chip, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Ionicons name="trending-up-outline" size={11} color={colors.success} />
                      <Text style={[styles.chipText, { color: colors.success }]}>Received {formatCurrency(selBuckets.income)}</Text>
                    </View>
                  )}
                  {selBuckets.spent > 0 && (
                    <View style={[styles.chip, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                      <Ionicons name="trending-down-outline" size={11} color={colors.error} />
                      <Text style={[styles.chipText, { color: colors.error }]}>Spent {formatCurrency(selBuckets.spent)}</Text>
                    </View>
                  )}
                  {selBuckets.due > 0 && (
                    <View style={[styles.chip, styles.chipProjected]}>
                      <Ionicons name="time-outline" size={11} color={colors.warning} />
                      <Text style={[styles.chipText, { color: colors.warning }]}>Due ~{formatCurrency(selBuckets.due)}</Text>
                    </View>
                  )}
                </View>

                {selActual.length > 0 && (
                  <>
                    <Text style={styles.groupLabel}>ACTUAL</Text>
                    {selActual.map((item, idx) => <EventRow key={`a-${item.id}-${idx}`} item={item} />)}
                  </>
                )}
                {selProjected.length > 0 && (
                  <>
                    <Text style={[styles.groupLabel, { marginTop: spacing.md }]}>UPCOMING</Text>
                    {selProjected.map((item, idx) => <EventRow key={`p-${item.id}-${idx}`} item={item} />)}
                  </>
                )}
              </>
            )}
          </View>

          {/* ── Empty month / error ── */}
          {errored && (
            <View style={styles.noticeCard}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
              <Text style={styles.noticeTitle}>Couldn't load your calendar</Text>
              <TouchableOpacity onPress={loadData}><Text style={styles.noticeAction}>Retry</Text></TouchableOpacity>
            </View>
          )}
          {!errored && !monthHasData && loadedOnce && (
            <View style={styles.noticeCard}>
              <Ionicons name="calendar-outline" size={26} color={colors.textDark} />
              <Text style={styles.noticeTitle}>No money flow yet</Text>
              <Text style={styles.noticeSub}>Link an account or add a transaction to see your month come to life.</Text>
              <TouchableOpacity style={styles.cta} onPress={() => router.push('/add-transaction' as any)}>
                <Text style={styles.ctaText}>Add a transaction</Text>
              </TouchableOpacity>
            </View>
          )}
          </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, ...typography.h3, fontWeight: '800' },
  todayBtn: {
    backgroundColor: 'rgba(192,132,252,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
  },
  todayBtnText: { color: colors.primary2, ...typography.caption, fontWeight: '700' },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.sm,
    backgroundColor: colors.glassLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderGlass,
  },

  // Calendar card (week + month)
  card: {
    ...glassEffects.glass,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthNavLabel: { color: colors.text, ...typography.bodyBold, fontWeight: '700' },
  gridRow: { flexDirection: 'row', marginBottom: spacing.sm },
  gridHeaderCell: { flex: 1, alignItems: 'center' },
  gridHeaderText: { color: colors.textMuted, ...typography.caption, fontWeight: '600' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '14.28%' as any, alignItems: 'center', paddingVertical: 6 },
  gridCellSelected: { backgroundColor: 'rgba(124,58,237,0.18)', borderRadius: radius.md },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.lg,
    marginTop: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderGlass,
  },
  legendText: { color: colors.textMuted, ...typography.caption },

  // Week strip
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center', gap: spacing.xs },
  weekDayName: { color: colors.textMuted, ...typography.caption, fontWeight: '600' },

  // Shared day circle
  dayCircle: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dayCircleSel: { backgroundColor: colors.primary },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary2 },
  dayNum: { color: colors.text, ...typography.smallBold, fontWeight: '600' },

  // Markers
  markerRow: { flexDirection: 'row', gap: 3, height: 7, alignItems: 'center', marginTop: 3 },
  markerDot: { width: 5, height: 5, borderRadius: 2.5 },
  markerRing: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, backgroundColor: 'transparent' },

  // Summary header
  summaryCard: {
    ...glassEffects.glassFloating,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumCol: { flex: 1, alignItems: 'center', gap: 3 },
  sumLabel: { color: colors.textMuted, ...typography.caption },
  sumValue: { ...typography.bodyBold, fontWeight: '800' },
  sumUnderline: { width: 28, height: 2, borderRadius: 1, borderWidth: 1, borderColor: 'transparent' },
  sumCount: { color: colors.textDark, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  netLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderGlass,
  },
  netLineText: { color: colors.textMuted, ...typography.caption },
  netLineMuted: { color: colors.textDark, ...typography.caption },
  netDot: { color: colors.textDark },

  // Sections
  section: {
    ...glassEffects.glass,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: { color: colors.text, ...typography.bodyBold, fontWeight: '800', marginBottom: spacing.sm },
  groupLabel: { color: colors.textDark, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm },

  emptyDay: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm, flexDirection: 'row', justifyContent: 'center' },
  emptyDayText: { color: colors.textMuted, ...typography.small, fontWeight: '600' },

  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg,
  },
  chipProjected: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.warning },
  chipText: { ...typography.caption, fontWeight: '700' },

  // Event row
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  eventRowActual: { backgroundColor: colors.glassLight, borderWidth: 1, borderColor: colors.borderGlass },
  eventRowProjected: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderGlass },
  eventIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  eventName: { color: colors.text, ...typography.small, fontWeight: '600', flexShrink: 1 },
  eventSub: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  eventAmount: { ...typography.small, fontWeight: '700', flexShrink: 0 },
  projectedText: { opacity: 0.7 },

  // Mini chips (DUE/AUTO)
  miniChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  // Notice (empty month / error)
  noticeCard: {
    ...glassEffects.glass,
    marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.xl,
    alignItems: 'center', gap: spacing.sm,
  },
  noticeTitle: { color: colors.text, ...typography.bodyBold, fontWeight: '700' },
  noticeSub: { color: colors.textMuted, ...typography.caption, textAlign: 'center', paddingHorizontal: spacing.lg },
  noticeAction: { color: colors.primary2, ...typography.smallBold, fontWeight: '700', marginTop: spacing.xs },
  cta: {
    marginTop: spacing.sm, backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md,
  },
  ctaText: { color: '#fff', ...typography.smallBold, fontWeight: '700' },
});
