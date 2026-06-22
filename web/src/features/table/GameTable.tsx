import { useEffect, useMemo, useRef, useState } from 'react';
import { MsgType, type CardInfo, type Phase, type PlayerInfo } from '../../protocol/types';
import type { GameSocket } from '../../transport/wsClient';
import { useAppStore, useChatStore, type SeatAction, type TableAction } from '../../stores/appStore';
import { cardKey, generateSimpleSuggestions, summarizeHand } from '../../shared/cards/cardModel';
import { Card } from '../../shared/cards/Card';
import { Hand } from '../../shared/cards/Hand';

interface GameTableProps {
  socket: GameSocket;
}

const MANAGED_STORAGE_KEY = 'ddz_web_managed';

export function GameTable({ socket }: GameTableProps) {
  const playerId = useAppStore((state) => state.playerId);
  const players = useAppStore((state) => state.players);
  const phase = useAppStore((state) => state.phase);
  const currentTurn = useAppStore((state) => state.currentTurn);
  const hand = useAppStore((state) => state.hand);
  const selectedCards = useAppStore((state) => state.selectedCards);
  const bottomCards = useAppStore((state) => state.bottomCards);
  const bottomCardsRevealed = useAppStore((state) => state.bottomCardsRevealed);
  const lastPlayed = useAppStore((state) => state.lastPlayed);
  const lastPlayedName = useAppStore((state) => state.lastPlayedName);
  const lastHandType = useAppStore((state) => state.lastHandType);
  const seatActions = useAppStore((state) => state.seatActions);
  const toggleCard = useAppStore((state) => state.toggleCard);
  const setSelection = useAppStore((state) => state.setSelection);
  const seats = useMemo(() => arrangeSeats(players, playerId), [players, playerId]);
  const isMyTurn = currentTurn === playerId;
  const [managed, setManaged] = useState(() => localStorage.getItem(MANAGED_STORAGE_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(MANAGED_STORAGE_KEY, String(managed));
  }, [managed]);

  useManagedPlay(socket, managed);

  return (
    <main className="table-screen ddz-table-screen">
      <section className="ddz-game-layout">
        <header className="ddz-game-header">
          <CounterRibbon />
        </header>

        <section className="ddz-board">
          <PlayerSeat
            side="left"
            player={seats.left}
            action={seats.left ? seatActions[seats.left.id] : undefined}
            highlight={currentTurn === seats.left?.id}
          />

          <CenterStage
            bottomCards={bottomCards}
            bottomCardsRevealed={bottomCardsRevealed}
            lastPlayed={lastPlayed}
            lastPlayedName={lastPlayedName}
            lastHandType={lastHandType}
          />

          <PlayerSeat
            side="right"
            player={seats.right}
            action={seats.right ? seatActions[seats.right.id] : undefined}
            highlight={currentTurn === seats.right?.id}
          />
        </section>

        <section className={`ddz-self-zone ${isMyTurn ? 'is-my-turn' : ''}`}>
          <div className="ddz-self-heading">
            <div>
              <span className="ddz-role-mark">{seats.me?.is_landlord ? '地主' : '农民'}</span>
              <strong>{seats.me?.name || '我的手牌'}</strong>
            </div>
            <span>{hand.length} 张</span>
          </div>
          <div className="ddz-hand-wrap">
            <Hand
              cards={hand}
              selected={selectedCards}
              disabled={phase !== 'playing' || !isMyTurn}
              onToggle={toggleCard}
              onRangeSelect={setSelection}
            />
          </div>
        </section>

        <TurnStatus />
        <ActionBar
          socket={socket}
          isMyTurn={isMyTurn}
          phase={phase}
          managed={managed}
          onManagedChange={setManaged}
        />
      </section>

      <PersistentSidePanel socket={socket} />
    </main>
  );
}

