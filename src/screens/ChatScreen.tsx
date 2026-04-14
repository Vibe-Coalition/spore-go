import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AcornWebSocket } from '../services/websocket';
import { Credentials, Session, ChatMessage, WsEvent, ConnectionState, ToolStatus } from '../types';

interface Props {
  credentials: Credentials;
  session: Session;
  onBack: () => void;
}

let msgId = 0;

export default function ChatScreen({ credentials, session, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [input, setInput] = useState('');
  const wsRef = useRef<AcornWebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const streamRef = useRef('');

  const handleEvent = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'chat:start':
        setIsGenerating(true);
        streamRef.current = '';
        setStreamingText('');
        setToolStatus(null);
        break;

      case 'chat:delta':
        streamRef.current += event.text;
        setStreamingText(streamRef.current);
        break;

      case 'chat:done': {
        const finalText = streamRef.current || event.text || '';
        if (finalText.trim()) {
          setMessages(prev => [...prev, {
            id: `msg-${++msgId}`,
            role: 'assistant',
            text: finalText,
            timestamp: new Date().toISOString(),
          }]);
        }
        streamRef.current = '';
        setStreamingText('');
        setIsGenerating(false);
        setToolStatus(null);
        break;
      }

      case 'chat:error':
        setMessages(prev => [...prev, {
          id: `msg-${++msgId}`,
          role: 'assistant',
          text: `Error: ${event.error}`,
        }]);
        setIsGenerating(false);
        setStreamingText('');
        streamRef.current = '';
        break;

      case 'chat:history':
        if (event.messages?.length) {
          const history = event.messages.map((m, i) => ({
            id: `hist-${i}`,
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            text: m.text,
            timestamp: m.ts,
          }));
          setMessages(history);
        }
        break;

      case 'chat:status':
        if (event.status === 'tool_exec_start') {
          setToolStatus({ tool: event.tool || '', detail: event.detail, status: 'running' });
        } else if (event.status === 'tool_exec_done') {
          setToolStatus(prev => prev ? { ...prev, status: 'done', durationMs: event.durationMs } : null);
          setTimeout(() => setToolStatus(null), 2000);
        } else if (event.status === 'thinking_start') {
          setToolStatus({ tool: 'thinking', status: 'running' });
        } else if (event.status === 'thinking_done') {
          setToolStatus(null);
        }
        break;

      case 'session:observe:ok':
        // Connected to session
        break;
    }
  }, []);

  useEffect(() => {
    const ws = new AcornWebSocket(
      credentials.serverUrl,
      credentials.token!,
      handleEvent,
      setConnState,
    );
    wsRef.current = ws;
    ws.connect();

    // Once connected, observe the session and request history
    const checkConnected = setInterval(() => {
      if (ws['ws']?.readyState === WebSocket.OPEN) {
        ws.observe(session.key);
        ws.requestHistory(session.key);
        clearInterval(checkConnected);
      }
    }, 200);

    return () => {
      clearInterval(checkConnected);
      ws.unobserve(session.key);
      ws.disconnect();
    };
  }, [credentials, session.key, handleEvent]);

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, streamingText]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    setInput('');
    setMessages(prev => [...prev, {
      id: `msg-${++msgId}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    }]);
    wsRef.current.sendMessage(text, session.key, credentials.username);
  };

  const handleStop = () => {
    wsRef.current?.stop(session.key);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={styles.roleLabel}>{item.role === 'user' ? credentials.username : 'acorn'}</Text>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  const connColor = connState === 'connected' ? '#22c55e' : connState === 'connecting' ? '#eab308' : '#ef4444';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{session.project}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.connDot, { backgroundColor: connColor }]} />
            <Text style={styles.headerSubtitle}>{connState}</Text>
          </View>
        </View>
        {isGenerating ? (
          <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
            <Text style={styles.stopText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {/* Tool status bar */}
      {toolStatus && (
        <View style={styles.toolBar}>
          <Text style={styles.toolText}>
            {toolStatus.status === 'running' ? '⚙' : '✓'}{' '}
            {toolStatus.tool}
            {toolStatus.detail ? ` ${toolStatus.detail}` : ''}
            {toolStatus.durationMs ? ` (${toolStatus.durationMs}ms)` : ''}
          </Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          streamingText ? (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.roleLabel}>acorn</Text>
              <Text style={styles.messageText}>{streamingText}<Text style={styles.cursor}>▎</Text></Text>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Send a message..."
          placeholderTextColor="#555"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
          maxLength={10000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#141414',
  },
  backBtn: { padding: 8 },
  backText: { color: '#7c3aed', fontSize: 15 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  connDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  headerSubtitle: { color: '#666', fontSize: 11 },
  stopBtn: { backgroundColor: '#ef4444', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  stopText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  toolBar: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  toolText: { color: '#7c3aed', fontSize: 12 },

  messageList: { padding: 12, paddingBottom: 8 },
  bubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: '#7c3aed',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1a1a1a',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#252525',
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: { color: '#e5e5e5', fontSize: 14, lineHeight: 20 },
  cursor: { color: '#7c3aed', fontWeight: '200' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#141414',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
