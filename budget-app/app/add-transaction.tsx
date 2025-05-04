// app/add-transaction.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addTransaction, getCurrentUser } from '../utils/storage';

const frequencyOptions = ['one-time', 'weekly', 'biweekly', 'monthly'];

const generateId = () => Math.random().toString(36).substring(2, 10) + Date.now();

export default function AddTransactionScreen() {
  const { type } = useLocalSearchParams();
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState('one-time');
  const [dueDay, setDueDay] = useState('');

  const handleSave = async () => {
    console.log('handleSave triggered');

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

    const transaction = {
			id: generateId(),
			user_id: currentUser.id, // from session
			type,
			amount: parseFloat(amount),
			category,
			note,
			date: new Date().toISOString(),
			frequency,
			due_day: frequency === 'monthly' && type === 'expense' ? parseInt(dueDay) : null,
		};
		console.log(transaction)
    try {
      const response = await fetch('http://10.0.20.204:8080/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(transaction),
			});
	
			if (!response.ok) {
				const err = await response.text();
				console.log(response)
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
      <Text style={styles.header}>Add {type === 'income' ? 'Income' : 'Expense'}</Text>

      <TextInput
        placeholder="Amount"
				placeholderTextColor="#888"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />
      <TextInput
        placeholder="Category"
				placeholderTextColor="#888"
        value={category}
        onChangeText={setCategory}
        style={styles.input}
      />
      <TextInput
        placeholder="Note (optional)"
				placeholderTextColor="#888"
        value={note}
        onChangeText={setNote}
        style={styles.input}
      />

      <Text style={styles.label}>Frequency</Text>
      <View style={styles.frequencyRow}>
        {frequencyOptions.map(option => (
          <TouchableOpacity
            key={option}
            onPress={() => setFrequency(option)}
            style={[
              styles.freqButton,
              frequency === option && styles.freqButtonSelected,
            ]}>
            <Text
              style={[
                styles.freqButtonText,
                frequency === option && styles.freqButtonTextSelected,
              ]}>
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
    marginBottom: 20,
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
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
