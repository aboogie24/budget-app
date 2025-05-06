import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { getCurrentUser } from '../../utils/storage';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';
import { router } from 'expo-router';

const API_URL =
  Constants.expoConfig?.extra?.API_URL ??
  Constants.manifest?.extra?.API_URL ??
  'http://localhost:8080';

const presetColors = [
  '#F44336', '#E91E63', '#9C27B0', '#3F51B5', '#2196F3',
  '#009688', '#4CAF50', '#CDDC39', '#FFC107', '#FF5722',
];

export default function CategorySettings() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4CAF50');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const fetchCategories = async () => {

    try {
      const user = await getCurrentUser();
      const res = await fetch(`${API_URL}/categories/user/${user.id}`);
      const data = await res.json();
      const filtered = data.filter((cat) => cat.type === type)
      setCategories(filtered);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [type]);

  const handleReturn = () => {
    router.replace('/(tabs)/settings');
  };

  const handleAddCategory = async () => {
    const currentUser = await getCurrentUser();
    if (!newName) {
      Alert.alert('Missing name', 'Please enter a category name.');
      return;
    }
    try {
      const payload = {
        id: uuidv4(),
        name: newName,
        type,
        user_id: currentUser.id,
        color: newColor,
      };

      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const created = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewName('');
      Alert.alert('Success', 'Category added.');
    } catch (err) {
      console.error('Failed to create category:', err);
      Alert.alert('Error', 'Could not add category.');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Category', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/categories/${id}`, {
              method: 'DELETE',
            });
            if (!res.ok) throw new Error(await res.text());
            setCategories((prev) => prev.filter((c) => c.id !== id));
          } catch (err) {
            console.error('Delete failed:', err);
            Alert.alert('Error', 'Failed to delete category.');
          }
        },
      },
    ]);
  };

  const startEditing = (category: any) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color || '#4CAF50');
  };

  const handleUpdate = async () => {
    try {
      console.log(`${API_URL}/categories/${editingId}`);
      const res = await fetch(`${API_URL}/categories/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      if (!res.ok) throw new Error(await res.text());

      const updated = await res.json();
      setCategories((prev) =>
        prev.map((c) => (c.id === editingId ? updated : c))
      );
      setEditingId(null);
    } catch (err) {
      console.error('Update failed:', err);
      Alert.alert('Error', 'Failed to update category.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <>
            <Text style={styles.header}>Manage {type} Categories</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, type === 'expense' && styles.toggleSelected]}
                onPress={() => setType('expense')}
              >
                <Text style={type === 'expense' ? styles.selectedText : styles.text}>Expenses</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, type === 'income' && styles.toggleSelected]}
                onPress={() => setType('income')}
              >
                <Text style={type === 'income' ? styles.selectedText : styles.text}>Income</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.categoryRow}>
            <View style={[styles.colorDot, { backgroundColor: item.color || '#ccc' }]} />
            {editingId === item.id ? (
              <View style={{ flex: 1 }}>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={styles.input}
                />
                <View style={styles.colorGrid}>
                  {presetColors.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setEditColor(color)}
                      style={[styles.colorBox, {
                        backgroundColor: color,
                        borderWidth: editColor === color ? 2 : 0,
                      }]}
                    />
                  ))}
                </View>
                <TouchableOpacity onPress={handleUpdate} style={[styles.button, { marginTop: 4 }]}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={{ flex: 1 }}>{item.name}</Text>
                <TouchableOpacity onPress={() => startEditing(item)}>
                  <Text style={{ marginRight: 16, color: '#2196F3' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={{ color: '#E53935' }}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        ListFooterComponent={
          <View style={{ marginBottom: 40 }}>
            <Text style={styles.subHeader}>Add New Category</Text>
            <TextInput
              placeholder="Category name"
              value={newName}
              onChangeText={setNewName}
              style={styles.input}
            />
            <Text style={styles.label}>Pick a color</Text>
            <View style={styles.colorGrid}>
              {presetColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewColor(color)}
                  style={[styles.colorBox, {
                    backgroundColor: color,
                    borderWidth: newColor === color ? 2 : 0,
                  }]}
                />
              ))}
            </View>
            <View style={{ gap: 12 }}>
              <TouchableOpacity style={styles.button} onPress={handleAddCategory}>
                <Text style={styles.buttonText}>Add Category</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonBack} onPress={handleReturn}>
                <Text style={styles.buttonText}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: { padding: 20, backgroundColor: 'white' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  subHeader: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    marginBottom: 16,
    paddingVertical: 8,
  },
  label: { fontWeight: 'bold', marginBottom: 8 },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  colorBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 10,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonBack: {
    backgroundColor: '#FF0000',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  toggleRow: { flexDirection: 'row', marginBottom: 20 },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#ccc',
  },
  toggleSelected: {
    borderColor: '#4CAF50',
  },
  text: { color: '#888' },
  selectedText: { color: '#4CAF50', fontWeight: 'bold' },
});
