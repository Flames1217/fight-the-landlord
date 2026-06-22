import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeMessage } from '../src/protocol/codec';
import { MsgType } from '../src/protocol/types';
import { useAppStore } from '../src/stores/appStore';
import { GameSocket } from '../src/transport/wsClient';

class FakeWebSocket {
  static OPEN = 1;
  static instance: FakeWebSocket | null = null;

  readyState = FakeWebSocket.OPEN;
  binaryType = '';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: Uint8Array }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: Uint8Array[] = [];

  constructor(public readonly url: string) {
    FakeWebSocket.instance = this;
  }

  send(data: Uint8Array) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe('GameSocket reconnect identity', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    localStorage.clear();
    useAppStore.setState({
      connected: false,
      playerId: '',
      playerName: '',
      reconnectToken: '',
      phase: 'connecting'
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWebSocket.instance = null;
  });

  it('keeps the original reconnect token after the temporary connected identity', () => {
    localStorage.setItem('ddz_next_reconnect', JSON.stringify({ id: 'player-old', token: 'token-old' }));
    const gameSocket = new GameSocket();
    gameSocket.connect();

    const socket = FakeWebSocket.instance!;
    socket.onopen?.();
    socket.onmessage?.({
      data: encodeMessage(MsgType.Connected, {
        player_id: 'player-temporary',
        player_name: 'Temporary',
        reconnect_token: 'token-temporary'
      })
    });
    socket.onmessage?.({
      data: encodeMessage(MsgType.Reconnected, {
        player_id: 'player-old',
        player_name: 'Flamez'
      })
    });

    expect(useAppStore.getState().playerId).toBe('player-old');
    expect(useAppStore.getState().reconnectToken).toBe('token-old');
    expect(JSON.parse(localStorage.getItem('ddz_next_reconnect')!)).toEqual({
      id: 'player-old',
      token: 'token-old'
    });
  });
});
