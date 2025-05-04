import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '@/utils/storage';
import { Swipeable } from 'react-native-gesture-handler';

export default function BudgetScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleAdd = (type: 'income' | 'expense') => {
    setModalVisible(false);
    router.push(`/add-transaction?type=${type}`);
  };

  const fetchTransactions = async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      const response = await fetch(`http://10.0.20.204:8080/transactions?user_id=${currentUser.id}`);
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

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`http://10.0.20.204:8080/transactions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTransactions(); // refresh after delete
      } else {
        Alert.alert('Error', 'Failed to delete transaction.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Delete failed.');
    }
  };

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        Alert.alert('Delete', 'Are you sure you want to delete this transaction?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(id) },
        ]);
      }}>
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <View style={styles.transactionItem}>
        <Text style={styles.transactionType}>{item.type.toUpperCase()}</Text>
        <Text style={styles.transactionDetails}>${item.amount} - {item.category}</Text>
        <Text style={styles.transactionDate}>{new Date(item.date).toLocaleDateString()} ({item.frequency})</Text>
        {item.frequency === 'monthly' && item.dueDay && (
          <Text style={styles.transactionDueDate}>Due every month on day {item.dueDay}</Text>
        )}
      </View>
    </Swipeable>
  );

  // const incomeData = transactions.filter(t => t.type === 'income');
	const incomeData = (transactions || []).filter(t => t.type?.toLowerCase() === 'income'); 
  // const expenseData = transactions.filter(t => t.type === 'expense');
	const expenseData = (transactions || []).filter(t => t.type?.toLowerCase() === 'expense');

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.text}>Budgets</Text>
        <TouchableOpacity style={styles.topRightButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Income</Text>
      <FlatList
        data={incomeData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      <Text style={styles.sectionHeader}>Expenses</Text>
      <FlatList
        data={expenseData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Transaction</Text>
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
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  topRightButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 20,
  },
  listContent: {
    paddingBottom: 10,
  },
  transactionItem: {
    borderBottomWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  transactionType: {
    fontWeight: 'bold',
    color: '#333',
  },
  transactionDetails: {
    color: '#555',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionDueDate: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  deleteButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'flex-end',
    padding: 20,
    flex: 1,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalCancel: {
    marginTop: 10,
    color: 'gray',
  },
});
