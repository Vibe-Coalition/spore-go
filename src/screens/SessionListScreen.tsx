import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { fetchSessions } from '../services/auth';
import { Credentials, Session } from '../types';

interface Props {
  credentials: Credentials;
  onSelectSession: (session: Session) => void;
  onLogout: () => void;
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

export default function SessionListScreen({ credentials, onSelectSession, onLogout }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchSessions(credentials.serverUrl, credentials.token!);
      setSessions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [credentials]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 30000);
    return () => clearInterval(interval);
  }, [load]);

  const activeSessions = sessions.filter(s => s.active);
  const recentSessions = sessions.filter(s => !s.active).slice(0, 20);

  const renderSession = ({ item }: { item: Session }) => (
    <TouchableOpacity style={styles.sessionCard} onPress={() => onSelectSession(item)}>
      <View style={styles.sessionHeader}>
        <View style={[styles.dot, item.active ? styles.dotActive : styles.dotInactive]} />
        <Text style={styles.projectName}>{item.project}</Text>
        <Text style={styles.timeAgo}>{timeAgo(item.updated)}</Text>
      </View>
      <Text style={styles.sessionMeta}>
        {item.messageCount} msgs  ·  {item.key.split('-').pop()?.slice(0, 8)}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sessions</Text>
          <Text style={styles.subtitle}>{credentials.username} · {sessions.length} sessions</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={[...activeSessions, ...recentSessions]}
        keyExtractor={(item) => item.key}
        renderItem={renderSession}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#7c3aed"
          />
        }
        ListHeaderComponent={
          activeSessions.length > 0 ? (
            <Text style={styles.sectionHeader}>Active</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No sessions found</Text>
        }
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#ef4444', fontSize: 14 },
  error: { color: '#ef4444', padding: 16, textAlign: 'center' },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c3aed',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sessionCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  dotActive: { backgroundColor: '#22c55e' },
  dotInactive: { backgroundColor: '#444' },
  projectName: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
  timeAgo: { fontSize: 12, color: '#666' },
  sessionMeta: { fontSize: 12, color: '#555', marginTop: 4, marginLeft: 18 },
  separator: { height: 1, backgroundColor: '#1a1a1a', marginHorizontal: 16 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
});
