import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import DropDownPicker from 'react-native-dropdown-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';

export default function AddBudgetScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [typeOpen, setTypeOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [budgets, setBudgets] = useState([]);

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ||
    Constants.manifest?.extra?.API_URL ||
    'http://localhost:8080';

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_URL}/categories?type=${type}`);
        const data = await response.json();
        setCategories(data.map(c => ({ label: c.name, value: c.id })));
      } catch (error) {
        console.error('Failed to load categories', error);
      }
    };
    fetchCategories();
  }, [type]);

  useEffect(() => {
    const fetchBudgets = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) return;

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      try {
        const response = await fetch(`${API_URL}/budgets/user/${currentUser.id}?month=${currentMonth}&year=${currentYear}`);
        const data = await response.json();
        setBudgets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load budgets:', error);
      }
    };
    fetchBudgets();
  }, []);

  const handleSave = async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return;

    if (!name || !amount || !type || !categoryId || !frequency) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }

    const body = {
      name,
      amount: parseFloat(amount),
      type,
      frequency,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      category_id: categoryId,
      user_id: currentUser.id,
    };

    try {
      const res = await fetch(`${API_URL}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to save budget.');
      }
    } catch (err) {
      console.error('Save error', err);
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false); // only close on Android

		if (selectedDate) {
			setDate(selectedDate);
		}
  };

  const renderBudgetItem = ({ item }) => (
    <View style={styles.transactionItemRow}>
      <View style={[styles.iconCircle, { backgroundColor: '#4CAF50' }]}>        
        <MaterialIcons name="pie-chart" size={22} color="white" />
      </View>
      <View style={styles.transactionTextContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.transactionAmount}>${item.amount}</Text>
          <Text style={styles.transactionName}>{item.name}</Text>
        </View>
        <Text style={styles.transactionCategory}>{item.category_name || 'Uncategorized'}</Text>
        <Text style={styles.transactionDate}>{item.month}/{item.year}</Text>
      </View>
    </View>
  );

  const incomeBudgets = budgets.filter(b => b.type === 'income');
  const expenseBudgets = budgets.filter(b => b.type === 'expense');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <Text style={styles.title}>Add Budget</Text>

        <TextInput
          style={styles.input}
          placeholder="Budget Name"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

				<TouchableOpacity onPress={() => setShowDatePicker(true)}>
					<Text style={styles.dateSelector}>
						Select Start Date: {date.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
					</Text>
				</TouchableOpacity>

        {showDatePicker && Platform.OS === 'android' && (
					<DateTimePicker
						value={date}
						mode="date"
						display="calendar"
						onChange={handleDateChange}
					/>
				)}

				{Platform.OS === 'ios' && (
					<DateTimePicker
						value={date}
						mode="date"
						display="spinner"
						onChange={handleDateChange}
						style={{ height: 150 }}
					/>
				)}

        <Text style={styles.label}>Type</Text>
        <DropDownPicker
          open={typeOpen}
          value={type}
          items={[{ label: 'Income', value: 'income' }, { label: 'Expense', value: 'expense' }]}
          setOpen={setTypeOpen}
          setValue={setType}
          setItems={() => {}}
          style={styles.dropdown}
          zIndex={3000}
          zIndexInverse={1000}
        />

        <Text style={styles.label}>Frequency</Text>
        <DropDownPicker
          open={frequencyOpen}
          value={frequency}
          items={[
            { label: 'One-time', value: 'one-time' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Biweekly', value: 'biweekly' },
            { label: 'Monthly', value: 'monthly' },
            { label: '1st & 15th', value: '1st-15th' },
          ]}
          setOpen={setFrequencyOpen}
          setValue={setFrequency}
          setItems={() => {}}
          style={styles.dropdown}
          zIndex={2500}
          zIndexInverse={1500}
        />

        <Text style={styles.label}>Category</Text>
        <DropDownPicker
          open={categoryOpen}
          value={categoryId}
          items={categories}
          setOpen={setCategoryOpen}
          setValue={setCategoryId}
          setItems={setCategories}
          style={styles.dropdown}
          zIndex={2000}
          zIndexInverse={2000}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Budget</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {/* <Text style={styles.sectionTitle}>Income Budgets</Text>
        <FlatList
          data={incomeBudgets}
          renderItem={renderBudgetItem}
          keyExtractor={(item) => item.id}
        />

        <Text style={styles.sectionTitle}>Expense Budgets</Text>
        <FlatList
          data={expenseBudgets}
          renderItem={renderBudgetItem}
          keyExtractor={(item) => item.id}
        /> */}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  dateSelector: {
    color: '#333',
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 16,
  },
  dropdown: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'gray',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
  },
  transactionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionTextContainer: {
    flex: 1,
  },
  transactionAmount: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  transactionName: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  transactionCategory: {
    color: '#555',
  },
  transactionDate: {
    color: '#999',
    fontSize: 12,
  },
});
