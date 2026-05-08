import { WsEvent, ConnectionState } from '../types';

type EventCallback = (event: WsEvent) => void;
type StateCallback = (state: ConnectionState) => void;

const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];

export class SporeGoWebSocket {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private token: string;
  private onEvent: EventCallback;
  private onStateChange: StateCallback;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outbox: string[] = [];
  private closed = false;
  private lastPong: number = Date.now();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    serverUrl: string,
    token: string,
    onEvent: EventCallback,
    onStateChange: StateCallback,
  ) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.onEvent = onEvent;
    this.onStateChange = onStateChange;
  }

  connect() {
    this.closed = false;
    this._connect();
  }

  ensureConnected() {
    if (this.isConnected) return;
    this.closed = false;
    if (this.reconnectTimer) return;
    const state = this.ws?.readyState;
    if (state === WebSocket.CONNECTING) return;
    this._connect();
  }

  private _connect() {
    if (this.closed) return;
    this.onStateChange('connecting');

    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + `/ws?token=${this.token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      this.ws = ws;
      this.reconnectAttempt = 0;
      this.onStateChange('connected');
      console.log('[SporeGoWS] connected to', wsUrl.replace(/token=.*/, 'token=***'));
      // Flush outbox
      for (const msg of this.outbox) {
        try { ws.send(msg); } catch {}
      }
      this.outbox = [];
      // Start ping + dead connection detection
      this.lastPong = Date.now();
      this.pingTimer = setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
        // If no pong in 90s, connection is dead — force close to trigger reconnect
        if (Date.now() - this.lastPong > 90000) {
          console.warn('[SporeGoWS] no pong in 90s, forcing reconnect');
          try { ws.close(); } catch {}
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent;
        if (data.type === 'pong') {
          this.lastPong = Date.now();
          return; // don't forward pong to app
        }
        this.onEvent(data);
      } catch (e) {
        console.warn('[SporeGoWS] onmessage error:', e);
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      this.onStateChange('disconnected');
      if (!this.closed) this._scheduleReconnect();
    };

    ws.onerror = (e) => {
      console.warn('[SporeGoWS] error:', (e as any)?.message || 'unknown');
    };
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = BACKOFF[Math.min(this.reconnectAttempt, BACKOFF.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, delay);
  }

  get isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  send(msg: object) {
    const data = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.outbox.push(data);
    }
  }

  observe(sessionId: string) {
    this.send({ type: 'session:observe', sessionId });
  }

  unobserve(sessionId: string) {
    this.send({ type: 'session:unobserve', sessionId });
  }

  sendMessage(content: string, sessionId: string, userName: string, kind: 'web' | 'code' = 'code') {
    if (kind === 'web') {
      this.send({ type: 'chat', content, sessionId, userName });
    } else {
      this.send({ type: 'chat:message', content, sessionId, userName });
    }
  }

  answerAskUser(qid: string, answer: string | string[]) {
    this.send({ type: 'ask_user_answer', qid, answer });
  }

  requestHistory(sessionId: string) {
    this.send({ type: 'chat:history-request', sessionId });
  }

  stop(sessionId?: string) {
    this.send({ type: 'chat:stop', sessionId });
  }

  updateToken(token: string) {
    this.token = token;
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.onStateChange('disconnected');
  }
}
