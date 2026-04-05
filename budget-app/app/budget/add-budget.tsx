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
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import DropDownPicker from 'react-native-dropdown-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { successHaptic, errorHaptic } from '@/utils/haptics';
import CategoryPicker from '@/components/CategoryPicker';
import { LinearGradient } from 'expo-linear-gradient';

export default function AddBudgetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefill_category_id?: string; prefill_name?: string }>();
  const [name, setName] = useState(params.prefill_name ?? '');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState(params.prefill_category_id ?? '');
  const [categoryLabel, setCategoryLabel] = useState(params.prefill_name ?? '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categories, setCategories] = useState([]);
  const [typeOpen, setTypeOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const user = await getCurrentUser();
        if (user?.id) setUserId(user.id);
        const [defaults, userCats] = await Promise.all([
          api.get(`/auth/categories`, { type }).catch(() => []),
          user?.id ? api.get(`/auth/categories/user/${user.id}`).catch(() => []) : Promise.resolve([]),
        ]);

        const filteredUserCats = (Array.isArray(userCats) ? userCats : []).filter(
          (c) => c.type?.toLowerCase() === type.toLowerCase()
        );

        const merged = [...(Array.isArray(defaults) ? defaults : []), ...filteredUserCats];
        const deduped = merged.reduce((acc: any[], curr: any) => {
          if (!acc.find((c) => c.id === curr.id || c.name === curr.name)) acc.push(curr);
          return acc;
        }, []);
        const items = deduped.map((c) => ({ label: c.name, value: c.id }));
        setCategories(items);
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
        const data = await api.get(`/auth/budgets/user/${currentUser.id}`, { month: currentMonth, year: currentYear });
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
      start_date: date.toISOString(),
    };

    try {
      await api.post('/auth/budgets', body);
      successHaptic();
      router.back();
    } catch (err) {
      console.error('Save error', err);
      errorHaptic();
      Alert.alert('Error', 'Failed to save budget.');
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
        <Text style={styles.transactionDate}>
          {item.start_date ? new Date(item.start_date).toLocaleDateString() : `${item.month}/${item.year}`}
        </Text>
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
          dropDownContainerStyle={styles.dropdownContainer}
          listMode="MODAL"
          onOpen={() => {
            setCategoryOpen(false);
            setFrequencyOpen(false);
          }}
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
          dropDownContainerStyle={styles.dropdownContainer}
          listMode="MODAL"
          onOpen={() => {
            setTypeOpen(false);
            setCategoryOpen(false);
          }}
          zIndex={2500}
          zIndexInverse={1500}
        />

        <Text style={styles.label}>Category</Text>
        <TouchableOpacity
          style={styles.categorySelector}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={categoryId ? styles.categorySelectorText : styles.categorySelectorPlaceholder}>
            {categoryLabel || 'Select category'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>

        {userId !== '' && (
          <CategoryPicker
            visible={showCategoryPicker}
            onClose={() => setShowCategoryPicker(false)}
            onSelect={(selected) => {
              setCategoryId(selected.id);
              const label = selected.parent_name
                ? `${selected.parent_name} > ${selected.name}`
                : selected.name;
              setCategoryLabel(label);
              if (!name.trim()) {
                setName(selected.name);
              }
              setShowCategoryPicker(false);
            }}
            type={type as 'income' | 'expense'}
            userId={userId}
          />
        )}

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
    borderColor: '#ccc',
  },
  dropdownContainer: { borderColor: '#ccc' },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  categorySelectorText: {
    fontSize: 16,
    color: '#333',
  },
  categorySelectorPlaceholder: {
    fontSize: 16,
    color: '#999',
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
