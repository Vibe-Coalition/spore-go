import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/context/AppContext';
import AuthScreen from './src/screens/AuthScreen';
import SessionListScreen from './src/screens/SessionListScreen';
import ChatScreen from './src/screens/ChatScreen';

function AppContent() {
  const { state } = useApp();

  return (
    <>
      <StatusBar style="light" />
      {state.screen === 'auth' && <AuthScreen />}
      {state.screen === 'sessions' && <SessionListScreen />}
      {state.screen === 'chat' && <ChatScreen />}
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
