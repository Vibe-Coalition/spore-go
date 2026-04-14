import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ScrollView, Alert,
} from 'react-native';
import { AcornWebSocket } from '../services/websocket';
import { parseQuestions, Question, formatAnswers } from '../utils/questions';
import { PLAN_PREFIX, PLAN_EXECUTE_MSG, hasPlanReady } from '../utils/plan';
import { useTheme } from '../context/ThemeContext';
import { listThemes, THEMES } from '../themes';
import QuestionSheet from '../components/QuestionSheet';
import PlanApprovalSheet from '../components/PlanApprovalSheet';
import { Credentials, Session, ChatMessage, WsEvent, ConnectionState, ToolStatus, Usage } from '../types';

interface Props {
  credentials: Credentials;
  session: Session;
  planMode: boolean;
  onTogglePlan: () => void;
  onBack: () => void;
}

let msgId = 0;

export default function ChatScreen({ credentials, session, planMode, onTogglePlan, onBack }: Props) {
  const { theme: t, themeName, setThemeName } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [input, setInput] = useState('');
  const [lastUsage, setLastUsage] = useState<{ usage?: Usage; iterations?: number; toolUsage?: Record<string, number> } | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [planApprovalText, setPlanApprovalText] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
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
        setLastUsage(null);
        break;
      case 'chat:delta':
        streamRef.current += event.text;
        setStreamingText(streamRef.current);
        break;
      case 'chat:done': {
        const finalText = streamRef.current || event.text || '';
        if (finalText.trim()) {
          const parsed = parseQuestions(finalText);
          if (parsed.length > 0) {
            setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'assistant', text: finalText }]);
            setQuestions(parsed);
          } else if (planMode && hasPlanReady(finalText)) {
            setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'assistant', text: finalText }]);
            setPlanApprovalText(finalText);
          } else {
            setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'assistant', text: finalText }]);
          }
        }
        if (event.usage || event.iterations) {
          setLastUsage({ usage: event.usage, iterations: event.iterations, toolUsage: (event as any).toolUsage });
        }
        streamRef.current = '';
        setStreamingText('');
        setIsGenerating(false);
        setToolStatus(null);
        break;
      }
      case 'chat:error':
        setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'assistant', text: `Error: ${event.error}` }]);
        setIsGenerating(false);
        setStreamingText('');
        streamRef.current = '';
        break;
      case 'chat:history':
        if (event.messages?.length) {
          setMessages(event.messages.map((m, i) => ({
            id: `hist-${i}`,
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            text: m.text, timestamp: m.ts,
          })));
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
    }
  }, [planMode]);

  useEffect(() => {
    const ws = new AcornWebSocket(credentials.serverUrl, credentials.token!, handleEvent, setConnState);
    wsRef.current = ws;
    ws.connect();
    const check = setInterval(() => {
      if (ws['ws']?.readyState === WebSocket.OPEN) {
        ws.observe(session.key);
        ws.requestHistory(session.key);
        clearInterval(check);
      }
    }, 200);
    return () => { clearInterval(check); ws.unobserve(session.key); ws.disconnect(); };
  }, [credentials, session.key, handleEvent]);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, streamingText]);

  // ── Actions ──

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !wsRef.current) return;
    if (!text) setInput('');
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: msg }]);
    const content = planMode ? PLAN_PREFIX + msg : msg;
    wsRef.current.sendMessage(content, session.key, credentials.username);
  };

  const handleStop = () => wsRef.current?.stop(session.key);

  const handleClear = () => {
    Alert.alert('Clear Session', 'Clear all messages in this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: () => {
          wsRef.current?.send({ type: 'chat:clear', sessionId: session.key });
          setMessages([]);
        },
      },
    ]);
  };

  const handleQuestionSubmit = (formatted: string) => {
    setQuestions(null);
    sendMessage(formatted);
  };

  const handlePlanExecute = () => {
    setPlanApprovalText(null);
    if (planMode) onTogglePlan();
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: '▶ Execute plan' }]);
    wsRef.current?.sendMessage(PLAN_EXECUTE_MSG, session.key, credentials.username);
  };

  const handlePlanRevise = (feedback: string) => {
    setPlanApprovalText(null);
    const msg = `[PLAN FEEDBACK: Revise the plan. Stay in plan mode.]\n\n${feedback}`;
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: feedback }]);
    wsRef.current?.sendMessage(msg, session.key, credentials.username);
  };

  // ── Render ──

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[
        s.bubble,
        { backgroundColor: isUser ? t.accent : t.bgPanel, borderColor: isUser ? t.accent : t.border },
        isUser ? s.userBubble : s.assistantBubble,
      ]}>
        <Text style={[s.roleLabel, { color: isUser ? t.bg + 'cc' : t.muted }]}>
          {isUser ? credentials.username : 'acorn'}
        </Text>
        <Text style={[s.msgText, { color: isUser ? '#fff' : t.fg }]} selectable>{item.text}</Text>
      </View>
    );
  };

  const connColor = connState === 'connected' ? t.success : connState === 'connecting' ? t.warning : t.error;

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: t.accent, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={{ color: t.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{session.project}</Text>
          <View style={s.headerMeta}>
            <View style={[s.dot, { backgroundColor: connColor }]} />
            <Text style={{ color: t.muted, fontSize: 10 }}>{connState}</Text>
          </View>
        </View>

        {/* Mode toggle pill */}
        <TouchableOpacity
          style={[s.modePill, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]}
          onPress={onTogglePlan}
        >
          <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontSize: 11, fontWeight: '700' }}>
            {planMode ? 'PLAN' : 'EXEC'}
          </Text>
        </TouchableOpacity>

        {/* Menu */}
        <TouchableOpacity onPress={() => setShowMenu(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ paddingLeft: 10 }}>
          <Text style={{ color: t.muted, fontSize: 20 }}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* ── Activity bar ── */}
      {(toolStatus || isGenerating) && (
        <View style={[s.activityBar, { backgroundColor: t.bgHeader + 'dd', borderBottomColor: t.border }]}>
          {toolStatus ? (
            <Text style={{ color: t.toolIcon, fontSize: 12 }}>
              {toolStatus.status === 'running' ? '⚙' : '✓'} {toolStatus.tool}
              {toolStatus.detail ? ` ${toolStatus.detail}` : ''}
              {toolStatus.durationMs ? ` (${toolStatus.durationMs}ms)` : ''}
            </Text>
          ) : (
            <Text style={{ color: t.thinking, fontSize: 12 }}>● Generating...</Text>
          )}
          {isGenerating && (
            <TouchableOpacity onPress={handleStop} style={[s.stopChip, { backgroundColor: t.error }]}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={s.messageList}
        ListFooterComponent={
          <>
            {streamingText ? (
              <View style={[s.bubble, s.assistantBubble, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
                <Text style={[s.roleLabel, { color: t.muted }]}>acorn</Text>
                <Text style={[s.msgText, { color: t.fg }]} selectable>
                  {streamingText}<Text style={{ color: t.accent }}>▎</Text>
                </Text>
              </View>
            ) : null}
            {lastUsage?.usage && (
              <Text style={[s.usageText, { color: t.usage }]}>
                {(lastUsage.usage.input_tokens || 0).toLocaleString()} in  ·  {(lastUsage.usage.output_tokens || 0).toLocaleString()} out
                {lastUsage.iterations && lastUsage.iterations > 1 ? `  ·  ${lastUsage.iterations} iters` : ''}
                {lastUsage.toolUsage ? `  ·  ${Object.values(lastUsage.toolUsage).reduce((a: number, b: number) => a + b, 0)} tools` : ''}
              </Text>
            )}
          </>
        }
      />

      {/* ── Input bar ── */}
      <View style={[s.inputBar, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>
        {planMode && (
          <View style={[s.planTag, { backgroundColor: t.planLabelBg }]}>
            <Text style={{ color: t.planLabel, fontSize: 9, fontWeight: '700' }}>PLAN</Text>
          </View>
        )}
        <TextInput
          style={[s.textInput, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder={planMode ? 'Ask to plan...' : 'Message...'}
          placeholderTextColor={t.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          multiline
          maxLength={10000}
        />
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: t.accent }, !input.trim() && { opacity: 0.3 }]}
          onPress={() => sendMessage()}
          disabled={!input.trim()}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* ── Question sheet ── */}
      {questions && (
        <QuestionSheet questions={questions} onSubmit={handleQuestionSubmit} onCancel={() => setQuestions(null)} />
      )}

      {/* ── Plan approval sheet ── */}
      {planApprovalText && (
        <PlanApprovalSheet
          planText={planApprovalText}
          onExecute={handlePlanExecute}
          onRevise={handlePlanRevise}
          onCancel={() => setPlanApprovalText(null)}
        />
      )}

      {/* ── More menu ── */}
      {showMenu && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <View style={[s.menuSheet, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
              <MenuItem icon="🔄" label="Clear session" color={t.fg} onPress={() => { setShowMenu(false); handleClear(); }} />
              <MenuItem icon={planMode ? '⚡' : '📋'} label={planMode ? 'Switch to Execute' : 'Switch to Plan'}
                color={t.fg} onPress={() => { setShowMenu(false); onTogglePlan(); }} />
              <MenuItem icon={THEMES[themeName].icon} label="Change theme" color={t.fg}
                onPress={() => { setShowMenu(false); setShowThemes(true); }} />
              <View style={[s.menuDivider, { backgroundColor: t.border }]} />
              <MenuItem icon="ℹ️" label={`${credentials.username} · ${connState}`} color={t.muted} onPress={() => setShowMenu(false)} />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Theme picker ── */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={s.themeOverlay}>
            <View style={[s.themeSheet, { backgroundColor: t.bgPanel }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: t.fg, fontSize: 20, fontWeight: '700' }}>Themes</Text>
                <TouchableOpacity onPress={() => setShowThemes(false)}>
                  <Text style={{ color: t.accent, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name];
                  const active = name === themeName;
                  return (
                    <TouchableOpacity key={name}
                      style={[s.themeRow, { borderColor: active ? th.accent : t.border, backgroundColor: th.bg },
                        active && { borderWidth: 2 }]}
                      onPress={() => { setThemeName(name); setShowThemes(false); }}>
                      <Text style={{ fontSize: 20, marginRight: 12 }}>{th.icon}</Text>
                      <Text style={{ color: th.fg, fontSize: 15, fontWeight: active ? '700' : '400', flex: 1 }}>{name}</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[th.accent, th.success, th.error, th.warning].map((c, i) => (
                          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c }} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

function MenuItem({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress}>
      <Text style={{ fontSize: 18, marginRight: 12 }}>{icon}</Text>
      <Text style={{ color, fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 54, paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  modePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },

  // Activity
  activityBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1,
  },
  stopChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },

  // Messages
  messageList: { padding: 10, paddingBottom: 4 },
  bubble: { borderRadius: 14, padding: 12, marginBottom: 6, maxWidth: '88%', borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  roleLabel: { fontSize: 9, fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  msgText: { fontSize: 14, lineHeight: 20 },
  usageText: { fontSize: 10, textAlign: 'center', marginTop: 2, marginBottom: 6 },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 8, borderTopWidth: 1,
  },
  planTag: { position: 'absolute', top: -10, left: 16, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, zIndex: 1 },
  textInput: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, borderWidth: 1,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },

  // Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 95, paddingRight: 14 },
  menuSheet: { borderRadius: 14, padding: 6, minWidth: 220, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  menuDivider: { height: 1, marginHorizontal: 12 },

  // Themes
  themeOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  themeSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
