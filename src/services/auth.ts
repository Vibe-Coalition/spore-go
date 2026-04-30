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

// Single-mode auth: webapp username + password.
// POST /api/auth/login?token=1 { username, password } → { token } (the
// session id, returned in the JSON body for non-browser clients since
// React Native's fetch strips Set-Cookie from response.headers).
//
// The same sid:
//   - authorizes the WS upgrade at /ws?token=<sid>
//   - is accepted as a Bearer on /api/spore-code/sessions (the server's
//     handleSessions plugin no longer requires type==='cli'; any session
//     in the unified _sessions Map with a `user` field is good).
// So one login covers both the main web agent AND the user's CLI session
// list — no second auth round-trip needed.
export async function webLogin(serverUrl: string, username: string, password: string): Promise<string> {
  const url = `${serverUrl}/api/auth/login?token=1`;
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
  let data: any = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Login failed (HTTP ${res.status})`);
  }
  if (!data.token) {
    throw new Error('Server did not return a session token (older server build?)');
  }
  return data.token;
}

/**
 * Re-authenticate using stored credentials and save the new token.
 * Returns updated credentials or null if re-auth fails.
 */
export async function refreshToken(creds: Credentials): Promise<Credentials | null> {
  try {
    const token = await webLogin(creds.serverUrl, creds.username, creds.key);
    const updated = { ...creds, token, mode: 'web' as const };
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
  return { sessions: data.sessions || [], credentials: creds };
}
