import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { AcornWebSocket } from '../services/websocket';
import { parseQuestions } from '../utils/questions';
import { hasPlanReady } from '../utils/plan';
import { getTheme, DEFAULT_THEME, Theme } from '../themes';
import {
  Credentials, Session, ChatItem, ToolStatus, UsageInfo,
  ConnectionState, PermMode, AppAction, WsEvent,
} from '../types';
import { Question } from '../utils/questions';

// ── State shape ──

export interface AppState {
  screen: 'auth' | 'sessions' | 'chat';
  credentials: Credentials | null;
  sessions: Session[];
  currentSession: Session | null;
  // Chat
  messages: ChatItem[];
  streamBuffer: string;
  responseParts: string[];
  isGenerating: boolean;
  toolStatus: ToolStatus | null;
  lastUsage: UsageInfo | null;
  // Interactive
  questions: Question[] | null;
  planApproval: string | null;
  planMode: boolean;
  permMode: PermMode;
  // Connection
  connState: ConnectionState;
  // Theme
  themeName: string;
}

let _msgId = 0;
const nextId = () => `m-${++_msgId}-${Date.now()}`;

const initialState: AppState = {
  screen: 'auth',
  credentials: null,
  sessions: [],
  currentSession: null,
  messages: [],
  streamBuffer: '',
  responseParts: [],
  isGenerating: false,
  toolStatus: null,
  lastUsage: null,
  questions: null,
  planApproval: null,
  planMode: false,
  permMode: 'auto',
  connState: 'disconnected',
  themeName: DEFAULT_THEME,
};

