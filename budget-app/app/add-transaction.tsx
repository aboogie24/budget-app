import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentUser } from '../utils/storage';
import { api } from '../utils/apiClient';
import { v4 as uuidv4 } from 'uuid';
import { successHaptic, errorHaptic } from '../utils/haptics';
import CategoryPicker from '../components/CategoryPicker';

const frequencyOptions = ['one-time', 'weekly', 'biweekly', 'monthly'];

export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const initialType = (params.type as string) || 'expense';
  const router = useRouter();

  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState('one-time');
  const [dueDay, setDueDay] = useState('');

  // Load user ID on mount and reset category when type changes
  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser?.id) setUserId(currentUser.id);
    };
    loadUser();
  }, []);

  // Reset selected category when type changes
  useEffect(() => {
    setSelectedCategory(null);
  }, [type]);

  const handleRedirect = async () => {
    router.back();
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

    if (!selectedCategory) {
      Alert.alert('Missing category', 'Please select a category.');
      return;
    }

    const transaction = {
      id: uuidv4(),
      user_id: currentUser.id,
      type,
      amount: parseFloat(amount),
      category_id: selectedCategory.id,
      category_name: selectedCategory.name,
      note,
      date: new Date().toISOString(),
      frequency,
      due_day:
        frequency === 'monthly' && type === 'expense' ? parseInt(dueDay) : null,
    };

    try {
      await api.post(`/auth/transactions`, transaction);
      successHaptic();
      Alert.alert('Success', 'Transaction saved.');
      router.back();
    } catch (err) {
      console.error('Error saving:', err);
      errorHaptic();
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
              <Text style={styles.headerTitle}>New Transaction</Text>
              <Text style={styles.headerSubtitle}>Log it to keep budgets fresh</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Type toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeToggleBtn, type === 'expense' && styles.typeToggleBtnActiveExpense]}
              onPress={() => setType('expense')}
            >
              <Ionicons name="card-outline" size={16} color={type === 'expense' ? '#f87171' : '#94a3b8'} />
              <Text style={[styles.typeToggleText, type === 'expense' && { color: '#f87171', fontWeight: '700' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeToggleBtn, type === 'income' && styles.typeToggleBtnActiveIncome]}
              onPress={() => setType('income')}
            >
              <Ionicons name="trending-up" size={16} color={type === 'income' ? '#34d399' : '#94a3b8'} />
              <Text style={[styles.typeToggleText, type === 'income' && { color: '#34d399', fontWeight: '700' }]}>Income</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <LabeledInput
              label="Name"
              icon="text-outline"
              placeholder={type === 'income' ? 'e.g. Paycheck, Freelance gig' : 'e.g. Coffee, Uber, Amazon'}
              value={note}
              onChangeText={setNote}
            />

            <LabeledInput
              label="Amount"
              icon="cash-outline"
              keyboardType="numeric"
              placeholder="$0.00"
              value={amount}
              onChangeText={setAmount}
            />

            <View style={{ marginBottom: 14 }}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => setCategoryPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="pricetag-outline" size={18} color="#cbd5e1" style={{ marginRight: 10 }} />
                <Text
                  style={[
                    styles.input,
                    { paddingVertical: 12 },
                    !selectedCategory && { color: '#94a3b8' },
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategory ? selectedCategory.name : 'Tap to select category'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

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

      {userId ? (
        <CategoryPicker
          visible={categoryPickerVisible}
          onClose={() => setCategoryPickerVisible(false)}
          onSelect={(cat) => {
            setSelectedCategory({ id: cat.id, name: cat.name });
            setCategoryPickerVisible(false);
          }}
          type={type as 'income' | 'expense'}
          userId={userId}
        />
      ) : null}
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
  typeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeToggleBtnActiveExpense: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.3)',
  },
  typeToggleBtnActiveIncome: {
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderColor: 'rgba(52,211,153,0.3)',
  },
  typeToggleText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});
