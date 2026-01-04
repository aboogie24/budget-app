import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import * as PlaidLink from 'react-native-plaid-link-sdk';

export default function LinkAccountScreen() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  const fetchLinkToken = async () => {
    const user = await getCurrentUser();
    if (!user?.id) {
      Alert.alert('Session missing', 'Please log in again.');
      router.replace('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/link_token?user_id=${user.id}`, {
        credentials: 'include',
        headers: user.token ? { Authorization: `Bearer ${user.token}` } : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Link token failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      setLinkToken(data.link_token);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(String(e));
      Alert.alert('Error', 'Could not start Plaid Link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkToken();
  }, []);

  // Resolve hook from either named or default export; some bundlers expose it differently.
  const plaidModule: any = PlaidLink;
  const plaidHook =
    plaidModule?.usePlaidLink ||
    plaidModule?.default?.usePlaidLink ||
    (typeof plaidModule === 'function' ? plaidModule : undefined);

  if (typeof plaidHook !== 'function') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Link your bank</Text>
        <Text style={styles.subtitle}>
          Plaid Link SDK is unavailable. Use a development build / physical device with the Plaid SDK installed and rebuilt.
        </Text>
      </View>
    );
  }

  const { open, ready } = plaidHook({
    tokenConfig: linkToken ? { token: linkToken } : undefined,
    noLoadingState: false,
    onSuccess: async (publicToken) => {
      try {
        const res = await fetch(`${API_URL}/exchange_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken }),
        });
        if (!res.ok) throw new Error(`Exchange failed: ${res.status}`);
        Alert.alert('Linked', 'Account linked successfully.');
        router.replace('/(tabs)/dashboard');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not complete linking.');
      }
    },
    onExit: (err) => {
      if (err) console.log('Plaid exit', err);
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Link your bank</Text>
      <Text style={styles.subtitle}>Securely connect your account to sync transactions.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading || !linkToken ? (
        <ActivityIndicator size="large" color="#0f172a" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={() => open()} disabled={!ready}>
          <Text style={styles.buttonText}>{ready ? 'Link with Plaid' : 'Preparing...'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  subtitle: { color: '#475569', marginBottom: 24, fontSize: 14 },
  button: { backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 8 },
});
