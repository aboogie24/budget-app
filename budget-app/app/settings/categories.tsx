import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/storage';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';
import { router } from 'expo-router';

const API_URL =
  Constants.expoConfig?.extra?.API_URL ??
  Constants.manifest?.extra?.API_URL ??
  'http://localhost:8080';

const PRESET_COLORS = [
  '#7c3aed', '#22c55e', '#ef4444', '#3b82f6', '#06b6d4',
  '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

export default function CategorySettings() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7c3aed');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const fetchCategories = async () => {
    try {
      const user = await getCurrentUser();
      const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : undefined;
      const res = await fetch(`${API_URL}/categories/user/${user.id}`, { headers, credentials: 'include' });
      const data = await res.json();
      setCategories((Array.isArray(data) ? data : []).filter((cat: any) => cat.type === type));
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => { fetchCategories(); }, [type]);

  const handleAddCategory = async () => {
    const currentUser = await getCurrentUser();
    if (!newName.trim()) { Alert.alert('Missing name', 'Please enter a category name.'); return; }
    try {
      const payload = { id: uuidv4(), name: newName.trim(), type, user_id: currentUser.id, color: newColor };
      const headers: any = { 'Content-Type': 'application/json' };
      if (currentUser.token) headers.Authorization = `Bearer ${currentUser.token}`;
      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST', headers, credentials: 'include', body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewName('');
    } catch {
      Alert.alert('Error', 'Could not add category.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Category', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const user = await getCurrentUser();
            const headers: any = {};
            if (user?.token) headers.Authorization = `Bearer ${user.token}`;
            const res = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE', headers, credentials: 'include' });
            if (!res.ok) throw new Error(await res.text());
            setCategories((prev) => prev.filter((c) => c.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete category.');
          }
        },
      },
    ]);
  };

  const startEditing = (category: any) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color || '#7c3aed');
  };

  const handleUpdate = async () => {
    try {
      const user = await getCurrentUser();
      const headers: any = { 'Content-Type': 'application/json' };
      if (user?.token) headers.Authorization = `Bearer ${user.token}`;
      const res = await fetch(`${API_URL}/categories/${editingId}`, {
        method: 'PUT', headers, credentials: 'include',
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      setEditingId(null);
    } catch {
      Alert.alert('Error', 'Failed to update category.');
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#c084fc" />
                </TouchableOpacity>
                <Text style={styles.header}>Categories</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Type toggle */}
              <View style={styles.toggleRow}>
                {(['expense', 'income'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toggle, type === t && styles.toggleActive]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons
                      name={t === 'expense' ? 'cart-outline' : 'cash-outline'}
                      size={16}
                      color={type === t ? '#c084fc' : '#64748b'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={type === t ? styles.toggleTextActive : styles.toggleText}>
                      {t === 'expense' ? 'Expenses' : 'Income'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>
                {categories.length} {type} categor{categories.length !== 1 ? 'ies' : 'y'}
              </Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.catCard}>
              {editingId === item.id ? (
                /* Editing mode */
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    style={styles.input}
                    placeholderTextColor="#475569"
                  />
                  <View style={styles.colorGrid}>
                    {PRESET_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setEditColor(color)}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color },
                          editColor === color && styles.colorSwatchActive,
                        ]}
                      />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* Display mode */
                <View style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: item.color || '#7c3aed' }]} />
                  <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => startEditing(item)} style={styles.actionBtn}>
                    <Ionicons name="create-outline" size={16} color="#c084fc" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={16} color="#f87171" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={32} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>No {type} categories yet</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.addCard}>
              <Text style={styles.sectionLabel}>ADD NEW CATEGORY</Text>
              <TextInput
                placeholder="Category name"
                placeholderTextColor="#475569"
                value={newName}
                onChangeText={setNewName}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setNewColor(color)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      newColor === color && styles.colorSwatchActive,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleAddCategory}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Add Category</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },

  /* Toggle */
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleActive: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderColor: 'rgba(192,132,252,0.3)',
  },
  toggleText: { color: '#64748b', fontWeight: '700' },
  toggleTextActive: { color: '#c084fc', fontWeight: '800' },

  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 10,
  },

  /* Category card */
  catCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catDot: { width: 14, height: 14, borderRadius: 7 },
  catName: { flex: 1, color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Input */
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
  },
  fieldLabel: { color: '#94a3b8', fontWeight: '600', fontSize: 13, marginBottom: 6 },

  /* Colors */
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: '#fff' },

  /* Buttons */
  saveBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: { color: '#94a3b8', fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  /* Add card */
  addCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
});
