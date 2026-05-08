import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ScrollView,
  Alert, Pressable, BackHandler, AppState,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { PLAN_PREFIX, PLAN_EXECUTE_MSG } from '../utils/plan';
import { formatAnswers } from '../utils/questions';
import { listThemes, THEMES } from '../themes';
import MarkdownText from '../components/MarkdownText';
import Spinner from '../components/Spinner';
import SporeLogo from '../components/SporeLogo';
import GradientBackground from '../components/GradientBackground';
import { BODY_FONT } from '../context/AppContext';

import QuestionSheet from '../components/QuestionSheet';
import PlanApprovalSheet from '../components/PlanApprovalSheet';
import { ChatItem } from '../types';
import { LinearGradient } from 'expo-linear-gradient';
import { configureNotifications, ensureNotificationPermissions, notifyAgentFinished, previewNotificationText } from '../services/notifications';

import { MONO_FONT as MONO } from '../context/AppContext';

export default function ChatScreen() {
  const { state, dispatch, theme: t, ws } = useApp();
  const { currentSession: session, messages, streamBuffer, isGenerating, toolStatus, questions, planApproval, planMode, permMode, connState } = state;
  const [input, setInput] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const appStateRef = useRef(AppState.currentState);
  const androidBlurredRef = useRef(false);
  const pendingNotificationRef = useRef(false);
  const stoppedByUserRef = useRef(false);
  const lastNotifiedTextRef = useRef<string | null>(null);
  const wasGeneratingRef = useRef(false);

  useEffect(() => {
    configureNotifications().catch(() => undefined);
    const reconnectIfNeeded = () => ws.current?.ensureConnected();
    const appStateSub = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active') reconnectIfNeeded();
    });
    const blurSub = Platform.OS === 'android' ? AppState.addEventListener('blur', () => { androidBlurredRef.current = true; }) : null;
    const focusSub = Platform.OS === 'android' ? AppState.addEventListener('focus', () => {
      androidBlurredRef.current = false;
      reconnectIfNeeded();
    }) : null;
    reconnectIfNeeded();
    return () => { appStateSub.remove(); blurSub?.remove(); focusSub?.remove(); };
  }, [ws]);

  // Observe session — retry until connected
  useEffect(() => {
    if (!session) return;
    ws.current?.ensureConnected();
    let observed = false;
    const tryObserve = () => {
      if (observed) return;
      if (ws.current?.isConnected) {
        ws.current.observe(session.key);
        ws.current.requestHistory(session.key);
        observed = true;
      }
    };
    // Try immediately and then poll
    tryObserve();
    const check = setInterval(tryObserve, 300);
    return () => {
      clearInterval(check);
      if (observed && ws.current) ws.current.unobserve(session.key);
    };
  }, [session?.key, connState]); // re-run when connection state changes

  // Auto-scroll: stick to bottom during streaming, animated on new messages
  const isStreamingRef = useRef(false);
  isStreamingRef.current = !!streamBuffer || isGenerating;

  const handleContentSizeChange = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: !isStreamingRef.current });
  }, []);

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showActions) { setShowActions(false); return true; }
      if (showThemes) { setShowThemes(false); return true; }
      dispatch({ type: 'BACK_TO_SESSIONS' });
      return true;
    });
    return () => sub.remove();
  }, [showActions, showThemes, dispatch]);

  if (!session) return null;

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !ws.current) return;
    if (!text) setInput('');
    // Show as interjection if agent is currently generating
    const label = isGenerating ? `[interjecting] ${msg}` : msg;
    dispatch({ type: 'SEND_MESSAGE', text: label });
    pendingNotificationRef.current = true;
    stoppedByUserRef.current = false;
    ensureNotificationPermissions().catch(() => undefined);
    ws.current.sendMessage(
      isCodeSession && planMode ? PLAN_PREFIX + msg : msg,
      session.key,
      state.credentials!.username,
      isCodeSession ? 'code' : 'web',
    );
  };

  const handleStop = () => {
    stoppedByUserRef.current = true;
    pendingNotificationRef.current = false;
    ws.current?.stop(session.key);
  };
  const handleTogglePlan = () => {
    const newMode = !planMode;
    dispatch({ type: 'SET_PLAN_MODE', on: newMode });
    ws.current?.send({ type: 'plan:set-mode', enabled: newMode });
  };
  const handleClear = () => Alert.alert('Clear', 'Clear all messages?', [
    { text: 'No', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: () => { ws.current?.send({ type: 'chat:clear', sessionId: session.key }); dispatch({ type: 'CLEAR_MESSAGES' }); } },
  ]);
  const handleQuestionSubmit = (formatted: string, rawAnswer?: string | string[], qid?: string) => {
    dispatch({ type: 'SET_QUESTIONS', questions: null });
    dispatch({ type: 'SEND_MESSAGE', text: formatted });
    if (qid && rawAnswer !== undefined) {
      ws.current?.answerAskUser(qid, rawAnswer);
    } else {
      sendMessage(formatted);
    // Tell CLI to dismiss its question selector
      ws.current?.send({ type: 'interactive:resolved', kind: 'questions' });
    }
  };
  // Plan decisions — send control messages to CLI, let CLI handle the actual flow
  const handlePlanExecute = () => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null });
    dispatch({ type: 'SET_PLAN_MODE', on: false });
    ws.current?.send({ type: 'plan:decision', action: 'execute' });
  };
  const handlePlanRevise = (feedback: string) => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null });
    ws.current?.send({ type: 'plan:decision', action: 'revise', feedback });
  };
  const handlePlanCancel = () => {
    dispatch({ type: 'SET_PLAN_APPROVAL', text: null });
    ws.current?.send({ type: 'plan:decision', action: 'cancel' });
  };

  // ── Terminal-style renderers ──

  useEffect(() => {
    const wasGenerating = wasGeneratingRef.current;
    wasGeneratingRef.current = isGenerating;
    if (!wasGenerating || isGenerating) return;
    if (!pendingNotificationRef.current || stoppedByUserRef.current) return;

    const finalMessage = [...messages].reverse().find((item): item is Extract<ChatItem, { type: 'assistant' }> => item.type === 'assistant');
    const finalText = finalMessage?.text?.trim() || streamBuffer.trim();
    if (!finalText) {
      pendingNotificationRef.current = false;
      return;
    }

    const preview = previewNotificationText(finalText);
    if (lastNotifiedTextRef.current === preview) {
      pendingNotificationRef.current = false;
      return;
    }

    const appIsActive = appStateRef.current === 'active' && !androidBlurredRef.current;
    pendingNotificationRef.current = false;
    if (appIsActive) return;

    lastNotifiedTextRef.current = preview;
    notifyAgentFinished({
      sessionId: session.key,
      sessionTitle: session.title || session.project || 'this chat',
      messagePreview: preview,
    }).catch(() => undefined);
  }, [isGenerating, messages, session.key, session.project, session.title, streamBuffer]);

  const renderItem = ({ item }: { item: ChatItem }) => {
    switch (item.type) {
      case 'user':
        return (
          <View style={st.chatRowUser}>
            <View style={[st.userBubbleShadow, { borderColor: t.userBubbleBorder }]}>
              <LinearGradient
                colors={[t.userBubbleGradientA, t.userBubbleGradientB]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={st.userBubble}
              >
                <Text style={[st.bubbleLabel, { color: t.muted, fontFamily: MONO }]}>{state.credentials?.username || 'you'}</Text>
                <Text style={[st.userBubbleText, { color: t.fg }]} selectable>{item.text}</Text>
              </LinearGradient>
            </View>
          </View>
        );
      case 'assistant':
        return (
          <View style={st.chatRowAssistant}>
            <View style={st.assistantBubble}>
              <Text style={[st.bubbleLabel, { color: t.muted, fontFamily: MONO }]}>spore</Text>
              <MarkdownText>{item.text}</MarkdownText>
            </View>
          </View>
        );
      case 'tool': {
        const color = item.status === 'pending' ? t.warning : item.status === 'denied' ? t.error : t.success;
        const icon = item.status === 'pending' ? '⚙' : item.status === 'denied' ? '✗' : '✓';
        return (
          <View style={[st.statusCard, { borderColor: t.border, backgroundColor: t.bgPanel }]}>
            <Text style={{ color, fontSize: 12 }}>
              {icon} {item.name}: {item.summary}
            </Text>
          </View>
        );
      }
      case 'approval': {
        if (item.resolved) {
          return (
            <Text style={{ color: t.muted, fontFamily: MONO, fontSize: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
              {'  '}✓ {item.name}: {item.summary} (resolved)
            </Text>
          );
        }
        return (
          <View style={{ paddingHorizontal: 6, paddingVertical: 4, borderLeftWidth: 2, borderLeftColor: item.dangerous ? t.error : t.warning, marginVertical: 2, marginHorizontal: 4, paddingLeft: 10 }}>
            <Text style={{ color: item.dangerous ? t.error : t.warning, fontFamily: MONO, fontSize: 12, fontWeight: '700' }}>
              ⚙ {item.name}{item.dangerous ? ' ⚠ DANGEROUS' : ''}
            </Text>
            <Text style={{ color: t.fg, fontFamily: MONO, fontSize: 11, marginTop: 2 }}>{item.summary}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={() => {
                // Approve current + resolve this card
                ws.current?.send({ type: 'tool:approve', id: 'current', allowed: true });
                dispatch({ type: 'RESOLVE_APPROVAL', id: item.id });
              }} style={[st.softPill, { borderColor: t.success }]}>
                <Text style={{ color: t.success, fontSize: 11, fontWeight: '700' }}>allow</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                // Switch CLI to auto mode — resolves ALL pending prompts
                ws.current?.send({ type: 'perm:set-mode', mode: 'auto' });
                dispatch({ type: 'SET_PERM_MODE', mode: 'auto' });
                // Resolve all pending approval cards
                state.messages.forEach(m => {
                  if (m.type === 'approval' && !(m as any).resolved) {
                    dispatch({ type: 'RESOLVE_APPROVAL', id: m.id });
                  }
                });
              }} style={[st.softPill, { borderColor: t.border }]}>
                <Text style={{ color: t.accent, fontFamily: MONO, fontSize: 11 }}>[allow all]</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                ws.current?.send({ type: 'tool:approve', id: 'current', allowed: false });
                dispatch({ type: 'RESOLVE_APPROVAL', id: item.id });
              }} style={[st.softPill, { borderColor: t.error }]}>
                <Text style={{ color: t.error, fontSize: 11, fontWeight: '700' }}>deny</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      case 'status':
        return <Text style={[st.statusLine, { color: t.muted, fontFamily: MONO }]}>  {item.text}</Text>;
      case 'error':
        return <Text style={[st.statusLine, { color: t.error, fontFamily: MONO }]}>  ✗ {item.text}</Text>;
    }
  };

  const { cliConnected } = state;
  const isCodeSession = session.kind === 'code';
  const isWebGraphSession = session.kind === 'web_control' || session.kind === 'web_graph';
  const connLabel = connState !== 'connected' ? connState : cliConnected ? 'cli online' : 'cli offline';
  const connColor = connState !== 'connected' ? t.error : cliConnected ? t.success : t.warning;
  const connIcon = connState !== 'connected' ? '✗' : cliConnected ? '●' : '○';

  return (
    <GradientBackground theme={t} style={st.container}>
      <KeyboardAvoidingView style={st.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Header bar ── */}
      <View style={[st.headerBar, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => dispatch({ type: 'BACK_TO_SESSIONS' })} hitSlop={12} style={st.backButton}>
          <Text style={{ color: t.muted, fontSize: 20, lineHeight: 22 }}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={st.sessionBrand}>
          <View style={[st.headerLogoWrap, { borderColor: t.border, backgroundColor: t.bgInput }]}>
            <SporeLogo size={30} color={t.fg} accent={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontFamily: BODY_FONT, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {isCodeSession ? (session.title || session.project) : 'Spore Core'}
            </Text>
            <Text style={{ color: t.muted, fontFamily: BODY_FONT, fontSize: 11 }} numberOfLines={1}>
              {state.credentials?.username}@{session.project}
            </Text>
          </View>
        </View>
        {isCodeSession && <Text style={[st.connText, { color: connColor }]}>{connIcon} {connLabel}</Text>}
        {isCodeSession && (
          <TouchableOpacity style={[st.modeBadge, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]}
            onPress={() => handleTogglePlan()}>
            <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontFamily: BODY_FONT, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
              {planMode ? 'plan' : 'exec'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Activity line ── */}
      {isCodeSession && (toolStatus || isGenerating) && (
        <View style={[st.activityLine, { borderBottomColor: t.border }]}>
          {toolStatus ? (
            <Text style={{ color: t.toolIcon, fontFamily: MONO, fontSize: 11, flex: 1 }} numberOfLines={1}>
              {toolStatus.status === 'running' ? '⚙' : '✓'} {toolStatus.tool}{toolStatus.detail ? ' ' + toolStatus.detail : ''}{toolStatus.durationMs ? ' (' + toolStatus.durationMs + 'ms)' : ''}
            </Text>
          ) : (
            <Spinner style={{ color: t.thinking, fontFamily: MONO, fontSize: 11, flex: 1 }} text="generating..." />
          )}
        </View>
      )}

      {/* ── Message list ── */}
      <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderItem}
        contentContainerStyle={[st.messageList, { backgroundColor: 'transparent' }]}
        keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
        onContentSizeChange={handleContentSizeChange}
        ListFooterComponent={<>
          {streamBuffer ? (
            <View style={[st.panel, { borderColor: t.border }]}>
              <Text style={[st.panelTitle, { color: t.accent, fontFamily: MONO }]}>
                ─ spore {'─'.repeat(42)}
              </Text>
              <Text style={[st.panelText, { color: t.fg, fontFamily: MONO }]} selectable>
                {streamBuffer}<Text style={{ color: t.accent }}>▌</Text>
              </Text>
            </View>
          ) : null}
          {isGenerating && !streamBuffer && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Spinner style={{ color: t.thinking, fontFamily: MONO, fontSize: 12 }}
                text={isCodeSession && toolStatus ? `${toolStatus.tool}${toolStatus.detail ? ' ' + toolStatus.detail : ''}` : 'thinking...'} />
            </View>
          )}
          {isGenerating && streamBuffer ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
              <Spinner style={{ color: t.thinking, fontFamily: MONO, fontSize: 11 }}
                text={isCodeSession && toolStatus ? `${toolStatus.tool}${toolStatus.detail ? ' ' + toolStatus.detail : ''}` : 'generating...'} />
            </View>
          ) : null}
        </>}
      />

      {/* ── Input area ── */}
      <View style={[st.inputArea, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>
        {isCodeSession && planMode && (
          <View style={[st.planModeBar, { borderColor: t.planLabelBg, backgroundColor: t.planLabelBg + '18' }]}>
            <Text style={[st.planModeText, { color: t.planLabelBg }]}>Plan mode</Text>
          </View>
        )}
        <View style={st.inputRow}>
          <TouchableOpacity onPress={() => setShowActions(true)} style={[st.cmdBtn, { borderColor: t.border, backgroundColor: t.bgInput }]}>
            <Text style={[st.cmdBtnText, { color: t.muted }]}>＋</Text>
          </TouchableOpacity>
          <TextInput ref={useRef(null)} style={[st.textInput, { color: t.fg, fontFamily: BODY_FONT, borderColor: t.border, backgroundColor: t.bgInput }]}
            placeholder={isCodeSession && planMode ? 'Plan your next move…' : 'Message Spore…'} placeholderTextColor={t.muted}
            value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()}
            returnKeyType="send" blurOnSubmit={false} multiline maxLength={10000} />
          {isGenerating && isCodeSession ? (
            <TouchableOpacity onPress={handleStop} style={[st.stopBtn, { borderColor: t.error, backgroundColor: t.error + '14' }]}>
              <Text style={[st.stopBtnText, { color: t.error }]}>Stop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim()} style={[st.sendBtn, { backgroundColor: t.accent, shadowColor: t.accent }, !input.trim() && { opacity: 0.35 }]}>
              <Text style={[st.sendBtnText, { color: t.bg }]}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Modals ── */}
      {questions && <QuestionSheet questions={questions} onSubmit={handleQuestionSubmit} onCancel={() => dispatch({ type: 'SET_QUESTIONS', questions: null })} />}
      {planApproval && <PlanApprovalSheet planText={planApproval} onExecute={handlePlanExecute} onRevise={handlePlanRevise} onCancel={handlePlanCancel} />}

      {/* ── Actions panel ── */}
      {showActions && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
          <Pressable style={st.modalBg} onPress={() => setShowActions(false)}>
            <Pressable style={[st.actionsPanel, { backgroundColor: t.bgPanel, borderColor: t.border }]} onPress={e => e.stopPropagation()}>
              <View style={st.sheetHeader}>
                <Text style={[st.sheetTitle, { color: t.fg }]}>Chat actions</Text>
                <TouchableOpacity onPress={() => setShowActions(false)} style={[st.sheetClose, { borderColor: t.border }]}>
                  <Text style={[st.sheetCloseText, { color: t.muted }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={st.sheetScroll} contentContainerStyle={st.sheetScrollContent} showsVerticalScrollIndicator={false}>
                {isWebGraphSession ? (
                  <>
                    <CmdRow label="add files" icon="📎" desc="coming soon" color={t.accent}
                      onPress={() => {
                        setShowActions(false);
                        Alert.alert('Add files', 'File uploads are not wired in the mobile app yet.');
                      }} />
                    <CmdRow label="clear" icon="🗑" desc="clear chat" color={t.warning}
                      onPress={() => { setShowActions(false); handleClear(); }} />
                    <CmdRow label="theme" icon={THEMES[state.themeName].icon} desc={state.themeName} color={t.accent2}
                      onPress={() => { setShowActions(false); setShowThemes(true); }} />
                  </>
                ) : (
                  <>
                    <CmdRow label="plan/exec" icon={planMode ? '⚡' : '📋'} desc={planMode ? 'switch to execute' : 'switch to plan'} color={t.accent}
                      onPress={() => { setShowActions(false); handleTogglePlan(); }} />
                    {isGenerating && <CmdRow label="stop" icon="⏹" desc="stop generation" color={t.error}
                      onPress={() => { setShowActions(false); handleStop(); }} />}
                    <CmdRow label="clear" icon="🗑" desc="clear session" color={t.warning}
                      onPress={() => { setShowActions(false); handleClear(); }} />
                    <CmdRow label="theme" icon={THEMES[state.themeName].icon} desc={state.themeName} color={t.accent2}
                      onPress={() => { setShowActions(false); setShowThemes(true); }} />

                    <Text style={[st.sectionTitle, { color: t.muted }]}>Permissions</Text>
                    {(['ask', 'auto', 'yolo'] as const).map(mode => (
                      <CmdRow key={mode} label={mode} icon={mode === 'ask' ? '🔒' : mode === 'auto' ? '🔓' : '☠️'}
                        desc={permMode === mode ? '(active)' : ''} color={permMode === mode ? t.accent : t.muted}
                        onPress={() => {
                          dispatch({ type: 'SET_PERM_MODE', mode });
                          ws.current?.send({ type: 'perm:set-mode', mode });
                          setShowActions(false);
                        }} />
                    ))}
                    <Text style={[st.sectionTitle, { color: t.muted }]}>Delegation</Text>
                    {(['default', 'off', 'research', 'code', 'all'] as const).map(mode => (
                      <CmdRow key={mode} label={mode}
                        icon={mode === 'off' ? '🚫' : mode === 'research' ? '🔍' : mode === 'code' ? '📝' : mode === 'all' ? '🔓' : '⚡'}
                        desc={state.delegateMode === mode ? '(active)' : ''} color={state.delegateMode === mode ? t.accent : t.muted}
                        onPress={() => {
                          dispatch({ type: 'SET_DELEGATE_CONFIG', mode, workers: state.delegateWorkers });
                          ws.current?.send({ type: 'delegate:config', mode, workers: state.delegateWorkers });
                          setShowActions(false);
                        }} />
                    ))}
                    <CmdRow label={`workers: ${state.delegateWorkers}`} icon="👥" desc="tap to cycle (0-5)" color={t.muted}
                      onPress={() => {
                        const next = (state.delegateWorkers + 1) % 6;
                        dispatch({ type: 'SET_DELEGATE_CONFIG', mode: state.delegateMode, workers: next });
                        ws.current?.send({ type: 'delegate:config', mode: state.delegateMode, workers: next });
                      }} />
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Theme picker ── */}
      {showThemes && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowThemes(false)}>
          <View style={st.modalBg}>
            <View style={[st.themePanel, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
              <View style={st.sheetHeader}>
                <Text style={[st.sheetTitle, { color: t.fg }]}>Theme</Text>
                <TouchableOpacity onPress={() => setShowThemes(false)} style={[st.sheetClose, { borderColor: t.border }]}>
                  <Text style={[st.sheetCloseText, { color: t.muted }]}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {listThemes().map(name => {
                  const th = THEMES[name]; const active = name === state.themeName;
                  return (
                    <TouchableOpacity key={name} style={[st.themeItem, active && { backgroundColor: t.accent + '15' }]}
                      onPress={() => { dispatch({ type: 'SET_THEME', name }); setShowThemes(false); }}>
                      <Text style={{ fontFamily: BODY_FONT, fontSize: 14, fontWeight: active ? '700' : '500', color: active ? t.accent : t.fg }}>
                        {th.icon} {name}
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
                <Text style={[st.sheetCloseText, { color: t.muted, textAlign: 'center' }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

function CmdRow({ label, icon, desc, color, onPress }: { label: string; icon: string; desc: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[st.cmdRow, { borderColor: color + '33', backgroundColor: color + '0d' }]} onPress={onPress}>
      <Text style={[st.cmdIcon, { color }]}>{icon}</Text>
      <View style={st.cmdText}>
        <Text style={[st.cmdLabel, { color }]}>{label}</Text>
        <Text style={[st.cmdDesc, { color: color + '99' }]}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  connText: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },

  // Header
  headerBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: { width: 32, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  sessionBrand: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerLogoWrap: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  modeBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  activityLine: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1 },

  // Messages — web .chat-row/.chat-msg: user bubble self-ends with gradient/shadow; assistant stays text-forward
  messageList: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 18 },
  chatRowUser: { width: '100%', alignItems: 'flex-end', marginBottom: 12, paddingLeft: 34 },
  chatRowAssistant: { width: '100%', alignItems: 'flex-start', marginBottom: 12, paddingRight: 2 },
  userBubbleShadow: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 18,
    borderTopRightRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  userBubble: {
    borderRadius: 18,
    borderTopRightRadius: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  userBubbleText: { fontFamily: BODY_FONT, fontSize: 15, lineHeight: 21 },
  bubbleLabel: { fontSize: 9, fontWeight: '700', opacity: 0.62, marginBottom: 5, letterSpacing: 0.8, textTransform: 'lowercase' },
  assistantBubble: { alignSelf: 'stretch', maxWidth: '100%', paddingHorizontal: 2, paddingVertical: 2 },
  statusCard: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginVertical: 3 },
  softPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginVertical: 2 },
  panel: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  panelTitle: { fontSize: 10, marginBottom: 4, opacity: 0.78 },
  panelText: { fontSize: 13, lineHeight: 18 },
  statusLine: { fontSize: 11, lineHeight: 16, paddingVertical: 1, paddingHorizontal: 6 },

  // Input — web composer: surface strip, pill textarea, quiet action buttons
  inputArea: { borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 24 : 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 9, paddingBottom: 7, gap: 8 },
  planModeBar: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 12, marginTop: 8 },
  planModeText: { fontFamily: BODY_FONT, fontSize: 12, fontWeight: '700' },
  cmdBtn: { width: 38, height: 42, borderWidth: 1, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cmdBtnText: { fontFamily: BODY_FONT, fontSize: 20, lineHeight: 22, fontWeight: '600' },
  textInput: { flex: 1, fontSize: 15, lineHeight: 20, paddingHorizontal: 13, paddingVertical: 10, maxHeight: 116, borderWidth: 1, borderRadius: 14 },
  sendBtn: { height: 42, minWidth: 62, justifyContent: 'center', alignItems: 'center', borderRadius: 13, paddingHorizontal: 14, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  sendBtnText: { fontFamily: BODY_FONT, fontSize: 14, fontWeight: '700' },
  stopBtn: { height: 42, minWidth: 62, justifyContent: 'center', alignItems: 'center', borderRadius: 13, borderWidth: 1, paddingHorizontal: 14 },
  stopBtnText: { fontFamily: BODY_FONT, fontSize: 14, fontWeight: '700' },
  // Modals
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.34)', paddingTop: 96 },
  actionsPanel: { borderWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 18, maxHeight: '72%', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 8 },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { paddingBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sheetTitle: { fontFamily: BODY_FONT, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  sheetClose: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  sheetCloseText: { fontFamily: BODY_FONT, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontFamily: BODY_FONT, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },
  cmdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderWidth: 1, borderRadius: 14, marginBottom: 8 },
  cmdIcon: { fontFamily: BODY_FONT, fontSize: 17, width: 24, textAlign: 'center' },
  cmdText: { flex: 1, minWidth: 0 },
  cmdLabel: { fontFamily: BODY_FONT, fontSize: 14, fontWeight: '700', letterSpacing: 0.05 },
  cmdDesc: { fontFamily: BODY_FONT, fontSize: 12, marginTop: 2 },
  themePanel: { borderWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 18, maxHeight: '58%', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 8 },
  themeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderRadius: 14 },
});
