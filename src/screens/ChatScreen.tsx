import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ScrollView,
  Alert, Keyboard, Pressable,
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
  const [showActions, setShowActions] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [permMode, setPermMode] = useState<'auto' | 'ask' | 'yolo'>('auto');
  const wsRef = useRef<AcornWebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const streamRef = useRef('');

  // ── WebSocket events ──

  const handleEvent = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'chat:start':
        setIsGenerating(true); streamRef.current = ''; setStreamingText(''); setToolStatus(null); setLastUsage(null);
        break;
      case 'chat:delta':
        streamRef.current += event.text; setStreamingText(streamRef.current);
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
        if (event.usage || event.iterations) setLastUsage({ usage: event.usage, iterations: event.iterations, toolUsage: (event as any).toolUsage });
        streamRef.current = ''; setStreamingText(''); setIsGenerating(false); setToolStatus(null);
        break;
      }
      case 'chat:error':
        setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'assistant', text: `Error: ${event.error}` }]);
        setIsGenerating(false); setStreamingText(''); streamRef.current = '';
        break;
      case 'chat:history':
        if (event.messages?.length) {
          setMessages(event.messages.map((m, i) => ({
            id: `hist-${i}`, role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
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
      case 'tool:pending':
        // Tool awaiting CLI approval — show as system message
        setMessages(prev => [...prev, {
          id: `tool-${event.id}`,
          role: 'assistant' as const,
          text: `⚙ Requesting: ${event.name}\n${event.summary}`,
          _toolPending: true,
        } as any]);
        break;
      case 'tool:resolved':
        // Update the pending tool message
        setMessages(prev => prev.map(m =>
          m.id === `tool-${event.id}`
            ? { ...m, text: m.text.replace('⚙ Requesting:', event.denied ? '✗ Denied:' : '✓ Allowed:'), _toolPending: false } as any
            : m
        ));
        break;
    }
  }, [planMode]);

  useEffect(() => {
    const ws = new AcornWebSocket(credentials.serverUrl, credentials.token!, handleEvent, setConnState);
    wsRef.current = ws; ws.connect();
    const check = setInterval(() => {
      if (ws['ws']?.readyState === WebSocket.OPEN) { ws.observe(session.key); ws.requestHistory(session.key); clearInterval(check); }
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
    Keyboard.dismiss();
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: msg }]);
    wsRef.current.sendMessage(planMode ? PLAN_PREFIX + msg : msg, session.key, credentials.username);
  };

  const handleStop = () => wsRef.current?.stop(session.key);
  const handleClear = () => Alert.alert('Clear Session', 'Clear all messages?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => { wsRef.current?.send({ type: 'chat:clear', sessionId: session.key }); setMessages([]); } },
  ]);
  const handleQuestionSubmit = (formatted: string) => { setQuestions(null); sendMessage(formatted); };
  const handlePlanExecute = () => {
    setPlanApprovalText(null); if (planMode) onTogglePlan();
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: '▶ Execute plan' }]);
    wsRef.current?.sendMessage(PLAN_EXECUTE_MSG, session.key, credentials.username);
  };
  const handlePlanRevise = (feedback: string) => {
    setPlanApprovalText(null);
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: feedback }]);
    wsRef.current?.sendMessage(`[PLAN FEEDBACK: Revise the plan. Stay in plan mode.]\n\n${feedback}`, session.key, credentials.username);
  };

  const showStatus = () => {
    setShowActions(false);
    const statusMsg = `Status: ${credentials.username} · ${connState} · ${planMode ? 'plan' : 'exec'} mode · ${permMode} permissions · ${messages.length} msgs`;
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'assistant', text: statusMsg }]);
  };

  // ── Render ──

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isTool = (item as any)._toolPending !== undefined;

    if (isTool) {
      const pending = (item as any)._toolPending;
      const isDenied = item.text.startsWith('✗');
      const isAllowed = item.text.startsWith('✓');
      const borderColor = pending ? t.warning : isDenied ? t.error : t.success;
      return (
        <View style={[st.toolCard, { borderLeftColor: borderColor, backgroundColor: t.bgPanel }]}>
          <Text style={[st.msgText, { color: t.fg, fontSize: 13 }]}>{item.text}</Text>
          {pending && <Text style={{ color: t.warning, fontSize: 10, marginTop: 4 }}>Waiting for CLI approval...</Text>}
        </View>
      );
    }

    return (
      <View style={[st.bubble, { backgroundColor: isUser ? t.accent : t.bgPanel, borderColor: isUser ? t.accent : t.border }, isUser ? st.userBubble : st.assistantBubble]}>
        <Text style={[st.roleLabel, { color: isUser ? t.bg + 'cc' : t.muted }]}>
          {isUser ? credentials.username : 'acorn'}
        </Text>
        <Text style={[st.msgText, { color: isUser ? '#fff' : t.fg }]} selectable>{item.text}</Text>
      </View>
    );
  };

  const connColor = connState === 'connected' ? t.success : connState === 'connecting' ? t.warning : t.error;

  return (
    <KeyboardAvoidingView style={[st.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View style={[st.header, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ color: t.accent, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={{ color: t.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{session.project}</Text>
          <View style={st.headerMeta}>
            <View style={[st.dot, { backgroundColor: connColor }]} />
            <Text style={{ color: t.muted, fontSize: 10 }}>{connState}</Text>
          </View>
        </View>
        <TouchableOpacity style={[st.modePill, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]} onPress={onTogglePlan}>
          <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontSize: 11, fontWeight: '700' }}>
            {planMode ? 'PLAN' : 'EXEC'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Activity bar ── */}
      {(toolStatus || isGenerating) && (
        <View style={[st.activityBar, { backgroundColor: t.bgHeader + 'dd', borderBottomColor: t.border }]}>
          <Text style={{ color: toolStatus ? t.toolIcon : t.thinking, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {toolStatus
              ? `${toolStatus.status === 'running' ? '⚙' : '✓'} ${toolStatus.tool}${toolStatus.detail ? ` ${toolStatus.detail}` : ''}${toolStatus.durationMs ? ` (${toolStatus.durationMs}ms)` : ''}`
              : '● Generating...'}
          </Text>
          {isGenerating && (
            <TouchableOpacity onPress={handleStop} style={[st.stopChip, { backgroundColor: t.error }]}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderMessage}
        contentContainerStyle={st.messageList}
        keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
        ListFooterComponent={<>
          {streamingText ? (
            <View style={[st.bubble, st.assistantBubble, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
              <Text style={[st.roleLabel, { color: t.muted }]}>acorn</Text>
              <Text style={[st.msgText, { color: t.fg }]} selectable>{streamingText}<Text style={{ color: t.accent }}>▎</Text></Text>
            </View>
          ) : null}
          {lastUsage?.usage && (
            <Text style={[st.usageText, { color: t.usage }]}>
              {(lastUsage.usage.input_tokens || 0).toLocaleString()} in · {(lastUsage.usage.output_tokens || 0).toLocaleString()} out
              {lastUsage.iterations && lastUsage.iterations > 1 ? ` · ${lastUsage.iterations} iters` : ''}
              {lastUsage.toolUsage ? ` · ${Object.values(lastUsage.toolUsage).reduce((a: number, b: number) => a + b, 0)} tools` : ''}
            </Text>
          )}
        </>}
      />

      {/* ── Input bar ── */}
      <View style={[st.inputBar, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>
        {planMode && (
          <View style={[st.planTag, { backgroundColor: t.planLabelBg + '25' }]}>
            <Text style={{ color: t.planLabelBg, fontSize: 10, fontWeight: '600' }}>📋 Plan mode active</Text>
          </View>
        )}
        <View style={st.inputRow}>
          {/* Actions button */}
          <TouchableOpacity style={[st.actionsBtn, { backgroundColor: t.accent + '20' }]}
            onPress={() => setShowActions(true)}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[st.textInput, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
            placeholder={planMode ? 'Ask to plan...' : 'Message...'}
            placeholderTextColor={t.muted}
            value={input} onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send" blurOnSubmit={false} multiline maxLength={10000}
          />
          <TouchableOpacity
            style={[st.sendBtn, { backgroundColor: t.accent }, !input.trim() && { opacity: 0.3 }]}
            onPress={() => sendMessage()} disabled={!input.trim()}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Actions panel (bottom sheet) ── */}
      {showActions && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowActions(false)}>
          <Pressable style={st.sheetOverlay} onPress={() => setShowActions(false)}>
            <Pressable style={[st.actionsSheet, { backgroundColor: t.bgPanel }]} onPress={e => e.stopPropagation()}>
              <View style={[st.sheetHandle, { backgroundColor: t.muted + '40' }]} />
              <Text style={[st.sheetTitle, { color: t.fg }]}>Actions</Text>

              <View style={st.actionsGrid}>
                <ActionTile icon={planMode ? '⚡' : '📋'} label={planMode ? 'Execute Mode' : 'Plan Mode'}
                  color={t.accent} bg={t.accent + '18'} onPress={() => { setShowActions(false); onTogglePlan(); }} />
                {isGenerating && (
                  <ActionTile icon="⏹" label="Stop" color={t.error} bg={t.error + '18'}
                    onPress={() => { setShowActions(false); handleStop(); }} />
                )}
                <ActionTile icon="🗑" label="Clear Chat" color={t.warning} bg={t.warning + '18'}
                  onPress={() => { setShowActions(false); handleClear(); }} />
                <ActionTile icon={THEMES[themeName].icon} label="Theme" color={t.accent2} bg={t.accent2 + '18'}
                  onPress={() => { setShowActions(false); setShowThemes(true); }} />
                <ActionTile icon="ℹ️" label="Status" color={t.fg} bg={t.muted + '18'} onPress={showStatus} />
              </View>

              <Text style={[st.sectionLabel, { color: t.muted }]}>PERMISSIONS</Text>
              <View style={st.actionsGrid}>
                <ActionTile icon="🔒" label="Ask" active={permMode === 'ask'} color={t.fg} bg={permMode === 'ask' ? t.accent + '25' : t.muted + '12'}
                  onPress={() => { setPermMode('ask'); setShowActions(false); }} />
                <ActionTile icon="🔓" label="Auto" active={permMode === 'auto'} color={t.fg} bg={permMode === 'auto' ? t.accent + '25' : t.muted + '12'}
                  onPress={() => { setPermMode('auto'); setShowActions(false); }} />
                <ActionTile icon="☠️" label="YOLO" active={permMode === 'yolo'} color={t.error} bg={permMode === 'yolo' ? t.error + '25' : t.muted + '12'}
                  onPress={() => { setPermMode('yolo'); setShowActions(false); }} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Modals ── */}
      {questions && <QuestionSheet questions={questions} onSubmit={handleQuestionSubmit} onCancel={() => setQuestions(null)} />}
      {planApprovalText && <PlanApprovalSheet planText={planApprovalText} onExecute={handlePlanExecute} onRevise={handlePlanRevise} onCancel={() => setPlanApprovalText(null)} />}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.sheetOverlay}>
            <View style={[st.themeSheet, { backgroundColor: t.bgPanel }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: t.fg, fontSize: 20, fontWeight: '700' }}>Themes</Text>
                <TouchableOpacity onPress={() => setShowThemes(false)}>
                  <Text style={{ color: t.accent, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name]; const active = name === themeName;
                  return (
                    <TouchableOpacity key={name}
                      style={[st.themeRow, { borderColor: active ? th.accent : t.border, backgroundColor: th.bg }, active && { borderWidth: 2 }]}
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

function ActionTile({ icon, label, color, bg, active, onPress }: {
  icon: string; label: string; color: string; bg: string; active?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[st.tile, { backgroundColor: bg }, active && { borderWidth: 1.5, borderColor: color }]} onPress={onPress}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ color, fontSize: 11, fontWeight: '600', marginTop: 4 }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 54, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1 },
  headerCenter: { flex: 1 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  modePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  activityBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1 },
  stopChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  messageList: { padding: 10, paddingBottom: 4 },
  bubble: { borderRadius: 14, padding: 12, marginBottom: 6, maxWidth: '88%', borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  toolCard: { borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 6, marginHorizontal: 4 },
  roleLabel: { fontSize: 9, fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  msgText: { fontSize: 14, lineHeight: 20 },
  usageText: { fontSize: 10, textAlign: 'center', marginTop: 2, marginBottom: 6 },

  // Input bar
  inputBar: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 24 : 6 },
  planTag: { paddingHorizontal: 14, paddingVertical: 3 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4 },
  actionsBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  textInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  // Action sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  actionsSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },

  // Theme sheet
  themeSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
