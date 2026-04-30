import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import AsciiBackground from '../components/AsciiBackground';
import { authenticate, webLogin, saveCredentials, loadCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { Credentials, AuthMode } from '../types';
import { MONO_FONT as MONO } from '../context/AppContext';
import { SPORE_GO_LOGO } from '../utils/logo';

export default function AuthScreen() {
  const { dispatch, theme: t } = useApp();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');
  const [mode, setMode] = useState<AuthMode>('cli');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  const authForMode = (m: AuthMode) =>
    m === 'web' ? webLogin : authenticate;

  useEffect(() => {
    (async () => {
      const saved = await loadCredentials();
      if (saved?.key && saved?.serverUrl) {
        const savedMode: AuthMode = saved.mode === 'web' ? 'web' : 'cli';
        try {
          const token = await authForMode(savedMode)(saved.serverUrl, saved.username, saved.key);
          const creds = { ...saved, token, mode: savedMode };
          await saveCredentials(creds);
          dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
        } catch {
          setServerUrl(saved.serverUrl);
          setUsername(saved.username);
          setKey(saved.key);
          setMode(savedMode);
        }
      }
      setChecking(false);
    })();
  }, []);

  const handleConnect = async () => {
    const url = serverUrl.trim().replace(/\/+$/, '');
    if (!url || !username.trim() || !key.trim()) { setError('all fields required'); return; }
    setLoading(true); setError('');
    try {
      const token = await authForMode(mode)(url, username.trim(), key.trim());
      const creds: Credentials = { serverUrl: url, username: username.trim(), key: key.trim(), token, mode };
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

          {/* Mode segmented control: CLI sessions vs main web agent. */}
          <View style={s.segWrap}>
            <TouchableOpacity
              style={[s.segBtn, { borderColor: t.border }, mode === 'cli' && { borderColor: t.accent, backgroundColor: t.accent + '22' }]}
              onPress={() => setMode('cli')}>
              <Text style={{ color: mode === 'cli' ? t.accent : t.muted, fontFamily: MONO, fontSize: 11 }}>cli session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segBtn, { borderColor: t.border }, mode === 'web' && { borderColor: t.accent, backgroundColor: t.accent + '22' }]}
              onPress={() => setMode('web')}>
              <Text style={{ color: mode === 'web' ? t.accent : t.muted, fontFamily: MONO, fontSize: 11 }}>web chat</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 11, marginBottom: 12 }}>
            {mode === 'cli' ? 'connect to spore core (cli sessions)' : 'connect to spore core (main web agent)'}
          </Text>

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>server:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="http://192.168.1.10:18810" placeholderTextColor={t.muted + '66'}
            value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>user:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="username" placeholderTextColor={t.muted + '66'}
            value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>{mode === 'web' ? 'password:' : 'key:'}</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder={mode === 'web' ? 'password' : 'spore_sk_...'} placeholderTextColor={t.muted + '66'}
            value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry />

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
  segWrap: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segBtn: { flex: 1, borderWidth: 1, paddingVertical: 8, alignItems: 'center' },
});
