import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ScrollView,
  Alert, LayoutAnimation, UIManager, Keyboard,
} from 'react-native';
import { AcornWebSocket } from '../services/websocket';
import { parseQuestions, Question, formatAnswers } from '../utils/questions';
import { PLAN_PREFIX, PLAN_EXECUTE_MSG, hasPlanReady } from '../utils/plan';
import { useTheme } from '../context/ThemeContext';
import { listThemes, THEMES } from '../themes';
import QuestionSheet from '../components/QuestionSheet';
import PlanApprovalSheet from '../components/PlanApprovalSheet';
import { Credentials, Session, ChatMessage, WsEvent, ConnectionState, ToolStatus, Usage } from '../types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [inputExpanded, setInputExpanded] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const wsRef = useRef<AcornWebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const streamRef = useRef('');

  // ── WebSocket events ──

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
        setIsGenerating(false); setStreamingText(''); streamRef.current = '';
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
        if (event.status === 'tool_exec_start') setToolStatus({ tool: event.tool || '', detail: event.detail, status: 'running' });
        else if (event.status === 'tool_exec_done') { setToolStatus(prev => prev ? { ...prev, status: 'done', durationMs: event.durationMs } : null); setTimeout(() => setToolStatus(null), 2000); }
        else if (event.status === 'thinking_start') setToolStatus({ tool: 'thinking', status: 'running' });
        else if (event.status === 'thinking_done') setToolStatus(null);
        break;
    }
  }, [planMode]);

  useEffect(() => {
    const ws = new AcornWebSocket(credentials.serverUrl, credentials.token!, handleEvent, setConnState);
    wsRef.current = ws;
    ws.connect();
    const check = setInterval(() => {
      if (ws['ws']?.readyState === WebSocket.OPEN) { ws.observe(session.key); ws.requestHistory(session.key); clearInterval(check); }
    }, 200);
    return () => { clearInterval(check); ws.unobserve(session.key); ws.disconnect(); };
  }, [credentials, session.key, handleEvent]);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, streamingText]);

  // Collapse input when keyboard hides
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (inputExpanded && !input.trim()) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setInputExpanded(false);
      }
    });
    return () => sub.remove();
  }, [inputExpanded, input]);

  // ── Actions ──

  const expandInput = () => {
    if (!inputExpanded) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputExpanded(true);
    }
  };

  const collapseInput = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInputExpanded(false);
    Keyboard.dismiss();
  };

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !wsRef.current) return;
    if (!text) setInput('');
    collapseInput();
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: msg }]);
    const content = planMode ? PLAN_PREFIX + msg : msg;
    wsRef.current.sendMessage(content, session.key, credentials.username);
  };

  const handleStop = () => wsRef.current?.stop(session.key);

  const handleClear = () => {
    Alert.alert('Clear Session', 'Clear all messages?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        wsRef.current?.send({ type: 'chat:clear', sessionId: session.key });
        setMessages([]);
      }},
    ]);
  };

  const handleQuestionSubmit = (formatted: string) => { setQuestions(null); sendMessage(formatted); };

  const handlePlanExecute = () => {
    setPlanApprovalText(null);
    if (planMode) onTogglePlan();
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: '▶ Execute plan' }]);
    wsRef.current?.sendMessage(PLAN_EXECUTE_MSG, session.key, credentials.username);
  };

  const handlePlanRevise = (feedback: string) => {
    setPlanApprovalText(null);
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: feedback }]);
    wsRef.current?.sendMessage(`[PLAN FEEDBACK: Revise the plan. Stay in plan mode.]\n\n${feedback}`, session.key, credentials.username);
  };

  // ── Render ──

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.bubble, { backgroundColor: isUser ? t.accent : t.bgPanel, borderColor: isUser ? t.accent : t.border }, isUser ? s.userBubble : s.assistantBubble]}>
        <Text style={[s.roleLabel, { color: isUser ? t.bg + 'cc' : t.muted }]}>
          {isUser ? credentials.username : 'acorn'}
        </Text>
        <Text style={[s.msgText, { color: isUser ? '#fff' : t.fg }]} selectable>{item.text}</Text>
      </View>
    );
  };

  const connColor = connState === 'connected' ? t.success : connState === 'connecting' ? t.warning : t.error;

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ color: t.accent, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={{ color: t.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{session.project}</Text>
          <View style={s.headerMeta}>
            <View style={[s.dot, { backgroundColor: connColor }]} />
            <Text style={{ color: t.muted, fontSize: 10 }}>{connState}</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.modePill, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]} onPress={onTogglePlan}>
          <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontSize: 11, fontWeight: '700' }}>
            {planMode ? 'PLAN' : 'EXEC'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Activity bar ── */}
      {(toolStatus || isGenerating) && (
        <View style={[s.activityBar, { backgroundColor: t.bgHeader + 'dd', borderBottomColor: t.border }]}>
          {toolStatus ? (
            <Text style={{ color: t.toolIcon, fontSize: 12, flex: 1 }} numberOfLines={1}>
              {toolStatus.status === 'running' ? '⚙' : '✓'} {toolStatus.tool}
              {toolStatus.detail ? ` ${toolStatus.detail}` : ''}
              {toolStatus.durationMs ? ` (${toolStatus.durationMs}ms)` : ''}
            </Text>
          ) : (
            <Text style={{ color: t.thinking, fontSize: 12, flex: 1 }}>● Generating...</Text>
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
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => { if (inputExpanded && !input.trim()) collapseInput(); }}
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
                {(lastUsage.usage.input_tokens || 0).toLocaleString()} in · {(lastUsage.usage.output_tokens || 0).toLocaleString()} out
                {lastUsage.iterations && lastUsage.iterations > 1 ? ` · ${lastUsage.iterations} iters` : ''}
                {lastUsage.toolUsage ? ` · ${Object.values(lastUsage.toolUsage).reduce((a: number, b: number) => a + b, 0)} tools` : ''}
              </Text>
            )}
          </>
        }
      />

      {/* ── Composer area ── */}
      <View style={[s.composerWrap, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>

        {/* Quick actions — visible when expanded or always as a compact row */}
        {inputExpanded && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickActions} contentContainerStyle={s.quickActionsContent}>
            <ActionPill icon={planMode ? '⚡' : '📋'} label={planMode ? 'Exec' : 'Plan'} color={t.accent} bg={t.accent + '20'}
              onPress={() => { onTogglePlan(); }} />
            {isGenerating && (
              <ActionPill icon="⏹" label="Stop" color={t.error} bg={t.error + '20'} onPress={handleStop} />
            )}
            <ActionPill icon="🗑" label="Clear" color={t.warning} bg={t.warning + '20'} onPress={handleClear} />
            <ActionPill icon={THEMES[themeName].icon} label="Theme" color={t.accent2} bg={t.accent2 + '20'}
              onPress={() => setShowThemes(true)} />
            {inputExpanded && (
              <ActionPill icon="▾" label="Close" color={t.muted} bg={t.muted + '20'} onPress={collapseInput} />
            )}
          </ScrollView>
        )}

        {/* Plan mode indicator */}
        {planMode && (
          <View style={[s.planBanner, { backgroundColor: t.planLabelBg + '30' }]}>
            <Text style={{ color: t.planLabelBg, fontSize: 11, fontWeight: '600' }}>📋 Plan mode — agent will research and plan, not execute</Text>
          </View>
        )}

        {/* Input row */}
        <View style={s.inputRow}>
          <TextInput
            ref={inputRef}
            style={[
              s.textInput,
              { backgroundColor: t.bgInput, color: t.fg, borderColor: inputExpanded ? t.accent : t.border },
              inputExpanded && { maxHeight: 160, minHeight: 80 },
            ]}
            placeholder={planMode ? 'Ask to plan...' : 'Message...'}
            placeholderTextColor={t.muted}
            value={input}
            onChangeText={setInput}
            onFocus={expandInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            blurOnSubmit={false}
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
      </View>

      {/* ── Modals ── */}
      {questions && (
        <QuestionSheet questions={questions} onSubmit={handleQuestionSubmit} onCancel={() => setQuestions(null)} />
      )}
      {planApprovalText && (
        <PlanApprovalSheet planText={planApprovalText} onExecute={handlePlanExecute} onRevise={handlePlanRevise} onCancel={() => setPlanApprovalText(null)} />
      )}
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
                      style={[s.themeRow, { borderColor: active ? th.accent : t.border, backgroundColor: th.bg }, active && { borderWidth: 2 }]}
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

function ActionPill({ icon, label, color, bg, onPress }: { icon: string; label: string; color: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.pill, { backgroundColor: bg }]} onPress={onPress}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 54, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1,
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
  stopChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },

  // Messages
  messageList: { padding: 10, paddingBottom: 4 },
  bubble: { borderRadius: 14, padding: 12, marginBottom: 6, maxWidth: '88%', borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  roleLabel: { fontSize: 9, fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  msgText: { fontSize: 14, lineHeight: 20 },
  usageText: { fontSize: 10, textAlign: 'center', marginTop: 2, marginBottom: 6 },

  // Composer
  composerWrap: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 24 : 6 },
  quickActions: { maxHeight: 44 },
  quickActionsContent: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  planBanner: { paddingHorizontal: 14, paddingVertical: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4 },
  textInput: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 44, borderWidth: 1,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },

  // Themes
  themeOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  themeSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
