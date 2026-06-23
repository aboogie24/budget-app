import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import {
  fetchAdvisorMemories,
  deleteAdvisorMemory,
  type AdvisorMemory,
} from '../../utils/api';

type MemoryGroup = {
  title: string;
  scope: 'shared' | 'private';
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  items: AdvisorMemory[];
};

export default function AdvisorMemoryScreen() {
  const [memories, setMemories] = useState<AdvisorMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdvisorMemories();
      setMemories(Array.isArray(data?.memories) ? data.memories : []);
    } catch (err) {
      console.error('Error fetching advisor memories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = (mem: AdvisorMemory) => {
    Alert.alert('Forget this?', `The advisor will no longer remember:\n\n"${mem.fact}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAdvisorMemory(mem.id);
            setMemories((prev) => prev.filter((m) => m.id !== mem.id));
          } catch (err) {
            console.error('Failed to delete memory:', err);
            Alert.alert('Error', 'Failed to forget this memory.');
          }
        },
      },
    ]);
  };

  const groups: MemoryGroup[] = [
    {
      title: 'Shared',
      scope: 'shared',
      icon: 'people-outline',
      subtitle: 'Both partners can see these',
      items: memories.filter((m) => m.scope === 'shared'),
    },
    {
      title: 'Private to you',
      scope: 'private',
      icon: 'lock-closed-outline',
      subtitle: 'Only you — never shown to your partner',
      items: memories.filter((m) => m.scope === 'private'),
    },
  ].filter((g) => g.items.length > 0);

  const renderItem = (mem: AdvisorMemory) => (
    <View key={mem.id} style={styles.memoryCard}>
      <Text style={styles.memoryText}>{mem.fact}</Text>
      <TouchableOpacity
        onPress={() => handleDelete(mem)}
        style={styles.deleteBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={16} color="#f87171" />
      </TouchableOpacity>
    </View>
  );

  const renderGroup = ({ item }: { item: MemoryGroup }) => (
    <View style={styles.groupSection}>
      <View style={styles.groupHeader}>
        <View style={styles.groupIconCircle}>
          <Ionicons name={item.icon} size={16} color="#c084fc" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupTitle}>{item.title}</Text>
          <Text style={styles.groupSubtitle}>{item.subtitle}</Text>
        </View>
        <View style={styles.groupCountBadge}>
          <Text style={styles.groupCountText}>{item.items.length}</Text>
        </View>
      </View>
      {item.items.map(renderItem)}
    </View>
  );

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          data={groups}
          keyExtractor={(item) => item.scope}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.headerRow}>
                <BackButton fallback="/(tabs)/settings" color="#c084fc" size={20} />
                <Text style={styles.header}>Advisor Memory</Text>
                <View style={{ width: 40 }} />
              </View>
              <Text style={styles.description}>
                Things your AI advisor remembers about you across conversations. It saves these as
                you chat — forget anything you don't want it to keep.
              </Text>
            </>
          }
          renderItem={renderGroup}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.emptyText}>Loading memory…</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={36} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>Nothing remembered yet</Text>
                <Text style={styles.emptyHint}>
                  As you chat with your advisor, it'll save important facts here.
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  header: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  description: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },

  groupSection: { marginBottom: 22 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  groupIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  groupSubtitle: { color: '#64748b', fontSize: 11, marginTop: 1 },
  groupCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  groupCountText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },

  memoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  memoryText: { flex: 1, color: '#f1f5f9', fontSize: 14, lineHeight: 20 },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
  emptyHint: { color: '#475569', fontSize: 12, textAlign: 'center', paddingHorizontal: 30 },
});
