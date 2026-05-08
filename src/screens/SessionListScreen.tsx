import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView, Platform,
} from 'react-native';
import { fetchSessions, clearCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { listThemes, THEMES } from '../themes';
import { Session } from '../types';

import { MONO_FONT as MONO } from '../context/AppContext';
import SporeLogo from '../components/SporeLogo';
import GradientBackground from '../components/GradientBackground';
import { BODY_FONT } from '../context/AppContext';
import { SPORE_GO_LOGO } from '../utils/logo';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z')).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function SessionListScreen() {
  const { state, dispatch, theme: t } = useApp();
  const { credentials, sessions } = state;
  const [loading, setLoading] = useState(sessions.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showThemes, setShowThemes] = useState(false);
  const fetchingRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!credentials || fetchingRef.current) return;
    fetchingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else if (sessions.length === 0) setLoading(true);
    try {
      const result = await fetchSessions(credentials);
      dispatch({ type: 'SET_SESSIONS', sessions: result.sessions });
      if (result.credentials.token !== credentials.token) dispatch({ type: 'UPDATE_CREDENTIALS', credentials: result.credentials });
      setError('');
    } catch (e: any) { if (sessions.length === 0) setError(e.message); }
    finally { setLoading(false); setRefreshing(false); fetchingRef.current = false; }
  }, [credentials, sessions.length, dispatch]);

  useEffect(() => { load(); const i = setInterval(() => load(), 10000); return () => clearInterval(i); }, [load]);

  const webGraph = sessions.find(s => s.kind === 'web_graph');
  const codeSessions = sessions.filter(s => s.kind !== 'web_graph' && s.active);
  const sessionRows = [...(webGraph ? [webGraph] : []), ...codeSessions];

  const renderItem = ({ item }: { item: Session }) => {
    const isWeb = item.kind === 'web_graph';
    const safeDate = item.created || new Date().toISOString();
    const created = new Date(safeDate + (safeDate.includes('Z') ? '' : 'Z'));
    const dateStr = created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return (
      <TouchableOpacity style={[st.row, isWeb && { backgroundColor: t.accent + '12' }]} onPress={() => dispatch({ type: 'SELECT_SESSION', session: item })}>
        <View style={{ marginRight: 10 }}>
          <Text style={{ color: isWeb ? t.accent : t.success, fontSize: 14, textAlign: 'center' }}>
            {isWeb ? '◆' : '●'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isWeb ? t.accent : t.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
            {item.title || item.project}
          </Text>
          <Text style={{ color: t.muted, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
            {isWeb ? item.subtitle : `${dateStr} ${timeStr}  ·  ${item.messageCount} msgs  ·  ${timeAgo(item.updated)}`}
          </Text>
        </View>
        <Text style={{ color: isWeb ? t.accent : t.success, fontSize: 10 }}>
          {isWeb ? 'graph' : 'live'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={[st.center, { backgroundColor: t.bg }]}>
      <ActivityIndicator color={t.accent} />
    </View>
  );

  return (
    <GradientBackground theme={t} style={st.container}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: t.border, backgroundColor: t.bg + 'dd' }]}>
        <View style={st.headerBrand}>
          <SporeLogo size={42} color={t.fg} />
          <View>
            <Text style={{ color: t.fg, fontFamily: BODY_FONT, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }}>Spore Go</Text>
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{credentials?.username}@{credentials?.serverUrl.replace(/^https?:\/\//, '')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <TouchableOpacity onPress={() => setShowThemes(true)}>
            <Text style={{ color: t.muted, fontSize: 12 }}>theme</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await clearCredentials(); dispatch({ type: 'LOGOUT' }); }}>
            <Text style={{ color: t.error, fontSize: 12, fontWeight: '700', textTransform: 'lowercase', letterSpacing: 0.6 }}>logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ color: t.muted, fontSize: 11, paddingHorizontal: 12, paddingTop: 8 }}>
        {credentials?.username}@{credentials?.serverUrl?.replace(/https?:\/\//, '')}  web graph + {codeSessions.length} live code
      </Text>

      {error ? <Text style={{ color: t.error, fontSize: 12, padding: 12 }}>{error}</Text> : null}

      <FlatList data={sessionRows} keyExtractor={item => item.key} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} />}
        ListHeaderComponent={sessionRows.length > 0 ? (
          <Text style={{ color: t.accent, fontSize: 11, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
            ── sessions ──
          </Text>
        ) : null}
        ListEmptyComponent={
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>no active sessions</Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.border, marginHorizontal: 12 }} />}
      />

      {/* Theme picker */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.modalBg}>
            <View style={[st.themePanel, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
              <Text style={{ color: t.fg, fontSize: 12, marginBottom: 8 }}>┌─ themes {'─'.repeat(22)}┐</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name]; const isActive = name === state.themeName;
                  return (
                    <TouchableOpacity key={name} style={[st.themeItem, isActive && { backgroundColor: t.accent + '15' }]}
                      onPress={() => { dispatch({ type: 'SET_THEME', name }); setShowThemes(false); }}>
                      <Text style={{ fontFamily: MONO, fontSize: 13, color: isActive ? t.accent : t.fg }}>
                        {isActive ? '▸ ' : '  '}{th.icon} {name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {[th.accent, th.success, th.error].map((c, i) => (
                          <View key={i} style={{ width: 10, height: 10, backgroundColor: c }} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity onPress={() => setShowThemes(false)} style={{ paddingVertical: 10 }}>
                <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>[close]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </GradientBackground>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 6, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderRadius: 16 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  themePanel: { borderWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, paddingBottom: 18, maxHeight: '70%' },
  themeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderRadius: 14 },
});
