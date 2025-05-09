// ✅ Fix: Prevent .filter from running on null + Add tabs for Budgets and Transactions + Fetch budgets + Add Budget Button
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '@/utils/storage';
import { Swipeable } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { BudgetIcon } from '@/components/BudgetItemUtils';

export default function BudgetScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'budgets' | 'transactions'>('budgets');

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ||
    Constants.manifest?.extra?.API_URL ||
    'http://localhost:8080';

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

  const fetchBudgets = async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return;
    const currentMonth = new Date().getMonth() + 1; // JS months are 0-based
    const currentYear = new Date().getFullYear();
    try {
      const response = await fetch(
        `${API_URL}/budgets/user/${currentUser.id}?month=${currentMonth}&year=${currentYear}`
      );
      const data = await response.json();
      console.log(data)
      setBudgets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchBudgets();
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

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const incomeData = safeTransactions.filter((t) => t.type?.toLowerCase() === 'income');
  const expenseData = safeTransactions.filter((t) => t.type?.toLowerCase() === 'expense');

  const totalIncome = incomeData.reduce((acc, t) => {
    const multiplier = frequencyMultipliers[t.frequency?.toLowerCase()] || 1;
    return acc + (t.amount * multiplier);
  }, 0);

  const totalExpenses = expenseData.reduce((acc, t) => {
    const multiplier = frequencyMultipliers[t.frequency?.toLowerCase()] || 1;
    return acc + (t.amount * multiplier);
  }, 0);

  const progress = totalIncome > 0 ? totalExpenses / totalIncome : 0;

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

  const renderBudgetItem = ({ item }) => (
    <View style={styles.transactionItemRow}>
      <BudgetIcon type={item.type} category={item.category_name} />

      <View style={styles.transactionTextContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.transactionAmount}>${item.amount}</Text>
          <Text style={styles.transactionName}>{item.name}</Text>
        </View>
        <Text style={styles.transactionCategory}>{item.category_name || 'Uncategorized'}</Text>
        <Text style={styles.transactionDate}>{item.start_date}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}><ActivityIndicator size="large" color="#4CAF50" /></View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'budgets' && styles.activeTab]}
          onPress={() => setActiveTab('budgets')}
        >
          <Text style={[styles.tabText, activeTab === 'budgets' && styles.activeTabText]}>Budgets</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>Transactions</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'budgets' && (
        <>
          {/* <Text style={styles.pageTitle}>Budget</Text> */}
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.label}>Total Budget Income</Text>
              <Text style={styles.incomeText}>${totalIncome}</Text>
            </View>
            <View>
              <Text style={styles.label}>Total Budget Expenses</Text>
              <Text style={styles.expenseText}>${totalExpenses} </Text>
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
          <Text style={styles.sectionTitle}>Income Budgets</Text>
          <FlatList
            data={budgets.filter(b => b.type === 'income')}
            renderItem={renderBudgetItem}
            keyExtractor={(item) => item.id}
          />

          <Text style={styles.sectionTitle}>Expense Budgets</Text>
          <FlatList
            data={budgets.filter(b => b.type === 'expense')}
            renderItem={renderBudgetItem}
            keyExtractor={(item) => item.id}
          />

          <TouchableOpacity style={styles.fab} onPress={() => router.push('/budget/add-budget')}>
            <Ionicons name="add" size={30} color="white" />
          </TouchableOpacity>
        </>
      )}

      {activeTab === 'transactions' && (
        <>
          <Text style={styles.sectionTitle}>Income</Text>
          <FlatList data={incomeData} renderItem={renderTransactionItem} keyExtractor={(item) => item.id} />

          <Text style={styles.sectionTitle}>Expenses</Text>
          <FlatList data={expenseData} renderItem={renderTransactionItem} keyExtractor={(item) => item.id} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tabText: {
    fontSize: 16,
    color: '#777',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
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
  incomeBar: { backgroundColor: '#4CAF50' },
  expenseBar: { backgroundColor: '#d32f2f' },
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
  transactionName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
