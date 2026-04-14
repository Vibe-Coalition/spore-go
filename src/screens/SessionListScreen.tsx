import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { fetchSessions } from '../services/auth';
import { useTheme } from '../context/ThemeContext';
import { listThemes, THEMES } from '../themes';
import { Credentials, Session } from '../types';

interface Props {
  credentials: Credentials;
  onSelectSession: (session: Session) => void;
  onLogout: () => void;
  onTokenRefresh: (creds: Credentials) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z')).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SessionListScreen({ credentials, onSelectSession, onLogout, onTokenRefresh }: Props) {
  const { theme: t, themeName, setThemeName } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showThemes, setShowThemes] = useState(false);

  const loadingRef = useRef(false);
  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return; // prevent overlapping fetches
    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    // Only show full spinner on first load when we have no data
    if (sessions.length === 0 && !isRefresh) setLoading(true);
    setError('');
    try {
      const result = await fetchSessions(credentials);
      setSessions(result.sessions);
      if (result.credentials.token !== credentials.token) {
        onTokenRefresh(result.credentials);
      }
    } catch (e: any) {
      // Only show error if we have no data — silent fail on background refresh
      if (sessions.length === 0) setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [credentials, sessions.length]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 10000);
    return () => clearInterval(interval);
  }, [load]);

  const activeSessions = sessions.filter(s => s.active);
  const recentSessions = sessions.filter(s => !s.active).slice(0, 20);

  const renderSession = ({ item }: { item: Session }) => (
    <TouchableOpacity style={styles.sessionCard} onPress={() => onSelectSession(item)}>
      <View style={styles.sessionHeader}>
        <View style={[styles.dot, { backgroundColor: item.active ? t.success : t.muted }]} />
        <Text style={[styles.projectName, { color: t.fg }]}>{item.project}</Text>
        <Text style={{ fontSize: 12, color: t.muted }}>{timeAgo(item.updated)}</Text>
      </View>
      <Text style={{ fontSize: 12, color: t.muted, marginTop: 4, marginLeft: 18 }}>
        {item.messageCount} msgs  ·  {item.key.split('-').pop()?.slice(0, 8)}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <View>
          <Text style={[styles.title, { color: t.fg }]}>Sessions</Text>
          <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
            {credentials.username} · {sessions.length} sessions
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setShowThemes(true)} style={styles.headerBtn}>
            <Text style={{ fontSize: 20 }}>{t.icon}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} style={styles.headerBtn}>
            <Text style={{ color: t.error, fontSize: 14 }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={{ color: t.error, padding: 16, textAlign: 'center' }}>{error}</Text> : null}

      <FlatList
        data={[...activeSessions, ...recentSessions]}
        keyExtractor={(item) => item.key}
        renderItem={renderSession}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} />
        }
        ListHeaderComponent={
          activeSessions.length > 0 ? (
            <Text style={[styles.sectionHeader, { color: t.accent }]}>Active</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={{ color: t.muted, textAlign: 'center', marginTop: 40, fontSize: 15 }}>No sessions found</Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.separator, marginHorizontal: 16 }} />}
      />

      {/* Theme picker modal */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={styles.themeOverlay}>
            <View style={[styles.themeSheet, { backgroundColor: t.bgPanel }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={[styles.title, { color: t.fg, fontSize: 20 }]}>Themes</Text>
                <TouchableOpacity onPress={() => setShowThemes(false)}>
                  <Text style={{ color: t.muted, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {listThemes().map(name => {
                  const th = THEMES[name];
                  const isActive = name === themeName;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.themeRow,
                        { borderColor: isActive ? th.accent : t.border, backgroundColor: th.bg },
                        isActive && { borderWidth: 2 },
                      ]}
                      onPress={() => setThemeName(name)}
                    >
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 60, borderBottomWidth: 1,
  },
  headerBtn: { padding: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  sectionHeader: {
    fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  sessionCard: { paddingHorizontal: 16, paddingVertical: 14 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  projectName: { fontSize: 16, fontWeight: '600', flex: 1 },
  themeOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  themeSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
