// app/(tabs)/dashboard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserTransactions } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [yearModalVisible, setYearModalVisible] = useState(false);
  const [frequencyMultipliers, setFrequencyMultipliers] = useState({ weekly: 4, biweekly: 2, monthly: 1 });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchUserTransactions();
        if (data) {
          setTransactions(data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const filtered = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
    });
    setFilteredTransactions(filtered);
  }, [transactions, selectedMonth, selectedYear]);

  const incomeData = filteredTransactions.filter(t => t.type === 'income');
  const expenseData = filteredTransactions.filter(t => t.type === 'expense');

  const calculateTotal = (data) => {
    return data.reduce((sum, t) => {
      const multiplier = frequencyMultipliers[t.frequency?.toLowerCase()] || 1;
      return sum + (t.amount * multiplier);
    }, 0);
  };

  const totalIncome = calculateTotal(incomeData);
  const totalExpenses = calculateTotal(expenseData);
  const leftover = Math.max(totalIncome - totalExpenses, 0);

  const expenseByCategory = expenseData.reduce((acc, item) => {
    const multiplier = frequencyMultipliers[item.frequency?.toLowerCase()] || 1;
    const name = item.category_name ?? 'leftover';
    const existing = acc.find(cat => cat.name === name);
    const amount = item.amount * multiplier;
  
    if (existing) {
      existing.amount += amount;
    } else {
      acc.push({
        name, // <- if item.category is undefined, this will be "undefined"
        amount,
        color: item.color || '#999',
        legendFontColor: '#333',
        legendFontSize: 14,
      });
    }
    return acc;
  }, []);


// That should fix the "100% undefined" label and make the pie chart accurate again.
  

  // const expenseByCategory = expenseData.reduce((acc, item) => {
  //   const existing = acc.find(cat => cat.name === item.category);
  //   const multiplier = frequencyMultipliers[item.frequency?.toLowerCase()] || 1;
  //   if (existing) existing.amount += item.amount * multiplier;
  //   else acc.push({ name: item.category, amount: item.amount * multiplier, color: item.color || '#999', legendFontColor: '#333', legendFontSize: 14 });
  //   return acc;
  // }, []);

  const renderRecentItem = ({ item }) => (
    <View style={styles.recentRow}>
      <View style={[styles.dot, { backgroundColor: item.color || (item.type === 'expense' ? '#F44336' : '#4CAF50') }]} />
      <View>
        <Text style={styles.transactionType}>{item.type.toUpperCase()}</Text>
        <Text style={styles.transactionAmount}>${item.amount.toLocaleString()}</Text>
        <Text style={styles.transactionDetails}>{item.category}</Text>
        <Text style={styles.transactionDetails}>{new Date(item.date).toLocaleDateString()}</Text>
      </View>
    </View>
  );

  const monthOptions = Array.from({ length: 12 }, (_, i) => i);
  const yearOptions = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear())));

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Budget Overview</Text>

      <View style={styles.pickerRow}>
        <Pressable style={styles.pickerButton} onPress={() => setMonthModalVisible(true)}>
          <Text style={styles.pickerButtonText}>{new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })}</Text>
        </Pressable>
        <Pressable style={styles.pickerButton} onPress={() => setYearModalVisible(true)}>
          <Text style={styles.pickerButtonText}>{selectedYear}</Text>
        </Pressable>
      </View>

      <Modal visible={monthModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Picker selectedValue={selectedMonth} onValueChange={(value) => { setSelectedMonth(value); setMonthModalVisible(false); }}>
            {monthOptions.map(m => (
              <Picker.Item key={m} label={new Date(0, m).toLocaleString('default', { month: 'long' })} value={m} />
            ))}
          </Picker>
        </View>
      </Modal>

      <Modal visible={yearModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <Picker selectedValue={selectedYear} onValueChange={(value) => { setSelectedYear(value); setYearModalVisible(false); }}>
            {yearOptions.map(y => (
              <Picker.Item key={y} label={y.toString()} value={y} />
            ))}
          </Picker>
        </View>
      </Modal>

      <View style={styles.chartRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryText}>↑ ${totalIncome.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>{new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryText, { color: '#F44336' }]}>↑ ${totalExpenses.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>{`${new Date(0, selectedMonth).toLocaleString('default', { month: 'short' })}. ${selectedYear}`}</Text>
        </View>
      </View>

      <PieChart
        data={expenseByCategory}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{ backgroundColor: 'white', backgroundGradientFrom: 'white', backgroundGradientTo: 'white', color: () => `#000` }}
        accessor={'amount'}
        backgroundColor={'transparent'}
        paddingLeft={'0'}
        center={[0, 0]}
        hasLegend={true}
        avoidFalseZero={true}
      />

      <View style={styles.recentHeaderRow}>
        <Text style={styles.sectionHeader}>Recent Activity</Text>
        <TouchableOpacity onPress={() => router.push('/settings/categories')}>
          <Text style={{ color: '#1e40af' }}>Manage categories</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)}
        keyExtractor={(item) => item.id}
        renderItem={renderRecentItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pickerButton: { flex: 1, backgroundColor: '#eee', padding: 10, marginHorizontal: 5, borderRadius: 8 },
  pickerButtonText: { textAlign: 'center', fontSize: 14, fontWeight: '600' },
  modalContainer: { marginTop: 'auto', backgroundColor: 'white', padding: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  summaryText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  summaryLabel: { textAlign: 'center', color: '#666', fontSize: 12 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12 },
  recentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  transactionType: { fontWeight: 'bold', fontSize: 14 },
  transactionAmount: { fontSize: 16 },
  transactionDetails: { fontSize: 12, color: '#666' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  recentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
});
