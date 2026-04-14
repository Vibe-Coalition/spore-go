import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ScrollView,
  Alert, Pressable,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { PLAN_PREFIX, PLAN_EXECUTE_MSG } from '../utils/plan';
import { formatAnswers } from '../utils/questions';
import { listThemes, THEMES } from '../themes';
import QuestionSheet from '../components/QuestionSheet';
import PlanApprovalSheet from '../components/PlanApprovalSheet';
import { ChatItem } from '../types';

export default function ChatScreen() {
  const { state, dispatch, theme: t, ws } = useApp();
  const {
    currentSession: session, messages, streamBuffer, isGenerating,
    toolStatus, questions, planApproval, planMode, permMode, connState,
  } = state;
  const [input, setInput] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Observe session on mount
  useEffect(() => {
    if (!session || !ws.current) return;
    const check = setInterval(() => {
      if (ws.current && ws.current['ws']?.readyState === WebSocket.OPEN) {
        ws.current.observe(session.key);
        ws.current.requestHistory(session.key);
        clearInterval(check);
      }
    }, 200);
    return () => {
      clearInterval(check);
      ws.current?.unobserve(session?.key || '');
    };
  }, [session?.key]);

  // Auto-scroll
  useEffect(() => {
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, streamBuffer]);

  if (!session) return null;

  // ── Actions ──

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !ws.current) return;
    if (!text) setInput('');
    dispatch({ type: 'SEND_MESSAGE', text: msg });
    const content = planMode ? PLAN_PREFIX + msg : msg;
    ws.current.sendMessage(content, session.key, state.credentials!.username);
  };

  const handleStop = () => ws.current?.stop(session.key);

  const handleClear = () => Alert.alert('Clear Session', 'Clear all messages?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => {
      ws.current?.send({ type: 'chat:clear', sessionId: session.key });
      dispatch({ type: 'CLEAR_MESSAGES' });
    }},
  ]);

  const handleQuestionSubmit = (formatted: string) => {
    dispatch({ type: 'SET_QUESTIONS', questions: null });
    sendMessage(formatted);
  };

  const handlePlanExecute = () => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null });
    dispatch({ type: 'SET_PLAN_MODE', on: false });
    dispatch({ type: 'SEND_MESSAGE', text: '▶ Execute plan' });
    ws.current?.sendMessage(PLAN_EXECUTE_MSG, session.key, state.credentials!.username);
  };

  const handlePlanRevise = (feedback: string) => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null });
    // planMode stays true for revision
    dispatch({ type: 'SEND_MESSAGE', text: feedback });
    ws.current?.sendMessage(
      `[PLAN FEEDBACK: Revise the plan. Stay in plan mode.]\n\n${feedback}`,
      session.key, state.credentials!.username,
    );
  };

  // ── Renderers ──

  const renderItem = ({ item }: { item: ChatItem }) => {
    switch (item.type) {
      case 'user':
        return (
          <View style={[st.bubble, st.userBubble, { backgroundColor: t.accent }]}>
            <Text style={[st.roleLabel, { color: t.bg + 'cc' }]}>{state.credentials?.username}</Text>
            <Text style={[st.msgText, { color: '#fff' }]} selectable>{item.text}</Text>
          </View>
        );
      case 'assistant':
        return (
          <View style={[st.bubble, st.botBubble, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
            <Text style={[st.roleLabel, { color: t.muted }]}>acorn</Text>
            <Text style={[st.msgText, { color: t.fg }]} selectable>{item.text}</Text>
          </View>
        );
      case 'tool': {
        const color = item.status === 'pending' ? t.warning : item.status === 'denied' ? t.error : t.success;
        const icon = item.status === 'pending' ? '⚙' : item.status === 'denied' ? '✗' : '✓';
        return (
          <View style={[st.toolCard, { borderLeftColor: color, backgroundColor: t.bgPanel }]}>
            <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{icon} {item.name}</Text>
            <Text style={{ color: t.fg, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{item.summary}</Text>
            {item.status === 'pending' && (
              <Text style={{ color: t.warning, fontSize: 10, marginTop: 4 }}>Waiting for CLI approval...</Text>
            )}
          </View>
        );
      }
      case 'status':
        return (
          <Text style={[st.statusText, { color: t.muted }]}>{item.text}</Text>
        );
      case 'error':
        return (
          <View style={[st.errorCard, { backgroundColor: t.error + '15', borderLeftColor: t.error }]}>
            <Text style={{ color: t.error, fontSize: 13 }}>{item.text}</Text>
          </View>
        );
    }
  };

  const connColor = connState === 'connected' ? t.success : connState === 'connecting' ? t.warning : t.error;

  return (
    <KeyboardAvoidingView style={[st.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={[st.header, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => dispatch({ type: 'BACK_TO_SESSIONS' })} hitSlop={12}>
          <Text style={{ color: t.accent, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={{ color: t.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{session.project}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
            <View style={[st.dot, { backgroundColor: connColor }]} />
            <Text style={{ color: t.muted, fontSize: 10 }}>{connState}</Text>
          </View>
        </View>
        <TouchableOpacity style={[st.modePill, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]}
          onPress={() => dispatch({ type: 'TOGGLE_PLAN' })}>
          <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontSize: 11, fontWeight: '700' }}>
            {planMode ? 'PLAN' : 'EXEC'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Activity bar */}
      {(toolStatus || isGenerating) && (
        <View style={[st.activityBar, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
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

      {/* Messages */}
      <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderItem}
        contentContainerStyle={st.messageList}
        keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
        ListFooterComponent={streamBuffer ? (
          <View style={[st.bubble, st.botBubble, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
            <Text style={[st.roleLabel, { color: t.muted }]}>acorn</Text>
            <Text style={[st.msgText, { color: t.fg }]} selectable>
              {streamBuffer}<Text style={{ color: t.accent }}>▎</Text>
            </Text>
          </View>
        ) : null}
      />

      {/* Input bar */}
      <View style={[st.inputBar, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>
        {planMode && (
          <View style={[st.planTag, { backgroundColor: t.planLabelBg + '25' }]}>
            <Text style={{ color: t.planLabelBg, fontSize: 10, fontWeight: '600' }}>📋 Plan mode active</Text>
          </View>
        )}
        <View style={st.inputRow}>
          <TouchableOpacity style={[st.actionsBtn, { backgroundColor: t.accent + '20' }]}
            onPress={() => setShowActions(true)}>
            <Text style={{ fontSize: 18 }}>⚡</Text>
          </TouchableOpacity>
          <TextInput style={[st.textInput, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
            placeholder={planMode ? 'Ask to plan...' : 'Message...'}
            placeholderTextColor={t.muted} value={input} onChangeText={setInput}
            onSubmitEditing={() => sendMessage()} returnKeyType="send" blurOnSubmit={false}
            multiline maxLength={10000} />
          <TouchableOpacity style={[st.sendBtn, { backgroundColor: t.accent }, !input.trim() && { opacity: 0.3 }]}
            onPress={() => sendMessage()} disabled={!input.trim()}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Question sheet */}
      {questions && (
        <QuestionSheet questions={questions} onSubmit={handleQuestionSubmit}
          onCancel={() => dispatch({ type: 'SET_QUESTIONS', questions: null })} />
      )}

      {/* Plan approval */}
      {planApproval && (
        <PlanApprovalSheet planText={planApproval} onExecute={handlePlanExecute}
          onRevise={handlePlanRevise} onCancel={() => dispatch({ type: 'SET_PLAN_APPROVAL', text: null })} />
      )}

      {/* Actions panel */}
      {showActions && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowActions(false)}>
          <Pressable style={st.sheetBg} onPress={() => setShowActions(false)}>
            <Pressable style={[st.actionsSheet, { backgroundColor: t.bgPanel }]} onPress={e => e.stopPropagation()}>
              <View style={[st.handle, { backgroundColor: t.muted + '40' }]} />
              <Text style={{ color: t.fg, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Actions</Text>
              <View style={st.grid}>
                <Tile icon={planMode ? '⚡' : '📋'} label={planMode ? 'Execute' : 'Plan'} color={t.accent} bg={t.accent + '18'}
                  onPress={() => { setShowActions(false); dispatch({ type: 'TOGGLE_PLAN' }); }} />
                {isGenerating && <Tile icon="⏹" label="Stop" color={t.error} bg={t.error + '18'}
                  onPress={() => { setShowActions(false); handleStop(); }} />}
                <Tile icon="🗑" label="Clear" color={t.warning} bg={t.warning + '18'}
                  onPress={() => { setShowActions(false); handleClear(); }} />
                <Tile icon={THEMES[state.themeName].icon} label="Theme" color={t.accent2} bg={t.accent2 + '18'}
                  onPress={() => { setShowActions(false); setShowThemes(true); }} />
              </View>
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>PERMISSIONS</Text>
              <View style={st.grid}>
                {(['ask', 'auto', 'yolo'] as const).map(mode => (
                  <Tile key={mode} icon={mode === 'ask' ? '🔒' : mode === 'auto' ? '🔓' : '☠️'}
                    label={mode.charAt(0).toUpperCase() + mode.slice(1)}
                    color={mode === 'yolo' ? t.error : t.fg}
                    bg={permMode === mode ? (mode === 'yolo' ? t.error : t.accent) + '25' : t.muted + '12'}
                    active={permMode === mode}
                    onPress={() => { dispatch({ type: 'SET_PERM_MODE', mode }); setShowActions(false); }} />
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Theme picker */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.sheetBg}>
            <View style={[st.themeSheet, { backgroundColor: t.bgPanel }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: t.fg, fontSize: 20, fontWeight: '700' }}>Themes</Text>
                <TouchableOpacity onPress={() => setShowThemes(false)}>
                  <Text style={{ color: t.accent, fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name]; const active = name === state.themeName;
                  return (
                    <TouchableOpacity key={name}
                      style={[st.themeRow, { borderColor: active ? th.accent : t.border, backgroundColor: th.bg }, active && { borderWidth: 2 }]}
                      onPress={() => { dispatch({ type: 'SET_THEME', name }); setShowThemes(false); }}>
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

function Tile({ icon, label, color, bg, active, onPress }: {
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
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 4 },
  modePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  activityBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1 },
  stopChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  messageList: { padding: 10, paddingBottom: 4 },
  bubble: { borderRadius: 14, padding: 12, marginBottom: 6, maxWidth: '88%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  roleLabel: { fontSize: 9, fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  msgText: { fontSize: 14, lineHeight: 20 },
  toolCard: { borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 6, marginHorizontal: 4 },
  statusText: { fontSize: 11, textAlign: 'center', marginVertical: 3, paddingHorizontal: 16 },
  errorCard: { borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 6, marginHorizontal: 4 },
  inputBar: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 24 : 6 },
  planTag: { paddingHorizontal: 14, paddingVertical: 3 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4 },
  actionsBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  textInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sheetBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  actionsSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
  themeSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '70%' },
  themeRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
