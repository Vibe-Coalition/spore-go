import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/context/AppContext';
import AuthScreen from './src/screens/AuthScreen';
import SessionListScreen from './src/screens/SessionListScreen';
import ChatScreen from './src/screens/ChatScreen';
import TestScreen from './src/screens/TestScreen';

function AppContent() {
  const { state } = useApp();
  const [showTests, setShowTests] = useState(false);

  if (showTests) {
    return (
      <>
        <StatusBar style="light" />
        <TestScreen onClose={() => setShowTests(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {state.screen === 'auth' && <AuthScreen />}
      {state.screen === 'sessions' && <SessionListScreen onShowTests={() => setShowTests(true)} />}
      {state.screen === 'chat' && <ChatScreen onShowTests={() => setShowTests(true)} />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
