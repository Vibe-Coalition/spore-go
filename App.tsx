import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/context/ThemeContext';
import AuthScreen from './src/screens/AuthScreen';
import SessionListScreen from './src/screens/SessionListScreen';
import ChatScreen from './src/screens/ChatScreen';
import { Credentials, Session } from './src/types';
import { clearCredentials, saveCredentials } from './src/services/auth';

type Screen = 'auth' | 'sessions' | 'chat';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [planMode, setPlanMode] = useState(false);

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
    setPlanMode(false);
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
          onTokenRefresh={(creds) => { setCredentials(creds); saveCredentials(creds); }}
        />
      )}
      {screen === 'chat' && credentials && selectedSession && (
        <ChatScreen
          credentials={credentials}
          session={selectedSession}
          planMode={planMode}
          onTogglePlan={() => setPlanMode(p => !p)}
          onBack={handleBackFromChat}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
