import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function TransactionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const transactionId = (params.id as string) || '';
  const amount = Number(params.amount || 0);
  const type = (params.type as string) || 'expense';
  const category = (params.category_name as string) || (params.category as string) || 'Uncategorized';
  const note = (params.note as string) || '';
  const date = params.date ? new Date(params.date as string) : new Date();
  const source = (params.source as string) || 'manual';

  const formatCurrency = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const handleEdit = () => {
    // Only allow editing for manual transactions
    if (source === 'manual' || source !== 'bank') {
      router.push({
        pathname: '/transaction/edit/[id]',
        params: {
          id: transactionId,
          amount: String(amount),
          type,
          category,
          note,
          date: params.date,
        },
      });
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#1b0d30', '#2d0c53']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 20 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#e5e7eb" />
          </TouchableOpacity>
          {(source === 'manual' || source !== 'bank') && (
            <TouchableOpacity onPress={handleEdit} style={styles.iconBtn}>
              <Ionicons name="pencil" size={20} color="#a855f7" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{type === 'income' ? 'Income' : 'Expense'}</Text>
          <Text style={[styles.amount, type === 'income' ? styles.income : styles.expense]}>
            {type === 'income' ? '+' : '-'}
            {formatCurrency(amount)}
          </Text>
          <Text style={styles.category}>{category}</Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <View style={styles.row}>
            <Ionicons name="time-outline" size={16} color="#cbd5e1" />
            <Text style={styles.meta}>{date.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#cbd5e1" />
            <Text style={styles.meta}>{source === 'bank' ? 'From linked account' : 'Entered manually'}</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: { color: '#cbd5e1', fontWeight: '700', marginBottom: 6 },
  amount: { fontSize: 28, fontWeight: '800' },
  income: { color: '#34d399' },
  expense: { color: '#f87171' },
  category: { color: '#e5e7eb', fontSize: 16, marginTop: 6, fontWeight: '700' },
  note: { color: '#cbd5e1', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  meta: { color: '#cbd5e1' },
});
