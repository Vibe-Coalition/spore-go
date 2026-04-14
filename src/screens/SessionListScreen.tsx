import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { fetchSessions, clearCredentials } from '../services/auth';
import { useApp } from '../context/AppContext';
import { listThemes, THEMES } from '../themes';
import { Session } from '../types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z')).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
      if (result.credentials.token !== credentials.token) {
        dispatch({ type: 'UPDATE_CREDENTIALS', credentials: result.credentials });
      }
      setError('');
    } catch (e: any) {
      if (sessions.length === 0) setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [credentials, sessions.length, dispatch]);

  useEffect(() => { load(); const i = setInterval(() => load(), 10000); return () => clearInterval(i); }, [load]);

  const handleLogout = async () => {
    await clearCredentials();
    dispatch({ type: 'LOGOUT' });
  };

  const active = sessions.filter(s => s.active);
  const recent = sessions.filter(s => !s.active).slice(0, 20);
  const all = [...active, ...recent];

  const renderItem = ({ item }: { item: Session }) => (
    <TouchableOpacity style={st.card} onPress={() => dispatch({ type: 'SELECT_SESSION', session: item })}>
      <View style={st.cardRow}>
        <View style={[st.dot, { backgroundColor: item.active ? t.success : t.muted }]} />
        <Text style={[st.project, { color: t.fg }]} numberOfLines={1}>{item.project}</Text>
        <Text style={{ fontSize: 12, color: t.muted }}>{timeAgo(item.updated)}</Text>
      </View>
      <Text style={{ fontSize: 12, color: t.muted, marginTop: 3, marginLeft: 18 }}>
        {item.messageCount} msgs
      </Text>
    </TouchableOpacity>
  );

  if (loading) return <View style={[st.center, { backgroundColor: t.bg }]}><ActivityIndicator size="large" color={t.accent} /></View>;

  return (
    <View style={[st.container, { backgroundColor: t.bg }]}>
      <View style={[st.header, { borderBottomColor: t.border }]}>
        <View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: t.fg }}>Sessions</Text>
          <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{credentials?.username} · {sessions.length} sessions</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowThemes(true)}><Text style={{ fontSize: 22 }}>{THEMES[state.themeName].icon}</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}><Text style={{ color: t.error, fontSize: 14 }}>Logout</Text></TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={{ color: t.error, padding: 16, textAlign: 'center' }}>{error}</Text> : null}

      <FlatList data={all} keyExtractor={item => item.key} renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} />}
        ListHeaderComponent={active.length > 0 ? <Text style={[st.section, { color: t.accent }]}>Active</Text> : null}
        ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>No sessions found</Text>}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.separator, marginHorizontal: 16 }} />}
      />

      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.sheetBg}>
            <View style={[st.sheet, { backgroundColor: t.bgPanel }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: t.fg, fontSize: 20, fontWeight: '700' }}>Themes</Text>
                <TouchableOpacity onPress={() => setShowThemes(false)}><Text style={{ color: t.accent, fontSize: 16 }}>Done</Text></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name]; const isActive = name === state.themeName;
                  return (
                    <TouchableOpacity key={name} style={[st.themeRow, { borderColor: isActive ? th.accent : t.border, backgroundColor: th.bg }, isActive && { borderWidth: 2 }]}
                      onPress={() => { dispatch({ type: 'SET_THEME', name }); setShowThemes(false); }}>
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{th.icon}</Text>
                      <Text style={{ color: th.fg, fontSize: 15, fontWeight: isActive ? '700' : '400', flex: 1 }}>{name}</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[th.accent, th.success, th.error, th.warning].map((c, i) => (
                          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c }} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, borderBottomWidth: 1 },
  section: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  card: { paddingHorizontal: 16, paddingVertical: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  project: { fontSize: 16, fontWeight: '600', flex: 1 },
  sheetBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
