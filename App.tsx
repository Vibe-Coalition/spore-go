import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './src/screens/AuthScreen';
import SessionListScreen from './src/screens/SessionListScreen';
import ChatScreen from './src/screens/ChatScreen';
import { Credentials, Session } from './src/types';
import { clearCredentials } from './src/services/auth';

type Screen = 'auth' | 'sessions' | 'chat';

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const handleAuth = (creds: Credentials) => {
    setCredentials(creds);
    setScreen('sessions');
  };

  const handleLogout = async () => {
    await clearCredentials();
    setCredentials(null);
    setScreen('auth');
  };

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    setScreen('chat');
  };

  const handleBackFromChat = () => {
    setSelectedSession(null);
    setScreen('sessions');
  };

  return (
    <>
      <StatusBar style="light" />
      {screen === 'auth' && (
        <AuthScreen onAuth={handleAuth} />
      )}
      {screen === 'sessions' && credentials && (
        <SessionListScreen
          credentials={credentials}
          onSelectSession={handleSelectSession}
          onLogout={handleLogout}
        />
      )}
      {screen === 'chat' && credentials && selectedSession && (
        <ChatScreen
          credentials={credentials}
          session={selectedSession}
          onBack={handleBackFromChat}
        />
      )}
    </>
  );
}
