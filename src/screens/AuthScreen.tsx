import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { authenticate, saveCredentials, loadCredentials, clearCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { Credentials } from '../types';
import SporeLogo from '../components/SporeLogo';
import GradientBackground from '../components/GradientBackground';
import { BODY_FONT } from '../context/AppContext';

export default function AuthScreen() {
  const { dispatch, theme: t } = useApp();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [authCooldownUntil, setAuthCooldownUntil] = useState(0);
  const inFlightAuthRef = useRef(false);

  useEffect(() => {
    (async () => {
      const saved = await loadCredentials();
      if (saved?.serverUrl) setServerUrl(saved.serverUrl);
      if (saved?.username) setUsername(saved.username);
      // Do not automatically re-submit saved passwords. Failed auth is
      // rate-limited server-side, and remount/reload loops can burn attempts.
      if (saved?.password) {
        setPassword(saved.password);
        setError('saved login loaded — tap connect once to authenticate');
      }
      setChecking(false);
    })();
  }, []);

  const handleConnect = async () => {
    if (loading || inFlightAuthRef.current) return;
    const now = Date.now();
    if (authCooldownUntil > now) {
      const seconds = Math.ceil((authCooldownUntil - now) / 1000);
      setError(`too many attempts — wait ${seconds}s before trying again`);
      return;
    }
    const url = serverUrl.trim().replace(/\/+$/, '');
    if (!url || !username.trim() || !password.trim()) { setError('all fields required'); return; }
    inFlightAuthRef.current = true;
    setLoading(true); setError('');
    try {
      const creds = await authenticate(url, username.trim(), password.trim());
      await saveCredentials(creds);
      dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
    } catch (e: any) {
      const message = e.message || 'connection failed';
      if (/too many|rate|429/i.test(message)) {
        setAuthCooldownUntil(Date.now() + 60_000);
        setPassword('');
        await clearCredentials();
      }
      setError(message);
    }
    finally { inFlightAuthRef.current = false; setLoading(false); }
  };

  if (checking) {
    return (
      <GradientBackground theme={t} style={s.container}>
        <ActivityIndicator color={t.accent} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground theme={t} style={s.container}>
      <KeyboardAvoidingView style={s.formWrap} behavior="padding">
        <View style={[s.card, { borderColor: t.border, backgroundColor: t.bg + 'f0' }]}>
          <View style={s.brandWrap}>
            <SporeLogo size={86} color={t.fg} />
            <Text style={[s.brandTitle, { color: t.fg }]}>Spore Go</Text>
            <Text style={[s.brandTagline, { color: t.muted }]}>Memory that goes with you</Text>
          </View>

          <Text style={{ color: t.muted, fontSize: 11, textAlign: 'center', marginBottom: 16 }}>on the go</Text>
          <Text style={{ color: t.muted, fontSize: 11, marginBottom: 12 }}>connect to your spore server</Text>

          <Text style={[s.label, { color: t.muted }]}>server url</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
            placeholder="https://spore.example.com" placeholderTextColor={t.muted + '66'}
            value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

          <Text style={[s.label, { color: t.muted }]}>user</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
            placeholder="username" placeholderTextColor={t.muted + '66'}
            value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />

          <Text style={[s.label, { color: t.muted }]}>password:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput }]}
            placeholder="password" placeholderTextColor={t.muted + '66'}
            value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} secureTextEntry />

          {error ? <Text style={{ color: t.error, fontSize: 11, marginBottom: 8 }}>✗ {error}</Text> : null}

          <TouchableOpacity style={[s.btn, { borderColor: t.accent }, loading && { opacity: 0.5 }]}
            onPress={handleConnect} disabled={loading || authCooldownUntil > Date.now()}>
            {loading
              ? <ActivityIndicator color={t.accent} size="small" />
              : <Text style={{ color: t.accent, fontSize: 13 }}>connect</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  formWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, padding: 24, borderWidth: 1, borderRadius: 18 },
  brandWrap: { alignItems: 'center', marginBottom: 26 },
  brandTitle: { fontFamily: BODY_FONT, marginTop: 14, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  brandTagline: { fontFamily: BODY_FONT, marginTop: 4, fontSize: 13, letterSpacing: 0.1 },
  label: { fontSize: 11, marginBottom: 6, textTransform: 'lowercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginBottom: 14, borderRadius: 12 },
  btn: { borderWidth: 1, padding: 13, alignItems: 'center', marginTop: 6, borderRadius: 999 },
});
