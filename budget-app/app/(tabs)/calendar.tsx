// app/(tabs)/calendar.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';

export default function CalendarScreen() {
  const [markedDates, setMarkedDates] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  useEffect(() => {
    const loadBudgets = async () => {
      const user = await getCurrentUser();
      if (!user?.id) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/budgets/user/${user.id}`, {
          credentials: 'include',
          headers: user.token ? { Authorization: `Bearer ${user.token}` } : undefined,
        });
        const data = res.ok ? await res.json() : [];
        const marks: any = {};
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        (Array.isArray(data) ? data : []).forEach((b) => {
          if (!b.start_date) return;
          const date = new Date(b.start_date);
          if (isNaN(date.getTime())) return;
          const color = b.type?.toLowerCase() === 'income' ? '#22c55e' : '#ef4444';

          const addMark = (d: Date) => {
            const key = d.toISOString().slice(0, 10);
            const dot = { key: `${b.id || b.name}-${key}`, color };
            if (marks[key]) {
              marks[key].dots.push(dot);
            } else {
              marks[key] = { dots: [dot], marked: true };
            }
          };

          const freq = b.frequency?.toLowerCase();
          if (freq === 'weekly' || freq === 'biweekly') {
            const step = freq === 'weekly' ? 7 : 14;
            let current = new Date(date);
            // move forward to current month
            while (current < monthStart) current.setDate(current.getDate() + step);
            while (current <= monthEnd) {
              addMark(new Date(current));
              current.setDate(current.getDate() + step);
            }
          } else if (freq === 'monthly') {
            const monthlyDate = new Date(monthStart);
            monthlyDate.setDate(date.getDate());
            if (monthlyDate <= monthEnd) addMark(monthlyDate);
          } else if (freq === '1st-15th') {
            const d1 = new Date(monthStart); d1.setDate(1); addMark(d1);
            const d15 = new Date(monthStart); d15.setDate(15); addMark(d15);
          } else {
            // one-time within month
            if (date >= monthStart && date <= monthEnd) addMark(date);
          }
        });
        // also mark recurring transactions
        try {
          const txRes = await fetch(`${API_URL}/auth/transactions?user_id=${user.id}`, {
            credentials: 'include',
            headers: user.token ? { Authorization: `Bearer ${user.token}` } : undefined,
          });
          const txs = txRes.ok ? await txRes.json() : [];
          (Array.isArray(txs) ? txs : []).forEach((t) => {
            if (!t.date) return;
            const date = new Date(t.date);
            if (isNaN(date.getTime())) return;
            const color = t.type?.toLowerCase() === 'income' ? '#22c55e' : '#ef4444';

            const addMarkTx = (d: Date) => {
              const key = d.toISOString().slice(0, 10);
              const dot = { key: `${t.id || t.note || 'tx'}-${key}`, color };
              if (marks[key]) {
                marks[key].dots.push(dot);
              } else {
                marks[key] = { dots: [dot], marked: true };
              }
            };

            const freq = t.frequency?.toLowerCase();
            if (freq === 'weekly' || freq === 'biweekly') {
              const step = freq === 'weekly' ? 7 : 14;
              let current = new Date(date);
              while (current < monthStart) current.setDate(current.getDate() + step);
              while (current <= monthEnd) {
                addMarkTx(new Date(current));
                current.setDate(current.getDate() + step);
              }
            } else if (freq === 'monthly') {
              const monthlyDate = new Date(monthStart);
              monthlyDate.setDate(date.getDate());
              if (monthlyDate <= monthEnd) addMarkTx(monthlyDate);
            } else if (freq === '1st-15th') {
              const d1 = new Date(monthStart); d1.setDate(1); addMarkTx(d1);
              const d15 = new Date(monthStart); d15.setDate(15); addMarkTx(d15);
            } else {
              if (date >= monthStart && date <= monthEnd) addMarkTx(date);
            }
          });
        } catch (e) {
          console.error('Failed to load transactions for calendar:', e);
        }
        setMarkedDates(marks);
      } catch (e) {
        console.error('Failed to load budgets for calendar:', e);
      } finally {
        setLoading(false);
      }
    };
    loadBudgets();
  }, [currentMonth]);

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
      <Calendar
        style={styles.calendar}
        onMonthChange={(month) => {
          setCurrentMonth(new Date(month.dateString));
        }}
        onDayPress={(day) => {
          console.log('Selected day', day);
        }}
        markedDates={markedDates}
        markingType="multi-dot"
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text>Income budget</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text>Expense budget</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: 'white',
  },
  calendar: {
    borderRadius: 10,
    elevation: 3,
    margin: 16,
  },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
