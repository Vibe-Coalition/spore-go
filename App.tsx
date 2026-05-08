import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import AuthScreen from './src/screens/AuthScreen';
import SessionListScreen from './src/screens/SessionListScreen';
import ChatScreen from './src/screens/ChatScreen';

function AppContent() {
  const { state, theme } = useApp();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="light" />
      {state.screen === 'auth' && <AuthScreen />}
      {state.screen === 'sessions' && <SessionListScreen />}
      {state.screen === 'chat' && <ChatScreen />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}
