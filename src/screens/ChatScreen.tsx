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

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function ChatScreen() {
  const { state, dispatch, theme: t, ws } = useApp();
  const { currentSession: session, messages, streamBuffer, isGenerating, toolStatus, questions, planApproval, planMode, permMode, connState } = state;
  const [input, setInput] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!session || !ws.current) return;
    const check = setInterval(() => {
      if (ws.current && ws.current['ws']?.readyState === WebSocket.OPEN) {
        ws.current.observe(session.key); ws.current.requestHistory(session.key); clearInterval(check);
      }
    }, 200);
    return () => { clearInterval(check); ws.current?.unobserve(session?.key || ''); };
  }, [session?.key]);

  useEffect(() => {
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, streamBuffer]);

  if (!session) return null;

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !ws.current) return;
    if (!text) setInput('');
    dispatch({ type: 'SEND_MESSAGE', text: msg });
    ws.current.sendMessage(planMode ? PLAN_PREFIX + msg : msg, session.key, state.credentials!.username);
  };

  const handleStop = () => ws.current?.stop(session.key);
  const handleClear = () => Alert.alert('Clear', 'Clear all messages?', [
    { text: 'No', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: () => { ws.current?.send({ type: 'chat:clear', sessionId: session.key }); dispatch({ type: 'CLEAR_MESSAGES' }); } },
  ]);
  const handleQuestionSubmit = (formatted: string) => { dispatch({ type: 'SET_QUESTIONS', questions: null }); sendMessage(formatted); };
  const handlePlanExecute = () => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null }); dispatch({ type: 'SET_PLAN_MODE', on: false });
    dispatch({ type: 'SEND_MESSAGE', text: '▶ Execute plan' });
    ws.current?.sendMessage(PLAN_EXECUTE_MSG, session.key, state.credentials!.username);
  };
  const handlePlanRevise = (feedback: string) => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null }); dispatch({ type: 'SEND_MESSAGE', text: feedback });
    ws.current?.sendMessage(`[PLAN FEEDBACK: Revise the plan. Stay in plan mode.]\n\n${feedback}`, session.key, state.credentials!.username);
  };

  // ── Terminal-style renderers ──

  const renderItem = ({ item }: { item: ChatItem }) => {
    switch (item.type) {
      case 'user':
        return (
          <View style={[st.panel, { borderColor: t.accent }]}>
            <Text style={[st.panelTitle, { color: t.accent, fontFamily: MONO }]}>
              ─ {state.credentials?.username} {'─'.repeat(40)}
            </Text>
            <Text style={[st.panelText, { color: t.fg, fontFamily: MONO }]} selectable>{item.text}</Text>
          </View>
        );
      case 'assistant':
        return (
          <View style={[st.panel, { borderColor: t.border }]}>
            <Text style={[st.panelTitle, { color: t.accent, fontFamily: MONO }]}>
              ─ acorn {'─'.repeat(42)}
            </Text>
            <Text style={[st.panelText, { color: t.fg, fontFamily: MONO }]} selectable>{item.text}</Text>
          </View>
        );
      case 'tool': {
        const color = item.status === 'pending' ? t.warning : item.status === 'denied' ? t.error : t.success;
        const icon = item.status === 'pending' ? '⚙' : item.status === 'denied' ? '✗' : '✓';
        const toolId = item.id.replace('tool-', '');
        return (
          <View style={{ paddingHorizontal: 6, paddingVertical: 3 }}>
            <Text style={{ color, fontFamily: MONO, fontSize: 12 }}>
              {icon} {item.name}: {item.summary}
            </Text>
            {item.status === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, paddingLeft: 16 }}>
                <TouchableOpacity onPress={() => {
                  ws.current?.send({ type: 'tool:approve', id: toolId, allowed: true });
                }}>
                  <Text style={{ color: t.success, fontFamily: MONO, fontSize: 12 }}>[allow]</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  ws.current?.send({ type: 'tool:approve', id: toolId, allowed: false });
                }}>
                  <Text style={{ color: t.error, fontFamily: MONO, fontSize: 12 }}>[deny]</Text>
                </TouchableOpacity>
                <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 10, alignSelf: 'center' }}>waiting for CLI...</Text>
              </View>
            )}
          </View>
        );
      }
      case 'status':
        return <Text style={[st.statusLine, { color: t.muted, fontFamily: MONO }]}>  {item.text}</Text>;
      case 'error':
        return <Text style={[st.statusLine, { color: t.error, fontFamily: MONO }]}>  ✗ {item.text}</Text>;
    }
  };

  const connIcon = connState === 'connected' ? '●' : connState === 'connecting' ? '○' : '✗';
  const connColor = connState === 'connected' ? t.success : connState === 'connecting' ? t.warning : t.error;

  return (
    <KeyboardAvoidingView style={[st.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Header bar (terminal style) ── */}
      <View style={[st.headerBar, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => dispatch({ type: 'BACK_TO_SESSIONS' })} hitSlop={12}>
          <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 14 }}>{'<-'}</Text>
        </TouchableOpacity>
        <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 12, flex: 1, marginLeft: 10 }} numberOfLines={1}>
          {state.credentials?.username}@{session.project}
        </Text>
        <Text style={{ color: connColor, fontFamily: MONO, fontSize: 12 }}>{connIcon}</Text>
        <TouchableOpacity style={[st.modeBadge, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]}
          onPress={() => dispatch({ type: 'TOGGLE_PLAN' })}>
          <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontFamily: MONO, fontSize: 10, fontWeight: '700' }}>
            {planMode ? 'PLAN' : 'EXEC'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Activity line ── */}
      {(toolStatus || isGenerating) && (
        <View style={[st.activityLine, { borderBottomColor: t.border }]}>
          <Text style={{ color: toolStatus ? t.toolIcon : t.thinking, fontFamily: MONO, fontSize: 11, flex: 1 }} numberOfLines={1}>
            {toolStatus
              ? `${toolStatus.status === 'running' ? '⚙' : '✓'} ${toolStatus.tool}${toolStatus.detail ? ' ' + toolStatus.detail : ''}${toolStatus.durationMs ? ' (' + toolStatus.durationMs + 'ms)' : ''}`
              : '● thinking...'}
          </Text>
          {isGenerating && (
            <TouchableOpacity onPress={handleStop}>
              <Text style={{ color: t.error, fontFamily: MONO, fontSize: 11 }}>[stop]</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Message list ── */}
      <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderItem}
        contentContainerStyle={st.messageList}
        keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
        ListFooterComponent={streamBuffer ? (
          <View style={[st.panel, { borderColor: t.border }]}>
            <Text style={[st.panelTitle, { color: t.accent, fontFamily: MONO }]}>
              ─ acorn {'─'.repeat(42)}
            </Text>
            <Text style={[st.panelText, { color: t.fg, fontFamily: MONO }]} selectable>
              {streamBuffer}<Text style={{ color: t.accent }}>▌</Text>
            </Text>
          </View>
        ) : null}
      />

      {/* ── Input area ── */}
      <View style={[st.inputArea, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>
        {planMode && (
          <Text style={{ color: t.planLabelBg, fontFamily: MONO, fontSize: 10, paddingHorizontal: 12, paddingTop: 4 }}>
            [plan mode]
          </Text>
        )}
        <View style={st.inputRow}>
          <TouchableOpacity onPress={() => setShowActions(true)} style={st.cmdBtn}>
            <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 14 }}>{'>'}</Text>
          </TouchableOpacity>
          <TextInput ref={useRef(null)} style={[st.textInput, { color: t.fg, fontFamily: MONO, borderColor: t.border, backgroundColor: t.bgInput }]}
            placeholder={planMode ? 'plan>' : '>'} placeholderTextColor={t.muted}
            value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()}
            returnKeyType="send" blurOnSubmit={false} multiline maxLength={10000} />
          <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim()} style={[st.sendBtn, !input.trim() && { opacity: 0.3 }]}>
            <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 14 }}>{'>>'}  </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Modals ── */}
      {questions && <QuestionSheet questions={questions} onSubmit={handleQuestionSubmit} onCancel={() => dispatch({ type: 'SET_QUESTIONS', questions: null })} />}
      {planApproval && <PlanApprovalSheet planText={planApproval} onExecute={handlePlanExecute} onRevise={handlePlanRevise} onCancel={() => dispatch({ type: 'SET_PLAN_APPROVAL', text: null })} />}

      {/* ── Actions panel ── */}
      {showActions && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
          <Pressable style={st.modalBg} onPress={() => setShowActions(false)}>
            <Pressable style={[st.actionsPanel, { backgroundColor: t.bgPanel, borderColor: t.border }]} onPress={e => e.stopPropagation()}>
              <Text style={[st.sectionTitle, { color: t.fg, fontFamily: MONO }]}>┌─ commands {'─'.repeat(20)}┐</Text>
              <CmdRow label="plan/exec" icon={planMode ? '⚡' : '📋'} desc={planMode ? 'switch to execute' : 'switch to plan'} color={t.accent}
                onPress={() => { setShowActions(false); dispatch({ type: 'TOGGLE_PLAN' }); }} />
              {isGenerating && <CmdRow label="stop" icon="⏹" desc="stop generation" color={t.error}
                onPress={() => { setShowActions(false); handleStop(); }} />}
              <CmdRow label="clear" icon="🗑" desc="clear session" color={t.warning}
                onPress={() => { setShowActions(false); handleClear(); }} />
              <CmdRow label="theme" icon={THEMES[state.themeName].icon} desc={state.themeName} color={t.accent2}
                onPress={() => { setShowActions(false); setShowThemes(true); }} />

              <Text style={[st.sectionTitle, { color: t.fg, fontFamily: MONO, marginTop: 12 }]}>├─ permissions {'─'.repeat(16)}┤</Text>
              {(['ask', 'auto', 'yolo'] as const).map(mode => (
                <CmdRow key={mode} label={mode} icon={mode === 'ask' ? '🔒' : mode === 'auto' ? '🔓' : '☠️'}
                  desc={permMode === mode ? '(active)' : ''} color={permMode === mode ? t.accent : t.muted}
                  onPress={() => {
                    dispatch({ type: 'SET_PERM_MODE', mode });
                    ws.current?.send({ type: 'perm:set-mode', mode });
                    setShowActions(false);
                  }} />
              ))}
              <Text style={[st.sectionTitle, { color: t.fg, fontFamily: MONO }]}>└{'─'.repeat(34)}┘</Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Theme picker ── */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.modalBg}>
            <View style={[st.themePanel, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
              <Text style={[st.sectionTitle, { color: t.fg, fontFamily: MONO }]}>┌─ themes {'─'.repeat(22)}┐</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name]; const active = name === state.themeName;
                  return (
                    <TouchableOpacity key={name} style={[st.themeItem, active && { backgroundColor: t.accent + '15' }]}
                      onPress={() => { dispatch({ type: 'SET_THEME', name }); setShowThemes(false); }}>
                      <Text style={{ fontFamily: MONO, fontSize: 13, color: active ? t.accent : t.fg }}>
                        {active ? '▸ ' : '  '}{th.icon} {name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {[th.accent, th.success, th.error].map((c, i) => (
                          <View key={i} style={{ width: 10, height: 10, backgroundColor: c }} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity onPress={() => setShowThemes(false)} style={{ paddingVertical: 10 }}>
                <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12, textAlign: 'center' }}>[close]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

function CmdRow({ label, icon, desc, color, onPress }: { label: string; icon: string; desc: string; color: string; onPress: () => void }) {
  const MONO_F = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  return (
    <TouchableOpacity style={st.cmdRow} onPress={onPress}>
      <Text style={{ fontFamily: MONO_F, fontSize: 13, color }}> {icon} /{label}</Text>
      <Text style={{ fontFamily: MONO_F, fontSize: 11, color: color + '88', marginLeft: 8 }}>{desc}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, gap: 8 },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },

  // Activity
  activityLine: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderBottomWidth: 1 },

  // Messages
  messageList: { paddingHorizontal: 6, paddingVertical: 4 },
  panel: { borderWidth: 1, marginBottom: 6, paddingBottom: 8 },
  panelTitle: { fontSize: 11, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  panelText: { fontSize: 13, lineHeight: 19, paddingHorizontal: 10 },
  toolLine: { fontSize: 12, lineHeight: 18, paddingVertical: 2, paddingHorizontal: 6 },
  statusLine: { fontSize: 11, lineHeight: 16, paddingVertical: 1, paddingHorizontal: 6 },

  // Input
  inputArea: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 24 : 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6, paddingTop: 4, paddingBottom: 4 },
  cmdBtn: { width: 30, height: 36, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, fontSize: 14, paddingHorizontal: 10, paddingVertical: 8, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  // Modals
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  actionsPanel: { borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 12, paddingBottom: 24 },
  sectionTitle: { fontSize: 12, marginBottom: 4 },
  cmdRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  themePanel: { borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 12, paddingBottom: 24, maxHeight: '70%' },
  themeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
});