// ── Reducer ──

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Navigation
    case 'SET_SCREEN':
      return { ...state, screen: action.screen };
    case 'AUTH_SUCCESS':
      return { ...state, credentials: action.credentials, screen: 'sessions' };
    case 'LOGOUT':
      return { ...initialState, themeName: state.themeName };
    case 'SELECT_SESSION': {
      // Only clear messages if switching to a different session
      const sameSession = state.currentSession?.key === action.session.key;
      return {
        ...state, currentSession: action.session, screen: 'chat',
        messages: sameSession ? state.messages : [],
        streamBuffer: sameSession ? state.streamBuffer : '',
        responseParts: sameSession ? state.responseParts : [],
        isGenerating: sameSession ? state.isGenerating : false,
        toolStatus: sameSession ? state.toolStatus : null,
        lastUsage: sameSession ? state.lastUsage : null,
        questions: sameSession ? state.questions : null,
        planApproval: sameSession ? state.planApproval : null,
        planMode: sameSession ? state.planMode : false,
      };
    }
    case 'BACK_TO_SESSIONS':
      // Keep messages — they'll be restored if user returns to same session
      return { ...state, screen: 'sessions' };

    // Sessions
    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions };
    case 'UPDATE_CREDENTIALS':
      return { ...state, credentials: action.credentials };

    // Streaming — matches CLI ws_events.py exactly
    case 'STREAM_START':
      return {
        ...state, isGenerating: true,
        streamBuffer: '', responseParts: [], toolStatus: null, lastUsage: null,
      };

    case 'STREAM_DELTA':
      return {
        ...state,
        streamBuffer: state.streamBuffer + action.text,
        responseParts: [...state.responseParts, action.text],
      };

    case 'FLUSH_BUFFER': {
      // CLI: flush_stream_buffer — take accumulated text, add as message, clear buffer
      if (!state.streamBuffer.trim()) return { ...state, streamBuffer: '' };
      return {
        ...state,
        messages: [...state.messages, { type: 'assistant', id: nextId(), text: state.streamBuffer }],
        streamBuffer: '',
      };
    }

    case 'STREAM_DONE': {
      // CLI: on_done — flush buffer, parse questions/plan, set usage
      const fullResponse = state.responseParts.join('');
      const newMessages = [...state.messages];

      // Flush any remaining buffer as assistant message
      if (state.streamBuffer.trim()) {
        newMessages.push({ type: 'assistant', id: nextId(), text: state.streamBuffer });
      }

      // Usage stats
      let lastUsage: UsageInfo | null = null;
      if (action.usage) {
        const toolUsage = action.toolUsage || {};
        lastUsage = {
          inputTokens: action.usage.input_tokens || 0,
          outputTokens: action.usage.output_tokens || 0,
          iterations: action.iterations,
          toolCount: Object.values(toolUsage).reduce((a, b) => a + b, 0) || undefined,
        };
        const parts: string[] = [];
        parts.push(`${lastUsage.inputTokens.toLocaleString()} in`);
        parts.push(`${lastUsage.outputTokens.toLocaleString()} out`);
        if (lastUsage.iterations && lastUsage.iterations > 1) parts.push(`${lastUsage.iterations} iters`);
        if (lastUsage.toolCount) parts.push(`${lastUsage.toolCount} tools`);
        newMessages.push({ type: 'status', id: nextId(), text: parts.join('  ·  ') });
      }

      // Parse questions from full response (CLI: parse_questions(response))
      const questions = fullResponse ? parseQuestions(fullResponse) : [];

      // Parse plan ready
      const isPlanReady = state.planMode && fullResponse && hasPlanReady(fullResponse);

      return {
        ...state,
        messages: newMessages,
        streamBuffer: '',
        responseParts: [],
        isGenerating: false,
        toolStatus: null,
        lastUsage,
        questions: questions.length > 0 ? questions : null,
        planApproval: (!questions.length && isPlanReady) ? fullResponse : null,
      };
    }

    case 'STREAM_ERROR':
      return {
        ...state,
        messages: [...state.messages, { type: 'error', id: nextId(), text: action.error }],
        streamBuffer: '', responseParts: [],
        isGenerating: false, toolStatus: null,
      };

    // Tool status — CLI: on_status
    case 'THINKING_START':
      return { ...state, toolStatus: { tool: 'thinking', status: 'running' } };
    case 'THINKING_DONE':
      return { ...state, toolStatus: null };

    case 'TOOL_EXEC_START': {
      // CLI: flush_stream_buffer BEFORE showing tool status
      const msgs = [...state.messages];
      if (state.streamBuffer.trim()) {
        msgs.push({ type: 'assistant', id: nextId(), text: state.streamBuffer });
      }
      return {
        ...state,
        messages: msgs,
        streamBuffer: '',
        toolStatus: { tool: action.tool, detail: action.detail, status: 'running' },
      };
    }

    case 'TOOL_EXEC_DONE': {
      const msgs = [...state.messages];
      const parts: string[] = [];
      if (action.durationMs) parts.push(`${action.durationMs}ms`);
      if (action.resultChars) parts.push(`${action.resultChars.toLocaleString()} chars`);
      if (parts.length) {
        msgs.push({ type: 'status', id: nextId(), text: `✓ ${parts.join(' · ')}` });
      }
      return { ...state, messages: msgs, toolStatus: null };
    }

    case 'CODE_VIEW': {
      const label = action.isNew ? 'new' : 'read';
      return {
        ...state,
        messages: [...state.messages, { type: 'status', id: nextId(), text: `📄 ${label} ${action.path} (${action.lines} lines)` }],
      };
    }

    case 'CODE_DIFF':
      return {
        ...state,
        messages: [...state.messages, { type: 'status', id: nextId(), text: `✏️ edit ${action.path}` }],
      };

    // Tool approval cards
    case 'TOOL_PENDING':
      return {
        ...state,
        messages: [...state.messages, {
          type: 'tool', id: `tool-${action.id}`, name: action.name,
          summary: action.summary, status: 'pending',
        }],
      };

    case 'TOOL_RESOLVED':
      return {
        ...state,
        messages: state.messages.map(m => {
          if (m.id === `tool-${action.id}` && m.type === 'tool')
            return { ...m, status: action.denied ? 'denied' as const : 'allowed' as const };
          // Also mark any active approval card as resolved
          if (m.type === 'approval' && !m.resolved)
            return { ...m, resolved: true };
          return m;
        }),
      };

    case 'TOOL_AWAITING_APPROVAL':
      return {
        ...state,
        messages: [...state.messages, {
          type: 'approval' as const,
          id: `approval-${Date.now()}`,
          name: action.name,
          summary: action.summary,
          dangerous: action.dangerous,
          resolved: false,
        }],
      };

    // History
    case 'SET_HISTORY':
      return {
        ...state,
        messages: action.messages.map((m, i) => ({
          type: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          id: `hist-${i}`,
          text: m.text,
        })),
      };

    // User actions
    case 'SEND_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, { type: 'user', id: nextId(), text: action.text }],
      };

    case 'REMOTE_USER_MESSAGE':
      // Message from another client (CLI or another mobile) in the same session
      return {
        ...state,
        messages: [...state.messages, { type: 'user', id: nextId(), text: `[${action.userName}] ${action.text}` }],
      };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [], streamBuffer: '', responseParts: [] };

    case 'SET_QUESTIONS':
      return { ...state, questions: action.questions };
    case 'SET_PLAN_APPROVAL':
      return { ...state, planApproval: action.text };

    case 'TOGGLE_PLAN':
      return { ...state, planMode: !state.planMode };
    case 'SET_PLAN_MODE':
      return { ...state, planMode: action.on };
    case 'SET_PERM_MODE':
      return { ...state, permMode: action.mode };

    // Theme
    case 'SET_THEME':
      return { ...state, themeName: action.name };

    // Connection
    case 'SET_CONN_STATE':
      return { ...state, connState: action.state };

    default:
      return state;
  }
}

