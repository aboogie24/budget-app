import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '@/utils/storage';
import { Swipeable } from 'react-native-gesture-handler';
import Constants from 'expo-constants';

export default function BudgetScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ||
    Constants.manifest?.extra?.API_URL ||
    'http://localhost:8080';

  const handleAdd = (type: 'income' | 'expense') => {
    setModalVisible(false);
    router.push(`/add-transaction?type=${type}`);
  };

  const fetchTransactions = async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/transactions?user_id=${currentUser.id}`);
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_URL}/transactions/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) fetchTransactions();
      else Alert.alert('Error', 'Failed to delete transaction.');
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Delete failed.');
    }
  };

  const renderRightActions = (id) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        Alert.alert('Delete', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(id) },
        ]);
      }}>
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  );

  const frequencyMultipliers = {
    weekly: 4,
    biweekly: 2,
    monthly: 1,
  };
  
  const incomeData = transactions.filter((t) => t.type?.toLowerCase() === 'income');
  const expenseData = transactions.filter((t) => t.type?.toLowerCase() === 'expense');
  
  const totalIncome = incomeData.reduce((acc, t) => {
    const multiplier = frequencyMultipliers[t.frequency?.toLowerCase()] || 1;
    return acc + (t.amount * multiplier);
  }, 0);
  
  const totalExpenses = expenseData.reduce((acc, t) => {
    const multiplier = frequencyMultipliers[t.frequency?.toLowerCase()] || 1;
    return acc + (t.amount * multiplier);
  }, 0);
  
  const progress = totalIncome > 0 ? totalExpenses / totalIncome : 0;

  // const incomeData = transactions.filter((t) => t.type?.toLowerCase() === 'income');
  // const expenseData = transactions.filter((t) => t.type?.toLowerCase() === 'expense');
  // const totalIncome = incomeData.reduce((acc, t) => acc + t.amount, 0);
  // const totalExpenses = expenseData.reduce((acc, t) => acc + t.amount, 0);
  // const progress = totalIncome > 0 ? totalExpenses / totalIncome : 0;

  const renderTransactionItem = ({ item }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <View style={styles.transactionItemRow}>
        <View style={[styles.iconCircle, { backgroundColor: item.type === 'income' ? '#4CAF50' : '#8e24aa' }]}>
          <MaterialIcons
            name={item.category === 'Work' ? 'work' : item.category === 'Child' ? 'child-care' : 'home'}
            size={22}
            color="white"
          />
        </View>
        <View style={styles.transactionTextContainer}>
          <Text style={styles.transactionAmount}>${item.amount}</Text>
          <Text style={styles.transactionCategory}>{item.category}</Text>
          <Text style={styles.transactionDate}>{new Date(item.date).toLocaleDateString()} • {item.frequency}</Text>
        </View>
      </View>
    </Swipeable>
  );

  if (loading) {
    return (
      <View style={styles.container}><ActivityIndicator size="large" color="#4CAF50" /></View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Budget</Text>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.label}>Total Income</Text>
          <Text style={styles.incomeText}>${totalIncome}</Text>
        </View>
        <View>
          <Text style={styles.label}>Total Expenses</Text>
          <Text style={styles.expenseText}>-${totalExpenses} Monthly Deficit</Text>
        </View>
      </View>
      <View style={styles.progressBarContainer}>
        {progress <= 1 ? (
          <>
            <View style={[styles.incomeBar, { flex: 1 - progress }]} />
            <View style={[styles.expenseBar, { flex: progress }]} />
          </>
        ) : (
          <>
            <View style={[styles.incomeBar, { flex: 1 }]} />
            <View style={[styles.expenseBar, { flex: progress - 1 }]} />
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Income</Text>
      <FlatList data={incomeData} renderItem={renderTransactionItem} keyExtractor={(item) => item.id} />

      <Text style={styles.sectionTitle}>Expenses</Text>
      <FlatList data={expenseData} renderItem={renderTransactionItem} keyExtractor={(item) => item.id} />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => handleAdd('income')}>
              <Text style={styles.modalButtonText}>Add Income</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={() => handleAdd('expense')}>
              <Text style={styles.modalButtonText}>Add Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', alignSelf: 'center', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { color: '#777', fontSize: 14 },
  incomeText: { color: '#2e7d32', fontSize: 20, fontWeight: 'bold' },
  expenseText: { color: '#d32f2f', fontSize: 16 },
  progressBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  incomeBar: {
    backgroundColor: '#4CAF50',
  },
  expenseBar: {
    backgroundColor: '#d32f2f',
  },
  remainingBar: {
    backgroundColor: '#ddd',
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  transactionItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionTextContainer: { flex: 1 },
  transactionAmount: { fontWeight: 'bold', fontSize: 16 },
  transactionCategory: { color: '#555' },
  transactionDate: { color: '#999', fontSize: 12 },
  deleteButton: { backgroundColor: 'red', justifyContent: 'center', alignItems: 'flex-end', padding: 20 },
  deleteButtonText: { color: 'white', fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  modalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtonText: { color: 'white', fontWeight: 'bold' },
  modalCancel: { marginTop: 10, color: 'gray' },
});
