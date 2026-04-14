import * as SecureStore from 'expo-secure-store';
import { Credentials, Session } from '../types';

const CREDS_KEY = 'acorn_credentials';

export async function saveCredentials(creds: Credentials): Promise<void> {
  await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(CREDS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDS_KEY);
}

export async function authenticate(serverUrl: string, username: string, key: string): Promise<string> {
  const url = `${serverUrl}/api/acorn/auth`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, key }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(data.error || 'Authentication failed');
  }
  return data.token;
}

export async function fetchSessions(serverUrl: string, token: string): Promise<Session[]> {
  const res = await fetch(`${serverUrl}/api/acorn/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch sessions');
  }
  return data.sessions || [];
}
