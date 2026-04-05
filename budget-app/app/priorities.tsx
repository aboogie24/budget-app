import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type Priority = {
  id: string;
  user_id: string;
  household_id?: string;
  title: string;
  rank: number;
  notes: string;
  is_shared: boolean;
};

export default function PrioritiesScreen() {
  const router = useRouter();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Priority | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const loadPriorities = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<Priority[]>('/auth/priorities', { user_id: userId });
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      setPriorities(list);
      setError(null);
    } catch (e) {
      console.error('Failed to load priorities:', e);
      setError('Failed to load priorities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPriorities();
  }, [loadPriorities]);

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setEditing(null);
  };

  const openEdit = (p: Priority) => {
    setEditing(p);
    setTitle(p.title);
    setNotes(p.notes || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }

    const payload = {
      user_id: userId,
      title: title.trim(),
      rank: editing ? editing.rank : priorities.length + 1,
      notes: notes.trim(),
      is_shared: false,
    };

    try {
      if (editing) {
        await api.put(`/auth/priorities/${editing.id}`, payload);
      } else {
        await api.post('/auth/priorities', payload);
      }
      setShowForm(false);
      resetForm();
      loadPriorities();
    } catch (e) {
      console.error('Save priority error:', e);
      Alert.alert('Error', 'Failed to save priority.');
    }
  };

  const handleDelete = (p: Priority) => {
    Alert.alert('Delete Priority', `Remove "${p.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/priorities/${p.id}`);
            loadPriorities();
          } catch (e) {
            console.error('Delete priority error:', e);
            Alert.alert('Error', 'Failed to delete priority.');
          }
        },
      },
    ]);
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= priorities.length) return;

    const reordered = [...priorities];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setPriorities(reordered);

    try {
      await api.patch('/auth/priorities/reorder', {
        order: reordered.map((p) => p.id),
      });
    } catch (e) {
      console.error('Reorder error:', e);
      loadPriorities();
    }
  };

  const rankColor = (rank: number) => {
    if (rank === 1) return '#fbbf24';
    if (rank === 2) return '#94a3b8';
    if (rank === 3) return '#cd7f32';
    return '#64748b';
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.navigate('/(tabs)/goals' as any)} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Financial Priorities</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Ionicons name="add-circle" size={28} color="#c084fc" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Rank what matters most to keep your spending aligned with your goals.
          </Text>

          {error && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                loadPriorities();
              }}
            />
          )}

          {!error && loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : !error && priorities.length === 0 ? (
            <EmptyState
              icon="flag-outline"
              title="No priorities set"
              description="Define your financial priorities to stay focused on what matters"
              actionLabel="Add Priority"
              onAction={() => {
                resetForm();
                setShowForm(true);
              }}
            />
          ) : (
            priorities.map((p, index) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={[styles.rankBadge, { borderColor: rankColor(p.rank) }]}>
                    <Text style={[styles.rankText, { color: rankColor(p.rank) }]}>
                      #{p.rank}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.cardTitle}>{p.title}</Text>
                    {p.notes ? <Text style={styles.notesText}>{p.notes}</Text> : null}
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      style={{ opacity: index === 0 ? 0.3 : 1 }}
                    >
                      <Ionicons name="chevron-up" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveItem(index, 'down')}
                      disabled={index === priorities.length - 1}
                      style={{ opacity: index === priorities.length - 1 ? 0.3 : 1 }}
                    >
                      <Ionicons name="chevron-down" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(p)} style={styles.actionBtn}>
                    <Ionicons name="pencil" size={14} color="#c084fc" />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(p)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={14} color="#f472b6" />
                    <Text style={[styles.actionText, { color: '#f472b6' }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editing ? 'Edit Priority' : 'New Priority'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <Ionicons name="close" size={24} color="#cbd5e1" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Pay off student loans"
                placeholderTextColor="#94a3b8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Why is this important?"
                placeholderTextColor="#94a3b8"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <LinearGradient
                  colors={['#a855f7', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnInner}
                >
                  <Text style={styles.saveBtnText}>
                    {editing ? 'Update' : 'Add Priority'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
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
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rankText: { fontWeight: '800', fontSize: 14 },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  notesText: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  actions: { gap: 2 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: '#c084fc', fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  emptySubtext: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  label: { color: '#e5e7eb', fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 15,
  },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20, marginBottom: 20 },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
