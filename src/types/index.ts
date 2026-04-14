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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export interface ToolStatus {
  tool: string;
  detail?: string;
  status: 'running' | 'done';
  durationMs?: number;
}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// WebSocket events from server
export type WsEvent =
  | { type: 'chat:start'; sessionId: string }
  | { type: 'chat:delta'; text: string }
  | { type: 'chat:done'; text: string; usage?: Usage; iterations?: number }
  | { type: 'chat:error'; error: string }
  | { type: 'chat:history'; messages: Array<{ role: string; text: string; ts?: string }>; sessionId?: string }
  | { type: 'chat:status'; status: string; tool?: string; detail?: string; durationMs?: number; resultChars?: number }
  | { type: 'chat:tool'; tool: string }
  | { type: 'tool:pending'; id: string; name: string; summary: string }
  | { type: 'tool:resolved'; id: string; denied: boolean }
  | { type: 'session:observe:ok'; sessionId: string; active: boolean }
  | { type: 'pong' };
