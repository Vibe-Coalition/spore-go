// ── Data models ──

export interface Credentials {
  serverUrl: string;
  username: string;
  key: string;
  token?: string;
}

export interface Session {
  key: string;
  project: string;
  created: string;
  updated: string;
  messageCount: number;
  active: boolean;
}

// ── Chat items (what the FlatList renders) ──

export type ChatItem =
  | { type: 'user'; id: string; text: string }
  | { type: 'assistant'; id: string; text: string }
  | { type: 'tool'; id: string; name: string; summary: string; status: 'pending' | 'allowed' | 'denied' }
  | { type: 'status'; id: string; text: string }
  | { type: 'error'; id: string; text: string };

export interface ToolStatus {
  tool: string;
  detail?: string;
  status: 'running' | 'done';
  durationMs?: number;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  iterations?: number;
  toolCount?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
export type PermMode = 'ask' | 'auto' | 'yolo';

// ── WebSocket events from server ──

export type WsEvent =
  | { type: 'chat:start'; sessionId?: string }
  | { type: 'chat:delta'; text: string }
  | { type: 'chat:done'; text: string; usage?: { input_tokens?: number; output_tokens?: number }; iterations?: number; toolUsage?: Record<string, number> }
  | { type: 'chat:error'; error: string }
  | { type: 'chat:history'; messages: Array<{ role: string; text: string; ts?: string }>; sessionId?: string }
  | { type: 'chat:status'; status: string; tool?: string; detail?: string; durationMs?: number; resultChars?: number }
  | { type: 'chat:tool'; tool: string }
  | { type: 'code:view'; path: string; content?: string; isNew?: boolean }
  | { type: 'code:diff'; path: string }
  | { type: 'tool:pending'; id: string; name: string; summary: string }
  | { type: 'tool:resolved'; id: string; denied: boolean }
  | { type: 'session:observe:ok'; sessionId: string; active: boolean }
  | { type: 'pong' };

// ── Reducer actions ──

export type AppAction =
  // Navigation
  | { type: 'SET_SCREEN'; screen: 'auth' | 'sessions' | 'chat' }
  | { type: 'AUTH_SUCCESS'; credentials: Credentials }
  | { type: 'LOGOUT' }
  | { type: 'SELECT_SESSION'; session: Session }
  | { type: 'BACK_TO_SESSIONS' }
  // Sessions
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'UPDATE_CREDENTIALS'; credentials: Credentials }
  // Chat streaming
  | { type: 'STREAM_START' }
  | { type: 'STREAM_DELTA'; text: string }
  | { type: 'STREAM_DONE'; text: string; usage?: { input_tokens?: number; output_tokens?: number }; iterations?: number; toolUsage?: Record<string, number> }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'FLUSH_BUFFER' }
  // Tool status
  | { type: 'THINKING_START' }
  | { type: 'THINKING_DONE' }
  | { type: 'TOOL_EXEC_START'; tool: string; detail?: string }
  | { type: 'TOOL_EXEC_DONE'; durationMs?: number; resultChars?: number }
  | { type: 'CODE_VIEW'; path: string; lines: number; isNew: boolean }
  | { type: 'CODE_DIFF'; path: string }
  // Tool approval
  | { type: 'TOOL_PENDING'; id: string; name: string; summary: string }
  | { type: 'TOOL_RESOLVED'; id: string; denied: boolean }
  // History
  | { type: 'SET_HISTORY'; messages: Array<{ role: string; text: string; ts?: string }> }
  // User actions
  | { type: 'SEND_MESSAGE'; text: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_QUESTIONS'; questions: any[] | null }
  | { type: 'SET_PLAN_APPROVAL'; text: string | null }
  | { type: 'TOGGLE_PLAN' }
  | { type: 'SET_PLAN_MODE'; on: boolean }
  | { type: 'SET_PERM_MODE'; mode: PermMode }
  // Theme
  | { type: 'SET_THEME'; name: string }
  // Connection
  | { type: 'SET_CONN_STATE'; state: ConnectionState };
