import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { authenticate, saveCredentials, loadCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { Credentials } from '../types';

export default function AuthScreen() {
  const { dispatch, theme: t } = useApp();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await loadCredentials();
      if (saved?.key && saved?.serverUrl) {
        // Try to re-auth with saved creds
        try {
          const token = await authenticate(saved.serverUrl, saved.username, saved.key);
          const creds = { ...saved, token };
          await saveCredentials(creds);
          dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
        } catch {
          // Auth failed — show form with pre-filled fields
          setServerUrl(saved.serverUrl);
          setUsername(saved.username);
          setKey(saved.key);
        }
      }
      setChecking(false);
    })();
  }, []);

  const handleConnect = async () => {
    const url = serverUrl.trim().replace(/\/+$/, '');
    if (!url || !username.trim() || !key.trim()) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await authenticate(url, username.trim(), key.trim());
      const creds: Credentials = { serverUrl: url, username: username.trim(), key: key.trim(), token };
      await saveCredentials(creds);
      dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <View style={[s.container, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.card, { backgroundColor: t.bgPanel }]}>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🌰</Text>
        <Text style={[s.title, { color: t.fg }]}>Acorn Companion</Text>
        <Text style={{ color: t.muted, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Connect to your Anima server</Text>

        <TextInput style={[s.input, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder="Server URL (e.g. http://192.168.1.10:18810)"
          placeholderTextColor={t.muted} value={serverUrl} onChangeText={setServerUrl}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <TextInput style={[s.input, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder="Username" placeholderTextColor={t.muted} value={username} onChangeText={setUsername}
          autoCapitalize="none" autoCorrect={false} />
        <TextInput style={[s.input, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder="Acorn Key" placeholderTextColor={t.muted} value={key} onChangeText={setKey}
          autoCapitalize="none" autoCorrect={false} secureTextEntry />

        {error ? <Text style={{ color: t.error, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text> : null}

        <TouchableOpacity style={[s.btn, { backgroundColor: t.accent }, loading && { opacity: 0.6 }]}
          onPress={handleConnect} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Connect</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 16 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  input: { borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1 },
  btn: { borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
