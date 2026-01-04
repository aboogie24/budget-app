import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';

export default function HouseholdSetup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  const handleCreate = async () => {
    const user = await getCurrentUser();
    if (!user?.id) {
      Alert.alert('Missing session', 'Please log in again.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Add a name', 'Please enter a household name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/households`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, name: name.trim(), invitee_email: invite.trim() || undefined }),
      });
      if (!res.ok) {
        throw new Error(`Create failed ${res.status}`);
      }
      Alert.alert('Household created', 'You can manage invites from Settings.');
      router.replace('/register');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not create household right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#371160', '#2b0f50']} style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/settings')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Set Up Your Household</Text>
        <Text style={styles.subtitle}>Give your shared space a name and invite your partner.</Text>

        <Text style={styles.label}>Household Name</Text>
        <TextInput
          placeholder="e.g., The Johnsons, Casa del Amor"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Invite Partner (optional)</Text>
        <View style={styles.inviteRow}>
          <TextInput
            placeholder="partner@email.com"
            placeholderTextColor="#9ca3af"
            value={invite}
            onChangeText={setInvite}
            style={[styles.input, { flex: 1, marginBottom: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleCreate} disabled={submitting}>
            <Ionicons name="paper-plane" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={submitting}>
          <Text style={styles.primaryBtnText}>{submitting ? 'Creating...' : 'Create Household'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.skip} onPress={() => router.replace('/register')}>
        <Text style={styles.skipText}>Skip for Now</Text>
      </TouchableOpacity>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.dot, i === 3 && styles.dotActive]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  topBar: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: { marginTop: 12 },
  title: { color: '#e5e7eb', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#cbd5e1', fontSize: 14, marginBottom: 20 },
  label: { color: '#e5e7eb', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#f8fafc',
    marginBottom: 12,
  },
  inviteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  sendBtn: {
    backgroundColor: '#b26ef8',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  primaryBtn: {
    backgroundColor: '#b26ef8',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  skip: {
    alignSelf: 'center',
    backgroundColor: '#b26ef8',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: '90%',
    alignItems: 'center',
  },
  skipText: { color: '#fff', fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 8, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#6b7280' },
  dotActive: { backgroundColor: '#b26ef8', width: 12 },
});