function CounterRibbon() {
  const counter = useAppStore((state) => state.cardCounter);
  const order = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];
  return (
    <section className="ddz-counter-box" aria-label="记牌器">
      <div className="ddz-counter-title">
        <strong>记牌器</strong>
        <span>场外剩余</span>
      </div>
      <div className="ddz-counter-grid">
        {order.map((rank) => (
          <div className="ddz-counter-cell" key={rank}>
            <span>{rankLabel(rank)}</span>
            <strong>{counter[rank] ?? 0}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CenterStage({
  bottomCards,
  bottomCardsRevealed,
  lastPlayed,
  lastPlayedName,
  lastHandType
}: {
  bottomCards: CardInfo[];
  bottomCardsRevealed: boolean;
  lastPlayed: CardInfo[];
  lastPlayedName: string;
  lastHandType: string;
}) {
  return (
    <section className="ddz-center-stage">
      <BottomCardBox cards={bottomCards} revealed={bottomCardsRevealed} />
      <div className="ddz-table-play">
        <div className="ddz-table-play__label">
          <span>桌面牌</span>
          {lastPlayed.length ? <strong>{lastPlayedName} · {lastHandType || '出牌'}</strong> : null}
        </div>
        <div className="ddz-table-play__cards">
          {lastPlayed.length ? lastPlayed.map((card, index) => (
            <Card key={`${card.suit}_${card.rank}_${index}`} card={card} size="played" />
          )) : <span className="ddz-empty-action">等待首家出牌</span>}
        </div>
      </div>
    </section>
  );
}

function BottomCardBox({ cards, revealed }: { cards: CardInfo[]; revealed: boolean }) {
  return (
    <section className="ddz-bottom-box" aria-label="底牌">
      <div className="ddz-bottom-title">底牌</div>
      <div className="ddz-bottom-cards">
        {(revealed ? cards : Array.from({ length: 3 }, () => null)).slice(0, 3).map((card, index) => (
          <div key={index} className="ddz-bottom-card">
            {card ? <Card card={card} size="mini" /> : <span className="ddz-bottom-card__back" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerSeat({
  player,
  action,
  highlight,
  side
}: {
  player?: PlayerInfo;
  action?: SeatAction;
  highlight: boolean;
  side: 'left' | 'right';
}) {
  if (!player) return <section className={`ddz-player-panel ddz-player-panel--${side}`} />;

  return (
    <section className={`ddz-player-panel ddz-player-panel--${side} ${highlight ? 'is-active' : ''}`}>
      <header className="ddz-player-panel__header">
        <div>
          <span className="ddz-role-mark">{player.is_landlord ? '地主' : '农民'}</span>
          <strong>{player.name}</strong>
        </div>
        <span className={player.online ? 'is-online' : 'is-offline'}>{player.online ? '在线' : '掉线'}</span>
      </header>
      <div className="ddz-player-count">
        <strong>{player.cards_count || 0}</strong>
        <span>张手牌</span>
      </div>
      <PlayerAction action={action} />
    </section>
  );
}

function PlayerAction({ action }: { action?: SeatAction }) {
  if (!action) return <div className="ddz-player-action is-empty">尚未行动</div>;
  if (action.type === 'play' && action.cards?.length) {
    return (
      <div className="ddz-player-action">
        <span>{action.hand_type || '出牌'}</span>
        <div className="ddz-player-action__cards">
          {action.cards.map((card, index) => (
            <Card key={`${card.suit}_${card.rank}_${index}`} card={card} size="action" />
          ))}
        </div>
      </div>
    );
  }
  return <div className="ddz-player-action is-label">{action.label || (action.type === 'pass' ? '不出' : '等待')}</div>;
}

function TurnStatus() {
  const playerId = useAppStore((state) => state.playerId);
  const players = useAppStore((state) => state.players);
  const phase = useAppStore((state) => state.phase);
  const currentTurn = useAppStore((state) => state.currentTurn);
  const timeout = useAppStore((state) => state.timeout);
  const timerStart = useAppStore((state) => state.timerStart);
  const multiplier = useAppStore((state) => state.multiplier);
  const isGrabTurn = useAppStore((state) => state.isGrabTurn);
  const tableMessage = useAppStore((state) => state.tableMessage);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, []);

  const remaining = timeout ? Math.max(0, Math.ceil(timeout - (now - timerStart) / 1000)) : 0;
  const actor = players.find((player) => player.id === currentTurn);
  const isMine = currentTurn === playerId;
  const actionName = phase === 'bidding' ? (isGrabTurn ? '抢地主' : '叫地主') : '出牌';
  const mainText = isMine
    ? `轮到你${actionName}`
    : `等待 ${actor?.name || '玩家'} ${actionName}`;

  return (
    <section className={`ddz-turn-status ${isMine ? 'is-mine' : ''}`} aria-live="polite">
      <div className="ddz-turn-status__main">
        <strong>{mainText}</strong>
        <span>{String(remaining).padStart(2, '0')} 秒</span>
        <span>倍数 ×{multiplier || 1}</span>
      </div>
      <p>{tableMessage || (isMine ? '请在下方选择操作' : '当前不是你的回合')}</p>
    </section>
  );
}

function ActionBar({
  socket,
  isMyTurn,
  phase,
  managed,
  onManagedChange
}: GameTableProps & {
  isMyTurn: boolean;
  phase: Phase;
  managed: boolean;
  onManagedChange: (managed: boolean) => void;
}) {
  const hand = useAppStore((state) => state.hand);
  const selectedCards = useAppStore((state) => state.selectedCards);
  const lastPlayed = useAppStore((state) => state.lastPlayed);
  const mustPlay = useAppStore((state) => state.mustPlay);
  const canBeat = useAppStore((state) => state.canBeat);
  const isGrabTurn = useAppStore((state) => state.isGrabTurn);
  const setSelection = useAppStore((state) => state.setSelection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const selected = hand.filter((card) => selectedCards.has(cardKey(card)));
  const canPlay = isMyTurn && phase === 'playing' && selected.length > 0 && (mustPlay || canBeat);

  function play() {
    if (!canPlay) {
      useAppStore.setState({ tableMessage: selected.length ? '当前牌型不可出' : '请选择要出的牌' });
      return;
    }
    socket.send(MsgType.PlayCards, { cards: selected });
    clearSelection();
  }

  function pass() {
    if (mustPlay) {
      useAppStore.setState({ tableMessage: '新一轮必须出牌，不能选择不出' });
      return;
    }
    socket.send(MsgType.Pass);
    clearSelection();
  }

  function hint() {
    const suggestions = generateSimpleSuggestions(hand, lastPlayed, mustPlay);
    if (!suggestions.length) {
      useAppStore.setState({ tableMessage: mustPlay ? '暂无提示' : '没有能压过上家的牌，可以选择不出' });
      return;
    }
    setSelection(suggestions[0].map(cardKey));
    useAppStore.setState({ tableMessage: `提示：${summarizeHand(suggestions[0])}` });
  }

  if (phase === 'bidding') {
    return (
      <section className="ddz-command-row">
        <button className="terminal-command-button is-primary" disabled={!isMyTurn} onClick={() => socket.send(MsgType.Bid, { bid: true })}>
          {isGrabTurn ? '抢地主' : '叫地主'}
        </button>
        <button className="terminal-command-button" disabled={!isMyTurn} onClick={() => socket.send(MsgType.Bid, { bid: false })}>
          {isGrabTurn ? '不抢' : '不叫'}
        </button>
        <ManagedButton managed={managed} onChange={onManagedChange} />
      </section>
    );
  }

  return (
    <section className="ddz-command-row">
      <button className="terminal-command-button" disabled={!isMyTurn} onClick={hint}>提示</button>
      <button className="terminal-command-button is-primary" disabled={!canPlay} onClick={play}>出牌</button>
      <button className="terminal-command-button" disabled={!isMyTurn || mustPlay} onClick={pass}>不出</button>
      <button className="terminal-command-button" disabled={!selectedCards.size} onClick={clearSelection}>清除选择</button>
      <ManagedButton managed={managed} onChange={onManagedChange} />
    </section>
  );
}

function ManagedButton({ managed, onChange }: { managed: boolean; onChange: (managed: boolean) => void }) {
  return (
    <button
      className={`terminal-command-button ddz-managed-button ${managed ? 'is-enabled' : ''}`}
      type="button"
      aria-pressed={managed}
      onClick={() => onChange(!managed)}
    >
      托管：{managed ? '开' : '关'}
    </button>
  );
}

function useManagedPlay(socket: GameSocket, managed: boolean) {
  const phase = useAppStore((state) => state.phase);
  const playerId = useAppStore((state) => state.playerId);
  const currentTurn = useAppStore((state) => state.currentTurn);
  const hand = useAppStore((state) => state.hand);
  const lastPlayed = useAppStore((state) => state.lastPlayed);
  const mustPlay = useAppStore((state) => state.mustPlay);
  const canBeat = useAppStore((state) => state.canBeat);
  const isGrabTurn = useAppStore((state) => state.isGrabTurn);
  const timerStart = useAppStore((state) => state.timerStart);
  const actedTurnRef = useRef('');

  useEffect(() => {
    if (!managed || currentTurn !== playerId || (phase !== 'bidding' && phase !== 'playing')) return;

    const turnKey = `${phase}:${currentTurn}:${timerStart}`;
    if (actedTurnRef.current === turnKey) return;

    const timer = window.setTimeout(() => {
      const state = useAppStore.getState();
      if (!managed || state.currentTurn !== state.playerId || state.timerStart !== timerStart) return;

      actedTurnRef.current = turnKey;
      state.clearSelection();

      const decision = getManagedDecision({
        phase: state.phase,
        isGrabTurn,
        hand,
        lastPlayed,
        mustPlay,
        canBeat
      });
      if (!decision) return;

      socket.send(decision.type, decision.payload);
      useAppStore.setState({ tableMessage: decision.message });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [canBeat, currentTurn, hand, isGrabTurn, lastPlayed, managed, mustPlay, phase, playerId, socket, timerStart]);
}

export function getManagedDecision({
  phase,
  isGrabTurn,
  hand,
  lastPlayed,
  mustPlay,
  canBeat
}: {
  phase: Phase;
  isGrabTurn: boolean;
  hand: CardInfo[];
  lastPlayed: CardInfo[];
  mustPlay: boolean;
  canBeat: boolean;
}): { type: string; payload?: Record<string, unknown>; message: string } | null {
  if (phase === 'bidding') {
    return {
      type: MsgType.Bid,
      payload: { bid: false },
      message: `托管：自动${isGrabTurn ? '不抢' : '不叫'}`
    };
  }
  if (phase !== 'playing') return null;
  if (!mustPlay && !canBeat) {
    return { type: MsgType.Pass, message: '托管：自动不出' };
  }

  const suggestions = generateSimpleSuggestions(hand, lastPlayed, mustPlay);
  if (suggestions.length) {
    return {
      type: MsgType.PlayCards,
      payload: { cards: suggestions[0] },
      message: `托管：自动出牌（${summarizeHand(suggestions[0])}）`
    };
  }
  if (!mustPlay) return { type: MsgType.Pass, message: '托管：自动不出' };
  return null;
}

function PersistentSidePanel({ socket }: GameTableProps) {
  const messages = useChatStore((state) => state.messages);
  const chatInput = useAppStore((state) => state.chatInput);
  const setChatInput = useAppStore((state) => state.setChatInput);
  const actions = useAppStore((state) => state.recentActions);

  function sendChat() {
    const content = chatInput.trim();
    if (!content) return;
    socket.send(MsgType.Chat, { content, scope: 'room' });
    setChatInput('');
  }

  return (
    <aside className="ddz-side-panel">
      <section className="ddz-side-section ddz-chat-section">
        <header>房间聊天</header>
        <div className="ddz-chat-feed">
          {messages.filter((message) => message.scope === 'room').slice(-8).map((message, index) => (
            <p key={index}><strong>{message.sender_name || '玩家'}：</strong>{message.content}</p>
          ))}
          {!messages.some((message) => message.scope === 'room') ? <p className="is-muted">暂无聊天消息</p> : null}
        </div>
        <div className="ddz-chat-input">
          <input
            aria-label="房间聊天"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="输入消息..."
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendChat();
            }}
          />
          <button onClick={sendChat}>发送</button>
        </div>
      </section>

      <section className="ddz-side-section ddz-history-section">
        <header>对局历史</header>
        <HistoryPanel actions={actions} />
      </section>
    </aside>
  );
}

function HistoryPanel({ actions }: { actions: TableAction[] }) {
  return (
    <div className="ddz-history-list">
      {actions.length ? [...actions].reverse().slice(0, 12).map((action, index) => (
        <p key={index}>
          <strong>{action.player_name || '系统'}</strong>
          <span>{action.label || (action.type === 'pass' ? '不出' : action.hand_type || '出牌')}</span>
        </p>
      )) : <p className="is-muted">暂无动作</p>}
    </div>
  );
}

function arrangeSeats(players: PlayerInfo[], playerId: string): { me?: PlayerInfo; left?: PlayerInfo; right?: PlayerInfo } {
  const me = players.find((player) => player.id === playerId);
  if (!me) return { left: players[1], right: players[2], me: players[0] };
  const left = players.find((player) => player.seat === (me.seat + 1) % 3);
  const right = players.find((player) => player.seat === (me.seat + 2) % 3);
  return { me, left, right };
}

function rankLabel(rank: number): string {
  if (rank === 17) return '大王';
  if (rank === 16) return '小王';
  if (rank === 15) return '2';
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}
