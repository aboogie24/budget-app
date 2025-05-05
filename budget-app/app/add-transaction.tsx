import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentUser } from '../utils/storage';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';

const frequencyOptions = ['one-time', 'weekly', 'biweekly', 'monthly'];

const generateId = () =>
  Math.random().toString(36).substring(2, 10) + Date.now();

export default function AddTransactionScreen() {
  const { type } = useLocalSearchParams();
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState('one-time');
  const [dueDay, setDueDay] = useState('');
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080'; // fallback

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/categories?type=${type}`);
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch categories:', e);
      }
    };
    fetchCategories();
  }, [type]);

  const handleRedirect = async () => {
    router.replace('/(tabs)/budget');
  };

  const handleSave = async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.id) {
      Alert.alert('User error', 'No user session found.');
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Invalid amount', 'Please enter a valid number.');
      return;
    }

    if (frequency === 'monthly' && type === 'expense') {
      const dayNum = parseInt(dueDay);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        Alert.alert('Invalid due day', 'Please enter a valid day between 1 and 31.');
        return;
      }
    }

    // Check if category exists, otherwise create it
    let selectedCategory = categories.find(
      (c) => c.name.toLowerCase() === category.toLowerCase()
    );

    if (!selectedCategory) {
      console.log(category, currentUser.id)
      try {
        const newCatPayload = {
          id: uuidv4(),
          name: category, 
          user_id: currentUser.id,
          type,
        }

        console.log(newCatPayload)
        const categoryRes = await fetch(`${API_URL}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: uuidv4(),
            name: category,
            user_id: currentUser.id,
            type,
            color: "#4CAF50", 
          }),
        });

        console.log(categoryRes)

        if (!categoryRes.ok) {
          throw new Error(`Failed to create category: ${await categoryRes.text()}`);
        }

        selectedCategory = await categoryRes.json();
        setCategories((prev) => [...prev, selectedCategory]);
      } catch (err) {
        console.error('Failed to create category:', err);
        Alert.alert('Error', 'Failed to create category.');
        return;
      }
    }

    const transaction = {
      id: generateId(),
      user_id: currentUser.id,
      type,
      amount: parseFloat(amount),
      category: selectedCategory.name,
      note,
      date: new Date().toISOString(),
      frequency,
      due_day:
        frequency === 'monthly' && type === 'expense' ? parseInt(dueDay) : null,
    };

    try {
      const response = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Failed to save:', err);
        Alert.alert('Error', 'Failed to save transaction.');
        return;
      }

      Alert.alert('Success', 'Transaction saved.');
      router.replace('/budget');
    } catch (err) {
      console.error('Error saving:', err);
      Alert.alert('Error', 'Could not save transaction.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Add {type === 'income' ? 'Income' : 'Expense'}
      </Text>

      <TextInput
        placeholder="Amount"
        placeholderTextColor="#888"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />

      <View style={{ marginBottom: 20 }}>
        <TextInput
          placeholder="Category"
          placeholderTextColor="#888"
          value={category}
          onChangeText={(text) => {
            setCategory(text);
          }}
          style={styles.input}
        />
        {category.length > 0 && (
          <FlatList
            data={categories.filter((c) =>
              c.name.toLowerCase().includes(category.toLowerCase())
            )}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setCategory(item.name)}
                style={styles.suggestionItem}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <TextInput
        placeholder="Note (optional)"
        placeholderTextColor="#888"
        value={note}
        onChangeText={setNote}
        style={styles.input}
      />

      <Text style={styles.label}>Frequency</Text>
      <View style={styles.frequencyRow}>
        {frequencyOptions.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setFrequency(option)}
            style={[
              styles.freqButton,
              frequency === option && styles.freqButtonSelected,
            ]}
          >
            <Text
              style={[
                styles.freqButtonText,
                frequency === option && styles.freqButtonTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {type === 'expense' && frequency === 'monthly' && (
        <TextInput
          placeholder="Enter due day (1-31)"
          placeholderTextColor="#888"
          value={dueDay}
          onChangeText={setDueDay}
          keyboardType="numeric"
          style={styles.input}
        />
      )}

      <TouchableOpacity onPress={handleSave} style={styles.button}>
        <Text style={styles.buttonText}>Save Transaction</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleRedirect}
        style={[styles.button, { backgroundColor: '#e53935', marginTop: 16 }]}
      >
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    paddingVertical: 75,
    backgroundColor: 'white',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  freqButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  freqButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  freqButtonText: {
    color: '#000',
  },
  freqButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
});