// ── Context ──

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  theme: Theme;
  ws: React.MutableRefObject<AcornWebSocket | null>;
}

const AppContext = createContext<AppContextType>(null!);

export function useApp() {
  return useContext(AppContext);
}

// ── Provider ──

export const MONO_FONT = 'JetBrainsMono';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const wsRef = useRef<AcornWebSocket | null>(null);
  const theme = getTheme(state.themeName);

  // Load custom font
  useEffect(() => {
    Font.loadAsync({
      'JetBrainsMono': require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
    }).then(() => setFontsLoaded(true)).catch(() => setFontsLoaded(true)); // continue even if font fails
  }, []);

  // Load saved theme on mount
  useEffect(() => {
    AsyncStorage.getItem('acorn_theme').then(saved => {
      if (saved) dispatch({ type: 'SET_THEME', name: saved });
    }).catch(() => {});
  }, []);

  // Persist theme when it changes
  useEffect(() => {
    if (state.themeName !== DEFAULT_THEME || state.screen !== 'auth') {
      AsyncStorage.setItem('acorn_theme', state.themeName).catch(() => {});
    }
  }, [state.themeName]);

  // Wire WebSocket events → dispatch
  const handleWsEvent = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'chat:start':
        dispatch({ type: 'STREAM_START' });
        break;
      case 'chat:delta':
        dispatch({ type: 'STREAM_DELTA', text: event.text });
        break;
      case 'chat:done':
        dispatch({
          type: 'STREAM_DONE', text: event.text,
          usage: event.usage, iterations: event.iterations, toolUsage: event.toolUsage,
        });
        break;
      case 'chat:error':
        dispatch({ type: 'STREAM_ERROR', error: event.error });
        break;
      case 'chat:history':
        if (event.messages?.length) {
          dispatch({ type: 'SET_HISTORY', messages: event.messages });
        }
        break;
      case 'chat:status':
        if (event.status === 'thinking_start') dispatch({ type: 'THINKING_START' });
        else if (event.status === 'thinking_done') dispatch({ type: 'THINKING_DONE' });
        else if (event.status === 'tool_exec_start') dispatch({ type: 'TOOL_EXEC_START', tool: event.tool || '', detail: event.detail });
        else if (event.status === 'tool_exec_done') dispatch({ type: 'TOOL_EXEC_DONE', durationMs: event.durationMs, resultChars: event.resultChars });
        break;
      case 'code:view':
        dispatch({ type: 'CODE_VIEW', path: event.path, lines: (event.content || '').split('\n').length, isNew: !!event.isNew });
        break;
      case 'code:diff':
        dispatch({ type: 'CODE_DIFF', path: event.path });
        break;
      case 'tool:pending':
        dispatch({ type: 'TOOL_PENDING', id: event.id, name: event.name, summary: event.summary });
        break;
      case 'tool:resolved':
        dispatch({ type: 'TOOL_RESOLVED', id: event.id, denied: event.denied });
        break;
      case 'chat:user-message':
        dispatch({ type: 'REMOTE_USER_MESSAGE', text: event.text, userName: event.userName });
        break;
      case 'tool:awaiting-approval':
        dispatch({ type: 'TOOL_AWAITING_APPROVAL', name: event.name, summary: event.summary, dangerous: event.dangerous });
        break;
    }
  }, []);

  const handleConnState = useCallback((s: ConnectionState) => {
    dispatch({ type: 'SET_CONN_STATE', state: s });
  }, []);

  // Create/destroy WebSocket when credentials change
  useEffect(() => {
    const creds = state.credentials;
    if (!creds?.token) {
      if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; }
      return;
    }
    // Tear down old WS and create fresh one every time credentials change
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    const ws = new AcornWebSocket(creds.serverUrl, creds.token, handleWsEvent, handleConnState);
    wsRef.current = ws;
    ws.connect();
    return () => { ws.disconnect(); wsRef.current = null; };
  // Only recreate when token or serverUrl actually changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.credentials?.token, state.credentials?.serverUrl]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg }}><ActivityIndicator color={theme.accent} /></View>;
  }

  return (
    <AppContext.Provider value={{ state, dispatch, theme, ws: wsRef }}>
      {children}
    </AppContext.Provider>
  );
}
