import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { authenticate, saveCredentials, loadCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { Credentials } from '../types';
import { MONO_FONT as MONO } from '../context/AppContext';
import { ACORN_LOGO } from '../utils/logo';

// ── ASCII rain background ──
// Characters drift down the screen like the Matrix/MJ aesthetic

const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン{}[]<>/\\|=+-_.:;!?#@$%&*~^░▒▓█▄▀';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLS = Math.floor(SCREEN_W / 10);
const ROWS = Math.floor(SCREEN_H / 14);

function AsciiRain({ color, dimColor }: { color: string; dimColor: string }) {
  const [grid, setGrid] = useState<string[][]>([]);
  const drops = useRef<number[]>([]);
  const speeds = useRef<number[]>([]);

  useEffect(() => {
    // Init drops at random positions
    drops.current = Array.from({ length: COLS }, () => Math.floor(Math.random() * ROWS));
    speeds.current = Array.from({ length: COLS }, () => 1 + Math.floor(Math.random() * 3));

    // Init grid with random chars
    const initial: string[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push(Math.random() > 0.7 ? CHARS[Math.floor(Math.random() * CHARS.length)] : ' ');
      }
      initial.push(row);
    }
    setGrid(initial);

    const timer = setInterval(() => {
      setGrid(prev => {
        const next = prev.map(row => [...row]);
        for (let c = 0; c < COLS; c++) {
          drops.current[c] += speeds.current[c];
          if (drops.current[c] >= ROWS) {
            drops.current[c] = 0;
            speeds.current[c] = 1 + Math.floor(Math.random() * 3);
          }
          const r = drops.current[c] % ROWS;
          next[r][c] = CHARS[Math.floor(Math.random() * CHARS.length)];
          // Fade trail
          const trailR = (r - 3 + ROWS) % ROWS;
          if (Math.random() > 0.6) next[trailR][c] = ' ';
        }
        return next;
      });
    }, 120);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {grid.map((row, r) => (
        <Text key={r} style={{ fontFamily: MONO, fontSize: 9, lineHeight: 13, letterSpacing: 1 }} allowFontScaling={false}>
          {row.map((ch, c) => {
            const drop = drops.current[c] % ROWS;
            const dist = (r - drop + ROWS) % ROWS;
            const isHead = dist === 0;
            const isTail = dist < 4;
            return (
              <Text key={c} style={{ color: isHead ? color : isTail ? dimColor : dimColor + '20' }}>
                {ch}
              </Text>
            );
          })}
        </Text>
      ))}
    </View>
  );
}

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
        try {
          const token = await authenticate(saved.serverUrl, saved.username, saved.key);
          const creds = { ...saved, token };
          await saveCredentials(creds);
          dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
        } catch {
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
    if (!url || !username.trim() || !key.trim()) { setError('all fields required'); return; }
    setLoading(true); setError('');
    try {
      const token = await authenticate(url, username.trim(), key.trim());
      const creds: Credentials = { serverUrl: url, username: username.trim(), key: key.trim(), token };
      await saveCredentials(creds);
      dispatch({ type: 'AUTH_SUCCESS', credentials: creds });
    } catch (e: any) { setError(e.message || 'connection failed'); }
    finally { setLoading(false); }
  };

  if (checking) {
    return (
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <AsciiRain color={t.accent} dimColor={t.accent} />
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <AsciiRain color={t.accent} dimColor={t.accent} />
      <KeyboardAvoidingView style={s.formWrap} behavior={'padding'}>
        <View style={[s.card, { borderColor: t.border, backgroundColor: t.bg + 'ee' }]}>
          <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 7, lineHeight: 8.5, textAlign: 'center', marginBottom: 8 }} allowFontScaling={false}>{ACORN_LOGO}</Text>
          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 11, textAlign: 'center', marginBottom: 16 }}>companion</Text>
          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 11, marginBottom: 12 }}>connect to anima server</Text>

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>server:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="http://192.168.1.10:18810" placeholderTextColor={t.muted + '66'}
            value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>user:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="username" placeholderTextColor={t.muted + '66'}
            value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />

          <Text style={[s.label, { color: t.muted, fontFamily: MONO }]}>key:</Text>
          <TextInput style={[s.input, { color: t.fg, borderColor: t.border, backgroundColor: t.bgInput, fontFamily: MONO }]}
            placeholder="acorn_sk_..." placeholderTextColor={t.muted + '66'}
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
});
