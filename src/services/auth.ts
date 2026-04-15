import { Platform } from 'react-native';
import { Credentials, Session } from '../types';

const CREDS_KEY = 'acorn_credentials';

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
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  }
}

async function _get(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  } else {
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  }
}

async function _del(key: string) {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch {}
  } else {
    const SecureStore = require('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await _set(CREDS_KEY, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await _get(CREDS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await _del(CREDS_KEY);
}

export async function authenticate(serverUrl: string, username: string, key: string): Promise<string> {
  const url = `${serverUrl}/api/acorn/auth`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, key }),
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
  return data.token;
}

/**
 * Re-authenticate using stored credentials and save the new token.
 * Returns updated credentials or null if re-auth fails.
 */
export async function refreshToken(creds: Credentials): Promise<Credentials | null> {
  try {
    const token = await authenticate(creds.serverUrl, creds.username, creds.key);
    const updated = { ...creds, token };
    await saveCredentials(updated);
    return updated;
  } catch {
    return null;
  }
}

/**
 * Fetch sessions with automatic token refresh on 401.
 * Returns { sessions, credentials } where credentials may have a new token.
 */
export async function fetchSessions(
  creds: Credentials,
): Promise<{ sessions: Session[]; credentials: Credentials }> {
  let res = await fetch(`${creds.serverUrl}/api/acorn/sessions`, {
    headers: { Authorization: `Bearer ${creds.token}` },
    signal: timeoutSignal(8000),
  });

  // Token expired (server restart clears in-memory tokens) — re-auth
  if (res.status === 401) {
    const refreshed = await refreshToken(creds);
    if (!refreshed) throw new Error('Re-authentication failed');
    creds = refreshed;
    res = await fetch(`${creds.serverUrl}/api/acorn/sessions`, {
      headers: { Authorization: `Bearer ${creds.token}` },
      signal: timeoutSignal(8000),
    });
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch sessions');
  }
  return { sessions: data.sessions || [], credentials: creds };
}
