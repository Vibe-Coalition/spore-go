import { Platform } from 'react-native';
import { Credentials, Session } from '../types';

const CREDS_KEY = 'spore_go_credentials';

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// SecureStore doesn't work on web — fall back to localStorage
async function _set(key: string, value: string) {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  }
}
async function _get(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}
async function _del(key: string) {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch {}
  } else {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  const { key: _legacyKey, ...clean } = creds;
  await _set(CREDS_KEY, JSON.stringify(clean));
}

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await _get(CREDS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Migrate the old invite-key field into password as a best-effort local upgrade.
    if (!parsed.password && parsed.key) parsed.password = parsed.key;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await _del(CREDS_KEY);
}

export async function checkAuthMetadata(serverUrl: string, token: string): Promise<Pick<Credentials, 'role' | 'userGraphSlug'> & { username?: string }> {
  const res = await fetch(`${serverUrl}/api/auth/check`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: timeoutSignal(8000),
  });
  if (!res.ok) return {};
  const data = await res.json().catch(() => ({}));
  return {
    role: data?.role ? String(data.role) : undefined,
    username: data?.username ? String(data.username) : undefined,
    userGraphSlug: data?.userGraphSlug ? String(data.userGraphSlug) : null,
  };
}

export async function authenticate(serverUrl: string, username: string, password: string): Promise<Credentials> {
  const url = `${serverUrl}/api/spore-code/auth`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: timeoutSignal(8000),
    });
  } catch (e: any) {
    throw new Error(`Can't reach server: ${e.message || 'network error'}`);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Authentication failed');
  }
  const token = String(data.token);
  const metadata: Pick<Credentials, 'role' | 'userGraphSlug'> & { username?: string } = await checkAuthMetadata(serverUrl, token).catch(() => ({}));
  return { serverUrl, username: metadata.username || username, password, token, role: metadata.role, userGraphSlug: metadata.userGraphSlug };
}

/**
 * Re-authenticate using stored credentials and save the new token.
 * Returns updated credentials or null if re-auth fails.
 */
export async function refreshToken(creds: Credentials): Promise<Credentials | null> {
  try {
    const updated = await authenticate(creds.serverUrl, creds.username, creds.password);
    await saveCredentials(updated);
    return updated;
  } catch {
    return null;
  }
}

function webControlSession(creds: Credentials): Session {
  const now = new Date().toISOString();
  const isOperator = creds.role === 'creator' || creds.role === 'admin';
  return {
    key: 'web:control-panel',
    project: 'Web',
    created: now,
    updated: now,
    messageCount: 0,
    active: true,
    kind: 'web_control',
    title: isOperator ? 'Control Panel' : 'My Memory',
    subtitle: isOperator
      ? 'Operator web session'
      : (creds.userGraphSlug ? `Personal memory · ${creds.userGraphSlug}` : 'Personal memory'),
  };
}

function normalizeCodeSession(raw: any): Session {
  const key = String(raw?.key || 'unknown');
  const project = String(raw?.project || key.split('/')[0] || 'Code session');
  return {
    key,
    project,
    created: String(raw?.created || ''),
    updated: String(raw?.updated || raw?.created || ''),
    messageCount: Number(raw?.messageCount ?? raw?.message_count ?? 0),
    active: raw?.active !== false,
    kind: 'code',
    title: project,
    subtitle: key,
  };
}

function normalizeSessions(data: any, creds: Credentials): Session[] {
  const rawSessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const codeSessions = rawSessions
    .map(normalizeCodeSession)
    .filter((s: Session) => s.active !== false);
  return [webControlSession(creds), ...codeSessions];
}

/**
 * Fetch sessions with automatic token refresh on 401.
 * Returns { sessions, credentials } where credentials may have a new token.
 */
export async function fetchSessions(
  creds: Credentials,
): Promise<{ sessions: Session[]; credentials: Credentials }> {
  let res = await fetch(`${creds.serverUrl}/api/spore-code/sessions`, {
    headers: { Authorization: `Bearer ${creds.token}` },
    signal: timeoutSignal(8000),
  });

  // Token expired (server restart clears in-memory tokens) — re-auth
  if (res.status === 401) {
    const refreshed = await refreshToken(creds);
    if (!refreshed) throw new Error('Re-authentication failed');
    creds = refreshed;
    res = await fetch(`${creds.serverUrl}/api/spore-code/sessions`, {
      headers: { Authorization: `Bearer ${creds.token}` },
      signal: timeoutSignal(8000),
    });
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch sessions');
  }
  if (creds.token && (!creds.role || creds.userGraphSlug === undefined)) {
    const metadata: Pick<Credentials, 'role' | 'userGraphSlug'> & { username?: string } = await checkAuthMetadata(creds.serverUrl, creds.token).catch(() => ({}));
    creds = { ...creds, role: metadata.role || creds.role, userGraphSlug: metadata.userGraphSlug ?? creds.userGraphSlug };
    await saveCredentials(creds);
  }
  return { sessions: normalizeSessions(data, creds), credentials: creds };
}
