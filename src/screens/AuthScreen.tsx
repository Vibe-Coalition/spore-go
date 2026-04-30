import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import AsciiBackground from '../components/AsciiBackground';
import { webLogin, saveCredentials, loadCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { Credentials } from '../types';
import { MONO_FONT as MONO } from '../context/AppContext';
import { SPORE_GO_LOGO } from '../utils/logo';

// Single-mode auth: webapp username + password. The returned session id
// is good for both /api/auth/check (web agent chat) AND
// /api/spore-code/sessions (CLI session list) — server-side, both endpoints
// look up the same _sessions Map (web.js: const _sessions = this._webSessions).
export default function AuthScreen() {
  const { dispatch, theme: t } = useApp();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await loadCredentials();
      if (saved?.key && saved?.serverUrl) {
        try {
          const token = await webLogin(saved.serverUrl, saved.username, saved.key);
          const creds: Credentials = { ...saved, token, mode: 'web' };
          await saveCredentials(creds);
          dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
        } catch {
          setServerUrl(saved.serverUrl);
          setUsername(saved.username);
          setPassword(saved.key);
        }
      }
      setChecking(false);
    })();
  }, []);

  const handleConnect = async () => {
    const url = serverUrl.trim().replace(/\/+$/, '');
    if (!url || !username.trim() || !password.trim()) { setError('all fields required'); return; }
    setLoading(true); setError('');
    try {
      const token = await webLogin(url, username.trim(), password.trim());
      const creds: Credentials = { serverUrl: url, username: username.trim(), key: password.trim(), token, mode: 'web' };
      await saveCredentials(creds);
      dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
    } catch (e: any) { setError(e.message || 'connection failed'); }
    finally { setLoading(false); }
  };

  if (checking) {
    return (
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <AsciiBackground color={t.fg} />
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <AsciiBackground color={t.fg} />
      <KeyboardAvoidingView style={s.formWrap} behavior="padding">
        <View style={[s.card, { borderColor: t.border, backgroundColor: t.bg + 'f0' }]}>
          <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 7, lineHeight: 8.5, textAlign: 'center', marginBottom: 8 }} allowFontScaling={false}>{SPORE_GO_LOGO}</Text>
          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 11, textAlign: 'center', marginBottom: 16 }}>on the go</Text>
          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 11, marginBottom: 12 }}>connect to spore core server</Text>

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>server:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="http://192.168.1.10:18810" placeholderTextColor={t.muted + '66'}
            value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>user:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="username" placeholderTextColor={t.muted + '66'}
            value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>password:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="password" placeholderTextColor={t.muted + '66'}
            value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} secureTextEntry />

          {error ? <Text style={{ color: t.error, fontFamily: MONO, fontSize: 11, marginBottom: 8 }}>✗ {error}</Text> : null}

          <TouchableOpacity style={[s.btn, { borderColor: t.accent }, loading && { opacity: 0.5 }]}
            onPress={handleConnect} disabled={loading}>
            {loading
              ? <ActivityIndicator color={t.accent} size="small" />
              : <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 13 }}>[connect]</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  formWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, padding: 20, borderWidth: 1 },
  label: { fontSize: 11, marginBottom: 4 },
  input: { borderWidth: 1, padding: 10, fontSize: 13, marginBottom: 12 },
  btn: { borderWidth: 1, padding: 12, alignItems: 'center', marginTop: 4 },
});
