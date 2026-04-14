import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { AcornWebSocket } from '../services/websocket';
import { parseQuestions, Question, formatAnswers } from '../utils/questions';
import { PLAN_PREFIX, PLAN_EXECUTE_MSG, hasPlanReady } from '../utils/plan';
import { useTheme } from '../context/ThemeContext';
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
  const { theme: t } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [input, setInput] = useState('');
  const [lastUsage, setLastUsage] = useState<{ usage?: Usage; iterations?: number; toolUsage?: Record<string, number> } | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [planApprovalText, setPlanApprovalText] = useState<string | null>(null);
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
          // Check for questions
          const parsed = parseQuestions(finalText);
          if (parsed.length > 0) {
            setMessages(prev => [...prev, {
              id: `msg-${++msgId}`, role: 'assistant', text: finalText,
            }]);
            setQuestions(parsed);
          } else if (planMode && hasPlanReady(finalText)) {
            setMessages(prev => [...prev, {
              id: `msg-${++msgId}`, role: 'assistant', text: finalText,
            }]);
            setPlanApprovalText(finalText);
          } else {
            setMessages(prev => [...prev, {
              id: `msg-${++msgId}`, role: 'assistant', text: finalText,
            }]);
          }
        }
        // Usage stats
        if (event.usage || event.iterations) {
          setLastUsage({
            usage: event.usage,
            iterations: event.iterations,
            toolUsage: (event as any).toolUsage,
          });
        }
        streamRef.current = '';
        setStreamingText('');
        setIsGenerating(false);
        setToolStatus(null);
        break;
      }

      case 'chat:error':
        setMessages(prev => [...prev, {
          id: `msg-${++msgId}`, role: 'assistant', text: `Error: ${event.error}`,
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
    }
  }, [planMode]);

  useEffect(() => {
    const ws = new AcornWebSocket(credentials.serverUrl, credentials.token!, handleEvent, setConnState);
    wsRef.current = ws;
    ws.connect();
    const checkConnected = setInterval(() => {
      if (ws['ws']?.readyState === WebSocket.OPEN) {
        ws.observe(session.key);
        ws.requestHistory(session.key);
        clearInterval(checkConnected);
      }
    }, 200);
    return () => { clearInterval(checkConnected); ws.unobserve(session.key); ws.disconnect(); };
  }, [credentials, session.key, handleEvent]);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, streamingText]);

  const sendMessage = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || !wsRef.current) return;
    if (!text) setInput('');

    // Slash commands
    if (msg.startsWith('/')) {
      const cmd = msg.split(/\s+/)[0].toLowerCase();
      if (cmd === '/plan') { onTogglePlan(); return; }
      if (cmd === '/stop') { wsRef.current.stop(session.key); return; }
      if (cmd === '/clear') {
        wsRef.current.send({ type: 'chat:clear', sessionId: session.key });
        setMessages([]);
        return;
      }
    }

    setMessages(prev => [...prev, {
      id: `msg-${++msgId}`, role: 'user', text: msg,
    }]);

    const content = planMode ? PLAN_PREFIX + msg : msg;
    wsRef.current.sendMessage(content, session.key, credentials.username);
  };

  // Question submit
  const handleQuestionSubmit = (formatted: string) => {
    setQuestions(null);
    sendMessage(formatted);
  };

  // Plan approval
  const handlePlanExecute = () => {
    setPlanApprovalText(null);
    onTogglePlan(); // switch to exec mode
    setMessages(prev => [...prev, {
      id: `msg-${++msgId}`, role: 'user', text: '▶ Execute plan',
    }]);
    wsRef.current?.sendMessage(PLAN_EXECUTE_MSG, session.key, credentials.username);
  };

  const handlePlanRevise = (feedback: string) => {
    setPlanApprovalText(null);
    const msg = `[PLAN FEEDBACK: Revise the plan. Stay in plan mode.]\n\n${feedback}`;
    setMessages(prev => [...prev, { id: `msg-${++msgId}`, role: 'user', text: feedback }]);
    wsRef.current?.sendMessage(msg, session.key, credentials.username);
  };

  const mdStyles = {
    body: { color: t.fg, fontSize: 14, lineHeight: 20 },
    heading1: { color: t.fg, fontSize: 20, fontWeight: '700' as const, marginVertical: 8 },
    heading2: { color: t.fg, fontSize: 17, fontWeight: '700' as const, marginVertical: 6 },
    heading3: { color: t.fg, fontSize: 15, fontWeight: '600' as const, marginVertical: 4 },
    code_inline: { backgroundColor: t.bg, color: t.accent, fontSize: 13, paddingHorizontal: 4, borderRadius: 3 },
    code_block: { backgroundColor: t.bg, color: t.accent, fontSize: 12, padding: 10, borderRadius: 6 },
    fence: { backgroundColor: t.bg, color: t.accent, fontSize: 12, padding: 10, borderRadius: 6 },
    link: { color: t.accent },
    blockquote: { borderLeftColor: t.accent, borderLeftWidth: 3, paddingLeft: 10, color: t.muted },
    bullet_list_icon: { color: t.accent },
    ordered_list_icon: { color: t.accent },
    strong: { color: t.fg, fontWeight: '700' as const },
    em: { color: t.fg, fontStyle: 'italic' as const },
    hr: { backgroundColor: t.separator },
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[
        styles.bubble,
        { backgroundColor: isUser ? t.accent : t.bgPanel, borderColor: isUser ? t.accent : t.border },
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}>
        <Text style={[styles.roleLabel, { color: isUser ? t.bg + 'cc' : t.muted }]}>
          {isUser ? credentials.username : 'acorn'}
        </Text>
        {isUser ? (
          <Text style={[styles.messageText, { color: '#fff' }]}>{item.text}</Text>
        ) : (
          <Markdown style={mdStyles}>{item.text}</Markdown>
        )}
      </View>
    );
  };

  const connColor = connState === 'connected' ? t.success : connState === 'connecting' ? t.warning : t.error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={{ color: t.accent, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '600' }}>{session.project}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.connDot, { backgroundColor: connColor }]} />
            <Text style={{ color: t.muted, fontSize: 11 }}>{connState}</Text>
            <View style={[styles.modeBadge, { backgroundColor: planMode ? t.planLabelBg : t.execLabelBg }]}>
              <Text style={{ color: planMode ? t.planLabel : t.execLabel, fontSize: 10, fontWeight: '700' }}>
                {planMode ? 'PLAN' : 'EXEC'}
              </Text>
            </View>
          </View>
        </View>
        {isGenerating ? (
          <TouchableOpacity onPress={() => wsRef.current?.stop(session.key)}
            style={[styles.stopBtn, { backgroundColor: t.error }]}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onTogglePlan} style={styles.backBtn}>
            <Text style={{ color: t.accent, fontSize: 13 }}>{planMode ? 'Exec' : 'Plan'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tool status */}
      {toolStatus && (
        <View style={[styles.toolBar, { backgroundColor: t.bgHeader, borderBottomColor: t.border }]}>
          <Text style={{ color: t.toolIcon, fontSize: 12 }}>
            {toolStatus.status === 'running' ? '⚙' : '✓'}{' '}
            {toolStatus.tool}{toolStatus.detail ? ` ${toolStatus.detail}` : ''}
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
          <>
            {streamingText ? (
              <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: t.bgPanel, borderColor: t.border }]}>
                <Text style={[styles.roleLabel, { color: t.muted }]}>acorn</Text>
                <Markdown style={mdStyles}>{streamingText}</Markdown>
                <Text style={{ color: t.accent }}>▎</Text>
              </View>
            ) : null}
            {lastUsage?.usage && (
              <Text style={[styles.usageText, { color: t.usage }]}>
                {(lastUsage.usage.input_tokens || 0).toLocaleString()} in  ·  {(lastUsage.usage.output_tokens || 0).toLocaleString()} out
                {lastUsage.iterations && lastUsage.iterations > 1 ? `  ·  ${lastUsage.iterations} iters` : ''}
                {lastUsage.toolUsage ? `  ·  ${Object.values(lastUsage.toolUsage).reduce((a, b) => a + b, 0)} tools` : ''}
              </Text>
            )}
          </>
        }
      />

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: t.bgHeader, borderTopColor: t.border }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: t.bgInput, color: t.fg, borderColor: t.border }]}
          placeholder={planMode ? 'Plan mode — ask to plan...' : 'Send a message...'}
          placeholderTextColor={t.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          multiline
          maxLength={10000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: t.accent }, !input.trim() && { opacity: 0.3 }]}
          onPress={() => sendMessage()}
          disabled={!input.trim()}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Question sheet */}
      {questions && (
        <QuestionSheet
          questions={questions}
          onSubmit={handleQuestionSubmit}
          onCancel={() => setQuestions(null)}
        />
      )}

      {/* Plan approval sheet */}
      {planApprovalText && (
        <PlanApprovalSheet
          planText={planApprovalText}
          onExecute={handlePlanExecute}
          onRevise={handlePlanRevise}
          onCancel={() => setPlanApprovalText(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  connDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  modeBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stopBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  toolBar: { paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1 },
  messageList: { padding: 12, paddingBottom: 8 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 8, maxWidth: '90%', borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  roleLabel: { fontSize: 10, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  messageText: { fontSize: 14, lineHeight: 20 },
  usageText: { fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 8, borderTopWidth: 1,
  },
  textInput: {
    flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, borderWidth: 1,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
});
