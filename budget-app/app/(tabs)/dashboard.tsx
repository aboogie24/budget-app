// app/(tabs)/dashboard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Modal, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserTransactions } from '@/utils/api';

export default function DashboardScreen() {
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
        // const multipliers = await AsyncStorage.getItem('frequencyMultipliers');
        const data = await fetchUserTransactions();
				console.log(data)
        setTransactions(data);
        // setFrequencyMultipliers(multipliers ? JSON.parse(multipliers) : { weekly: 4, biweekly: 2, monthly: 1 });
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
      const multiplier = frequencyMultipliers[t.frequency] || 1;
      return sum + (t.amount * multiplier);
    }, 0);
  };

  const totalIncome = calculateTotal(incomeData);
  const totalExpenses = calculateTotal(expenseData);
  const leftover = Math.max(totalIncome - totalExpenses, 0);

  const chartData = [
    { name: 'Income', amount: totalIncome, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 14 },
    { name: 'Expenses', amount: totalExpenses, color: '#F44336', legendFontColor: '#333', legendFontSize: 14 },
    { name: 'Leftover', amount: leftover, color: '#2196F3', legendFontColor: '#333', legendFontSize: 14 },
  ];

  const renderRecentItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <Text style={styles.transactionTitle}>{item.type.toUpperCase()} - ${item.amount}</Text>
      <Text style={styles.transactionDetails}>{item.category} | {new Date(item.date).toLocaleDateString()}</Text>
    </View>
  );

  const monthOptions = Array.from({ length: 12 }, (_, i) => i);
  const yearOptions = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear())));

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Budget Overview</Text>

      <View style={styles.pickerRow}>
        <Pressable style={styles.pickerButton} onPress={() => setMonthModalVisible(true)}>
          <Text style={styles.pickerButtonText}>Month: {new Date(0, selectedMonth).toLocaleString('default', { month: 'long' })}</Text>
        </Pressable>
        <Pressable style={styles.pickerButton} onPress={() => setYearModalVisible(true)}>
          <Text style={styles.pickerButtonText}>Year: {selectedYear}</Text>
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

      <Text style={styles.summaryText}>Monthly Income: ${totalIncome.toFixed(2)}</Text>
      <Text style={styles.summaryText}>Monthly Expenses: ${totalExpenses.toFixed(2)}</Text>

      <PieChart
        data={chartData}
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

      <Text style={styles.sectionHeader}>Recent Activity</Text>
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
  summaryText: { fontSize: 16, fontWeight: '500', marginBottom: 4, marginLeft: 8 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 12 },
  transactionItem: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  transactionTitle: { fontWeight: 'bold', fontSize: 16 },
  transactionDetails: { color: '#666', fontSize: 14 },
});
