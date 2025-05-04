// app/add-transaction.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addTransaction } from '../utils/storage';

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
      type: type === 'income' ? 'income' : 'expense',
      amount: parseFloat(amount),
      category,
      note,
      date: new Date().toISOString(),
      frequency,
      dueDay: frequency === 'monthly' && type === 'expense' ? parseInt(dueDay) : undefined,
    };

    try {
      console.log('Attempting to save transaction:', transaction);
      await addTransaction(transaction);
      console.log('Transaction saved. Redirecting to /budget.');
      router.replace('/budget');
    } catch (err) {
      console.error('Error saving transaction:', err);
      Alert.alert('Save Failed', 'Unable to save transaction.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Add {type === 'income' ? 'Income' : 'Expense'}</Text>

      <TextInput
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />
      <TextInput
        placeholder="Category"
        value={category}
        onChangeText={setCategory}
        style={styles.input}
      />
      <TextInput
        placeholder="Note (optional)"
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
    padding: 20,
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
