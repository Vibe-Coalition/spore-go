import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { authenticate, saveCredentials, loadCredentials, refreshToken } from '../services/auth';
import { useTheme } from '../context/ThemeContext';
import { Credentials } from '../types';

interface Props {
  onAuth: (creds: Credentials) => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const { theme: t } = useTheme();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await loadCredentials();
      if (saved?.key) {
        const refreshed = await refreshToken(saved);
        if (refreshed) {
          onAuth(refreshed);
        } else {
          setServerUrl(saved.serverUrl);
          setUsername(saved.username);
          setKey(saved.key);
        }
      }
      setChecking(false);
    })();
  }, []);

  const handleConnect = async () => {
    const trimmedUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!trimmedUrl || !username.trim() || !key.trim()) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await authenticate(trimmedUrl, username.trim(), key.trim());
      const creds: Credentials = { serverUrl: trimmedUrl, username: username.trim(), key: key.trim(), token };
      await saveCredentials(creds);
      onAuth(creds);
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.card, { backgroundColor: t.bgPanel }]}>
        <Text style={styles.logo}>🌰</Text>
        <Text style={[styles.title, { color: t.fg }]}>Acorn Companion</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>Connect to your Anima server</Text>

        <TextInput
          style={[styles.input, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder="Server URL (e.g. http://192.168.1.10:18810)"
          placeholderTextColor={t.muted}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TextInput
          style={[styles.input, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder="Username"
          placeholderTextColor={t.muted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder="Acorn Key"
          placeholderTextColor={t.muted}
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        {error ? <Text style={[styles.error, { color: t.error }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: t.accent }, loading && { opacity: 0.6 }]}
          onPress={handleConnect}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 16 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  input: { borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1 },
  error: { fontSize: 13, marginBottom: 12, textAlign: 'center' },
  button: { borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
