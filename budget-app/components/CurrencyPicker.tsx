import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CURRENCIES, Currency } from '@/utils/currency';

interface CurrencyPickerProps {
  visible: boolean;
  onSelect: (currency: Currency) => void;
  onClose: () => void;
  selectedCode?: string;
}

export default function CurrencyPicker({
  visible,
  onSelect,
  onClose,
  selectedCode,
}: CurrencyPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCurrencies = useMemo(() => {
    if (!searchQuery.trim()) {
      return CURRENCIES;
    }
    const query = searchQuery.toLowerCase();
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = (currency: Currency) => {
    onSelect(currency);
    setSearchQuery('');
    onClose();
  };

  const renderCurrencyItem = ({ item }: { item: Currency }) => {
    const isSelected = item.code === selectedCode;
    return (
      <TouchableOpacity
        style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.currencyContent}>
          <View style={styles.currencySymbol}>
            <Text style={styles.symbol}>{item.symbol}</Text>
          </View>
          <View style={styles.currencyInfo}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.name}>{item.name}</Text>
          </View>
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color="#c084fc" />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#0f172a', '#1a2e5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="chevron-down" size={24} color="#cbd5e1" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Currency</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={18}
              color="#94a3b8"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search currencies..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Currency List */}
          <FlatList
            data={filteredCurrencies}
            renderItem={renderCurrencyItem}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {filteredCurrencies.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color="#64748b" />
              <Text style={styles.emptyText}>No currencies found</Text>
            </View>
          )}
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#f1f5f9',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  currencyItemSelected: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  currencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#c084fc',
  },
  currencyInfo: {
    flex: 1,
  },
  code: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  name: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
});
