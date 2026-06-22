import { decodeMessage, encodeMessage } from '../protocol/codec';
import { MsgType, type IncomingMessage, type MessageType, type OutgoingPayload } from '../protocol/types';
import { loadReconnect, useAppStore } from '../stores/appStore';

type Listener = (message: IncomingMessage) => void;

export const PLAYER_NAME_STORAGE_KEY = 'ddz_web_player_name';

export class GameSocket {
  private socket: WebSocket | null = null;
  private heartbeat: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectIdentity: { id: string; token: string } | null = null;
  private intentionalClose = false;
  private readonly listeners = new Set<Listener>();

  connect(): void {
    if (this.socket) return;
    this.intentionalClose = false;
    const store = useAppStore.getState();
    store.setError('');

    const socket = new WebSocket(buildGameSocketUrl());
    this.socket = socket;
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      if (this.socket !== socket) return;
      useAppStore.getState().setConnected(true);
      this.startHeartbeat();
      const saved = loadReconnect();
      if (saved?.id && saved.token) {
        this.reconnectIdentity = saved;
        this.send(MsgType.Reconnect, { player_id: saved.id, token: saved.token });
      }
      this.send(MsgType.GetOnlineCount);
      this.send(MsgType.GetMaintenanceStatus);
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      const message = decodeMessage(event.data as ArrayBuffer);
      useAppStore.getState().handleMessage(message);
      if (message.type === MsgType.Reconnected && this.reconnectIdentity) {
        const identity = this.reconnectIdentity;
        localStorage.setItem('ddz_next_reconnect', JSON.stringify(identity));
        useAppStore.setState({ playerId: identity.id, reconnectToken: identity.token });
        this.reconnectIdentity = null;
      }
      for (const listener of this.listeners) listener(message);
    };

    socket.onerror = () => {
      if (this.socket !== socket) return;
      useAppStore.getState().setError('连接失败');
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.stopHeartbeat();
      this.socket = null;
      useAppStore.getState().setConnected(false);
      if (!this.intentionalClose) {
        useAppStore.getState().setError('与服务器断开，正在重连');
        this.reconnectTimer = window.setTimeout(() => this.connect(), 2500);
      }
    };
  }

  close(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    localStorage.removeItem('ddz_next_reconnect');
    this.reconnectIdentity = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    useAppStore.getState().setConnected(false);
  }

  send(type: MessageType | string, payload?: OutgoingPayload): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(encodeMessage(type, payload));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = window.setInterval(() => {
      this.send(MsgType.Ping, { timestamp: Date.now() });
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}

export function createGameSocket(): GameSocket {
  return new GameSocket();
}

function buildGameSocketUrl(): string {
  const url = new URL(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
  const preferredName = localStorage.getItem(PLAYER_NAME_STORAGE_KEY)?.trim();
  if (preferredName) url.searchParams.set('name', preferredName);
  return url.toString();
}
