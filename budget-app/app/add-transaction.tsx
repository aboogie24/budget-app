import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentUser } from '../utils/storage';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';

const frequencyOptions = ['one-time', 'weekly', 'biweekly', 'monthly'];

const generateId = () =>
  Math.random().toString(36).substring(2, 10) + Date.now();

export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const type = (params.type as string) || 'expense';
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
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
          },
          credentials: 'include',
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
      const response = await fetch(`${API_URL}/auth/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Failed to save:', err);
        Alert.alert('Error', 'Failed to save transaction.');
        return;
      }

      Alert.alert('Success', 'Transaction saved.');
      router.replace('/(tabs)/budget');
    } catch (err) {
      console.error('Error saving:', err);
      Alert.alert('Error', 'Could not save transaction.');
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#1b0d30', '#2d0c53']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleRedirect} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {type === 'income' ? 'New Income' : 'New Expense'}
              </Text>
              <Text style={styles.headerSubtitle}>Log it to keep budgets fresh</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.typePill}>
            <Ionicons
              name={type === 'income' ? 'trending-up' : 'card-outline'}
              size={18}
              color={type === 'income' ? '#34d399' : '#f472b6'}
            />
            <Text
              style={[
                styles.typePillText,
                { color: type === 'income' ? '#34d399' : '#f472b6' },
              ]}
            >
              {type === 'income' ? 'Income' : 'Expense'}
            </Text>
          </View>

          <View style={styles.card}>
            <LabeledInput
              label="Amount"
              icon="cash-outline"
              keyboardType="numeric"
              placeholder="$0.00"
              value={amount}
              onChangeText={setAmount}
            />

            <LabeledInput
              label="Category"
              icon="pricetag-outline"
              placeholder="Groceries, Salary, Rent…"
              value={category}
              onChangeText={(text) => setCategory(text)}
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
                    <Text style={{ color: '#e5e7eb' }}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 120, marginBottom: 12 }}
              />
            )}

            <LabeledInput
              label="Note (optional)"
              icon="create-outline"
              placeholder="Add a quick note"
              value={note}
              onChangeText={setNote}
            />

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.frequencyRow}>
              {frequencyOptions.map((option) => {
                const selected = frequency === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setFrequency(option)}
                    style={[styles.freqButton, selected && styles.freqButtonSelected]}
                  >
                    <Text
                      style={[
                        styles.freqButtonText,
                        selected && styles.freqButtonTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {type === 'expense' && frequency === 'monthly' && (
              <LabeledInput
                label="Due day"
                icon="calendar-outline"
                placeholder="Enter due day (1-31)"
                value={dueDay}
                keyboardType="numeric"
                onChangeText={setDueDay}
              />
            )}
          </View>

          <TouchableOpacity onPress={handleSave} style={styles.button}>
            <LinearGradient
              colors={['#a855f7', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonInner}
            >
              <Text style={styles.buttonText}>Save</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const LabeledInput = ({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'numeric' | 'default';
}) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={18} color="#cbd5e1" style={{ marginRight: 10 }} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 70,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    color: '#f8fafc',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#e5e7eb',
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 8,
  },
  freqButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  freqButtonSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderColor: 'rgba(168, 85, 247, 0.7)',
  },
  freqButtonText: {
    color: '#e5e7eb',
    textTransform: 'capitalize',
  },
  freqButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    marginBottom: 6,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  typePillText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
