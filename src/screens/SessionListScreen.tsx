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
import { SPORE_GO_LOGO } from '../utils/logo';
import AsciiBackground from '../components/AsciiBackground';

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

  // Synthetic Main Agent row — always present, pinned at the top.
  // Keyed off `dm:<username>` to match the server's webapp session keying
  // (see chat.js _currentSessionKeyForPlan).
  const mainAgent: Session | null = credentials ? {
    key: 'dm:' + credentials.username,
    project: 'main agent',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    messageCount: 0,
    active: true,
  } : null;

  const active = sessions.filter(s => s.active);
  const recent = sessions.filter(s => !s.active).slice(0, 20);

  const renderItem = ({ item }: { item: Session }) => {
    const created = new Date(item.created + (item.created.includes('Z') ? '' : 'Z'));
    const dateStr = created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return (
      <TouchableOpacity style={st.row} onPress={() => dispatch({ type: 'SELECT_SESSION', session: item })}>
        <View style={{ marginRight: 10 }}>
          <Text style={{ color: item.active ? t.success : t.muted, fontFamily: MONO, fontSize: 14, textAlign: 'center' }}>
            {item.active ? '●' : '○'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
            {item.project}
          </Text>
          <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 10, marginTop: 2 }}>
            {dateStr} {timeStr}  ·  {item.messageCount} msgs  ·  {timeAgo(item.updated)}
          </Text>
        </View>
        <Text style={{ color: item.active ? t.success : t.muted, fontFamily: MONO, fontSize: 10 }}>
          {item.active ? 'live' : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={[st.center, { backgroundColor: t.bg }]}>
      <AsciiBackground color={t.fg} />
      <ActivityIndicator color={t.accent} />
    </View>
  );

  return (
    <View style={[st.container, { backgroundColor: t.bg }]}>
      <AsciiBackground color={t.fg} />
      {/* Header */}
      <View style={[st.header, { borderBottomColor: t.border, backgroundColor: t.bg + 'dd' }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 7, lineHeight: 8.5 }} allowFontScaling={false}>{SPORE_GO_LOGO}</Text>
        </View>
        <View style={{ flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <TouchableOpacity onPress={() => setShowThemes(true)}>
            <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12 }}>[theme]</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await clearCredentials(); dispatch({ type: 'LOGOUT' }); }}>
            <Text style={{ color: t.error, fontFamily: MONO, fontSize: 12 }}>[logout]</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 11, paddingHorizontal: 12, paddingTop: 8 }}>
        {credentials?.username}@{credentials?.serverUrl?.replace(/https?:\/\//, '')}  {sessions.length} sessions
      </Text>

      {error ? <Text style={{ color: t.error, fontFamily: MONO, fontSize: 12, padding: 12 }}>{error}</Text> : null}

      <FlatList data={[...active, ...recent]} keyExtractor={item => item.key} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} />}
        ListHeaderComponent={(
          <>
            {mainAgent ? (
              <TouchableOpacity
                style={[
                  st.mainRow,
                  { borderColor: t.accent, backgroundColor: t.accent + '12' },
                ]}
                onPress={() => dispatch({ type: 'SELECT_SESSION', session: mainAgent })}>
                <View style={{ marginRight: 10 }}>
                  <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 16, textAlign: 'center' }}>★</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    main agent
                  </Text>
                  <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 10, marginTop: 2 }}>
                    web chat · single-session · always live
                  </Text>
                </View>
                <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 9, letterSpacing: 1 }}>
                  MAIN
                </Text>
              </TouchableOpacity>
            ) : null}
            {active.length > 0 ? (
              <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 11, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
                ── active ──
              </Text>
            ) : null}
          </>
        )}
        ListEmptyComponent={
          mainAgent
            ? null
            : <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12, textAlign: 'center', marginTop: 40 }}>no sessions</Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.border, marginHorizontal: 12 }} />}
      />

      {/* Theme picker */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.modalBg}>
            <View style={[st.themePanel, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
              <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 12, marginBottom: 8 }}>┌─ themes {'─'.repeat(22)}┐</Text>
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
                <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12, textAlign: 'center' }}>[close]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 56, paddingBottom: 10, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  // Main agent row — accented border + tinted background to set it apart
  // from the regular CLI sessions below.
  mainRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderWidth: 1, marginHorizontal: 8, marginTop: 12, marginBottom: 4 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  themePanel: { borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 12, paddingBottom: 16, maxHeight: '70%' },
  themeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
});
