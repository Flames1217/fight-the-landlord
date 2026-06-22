import { useEffect, useMemo, useState } from 'react';
import { MsgType } from '../../protocol/types';
import type { GameSocket } from '../../transport/wsClient';
import { useAppStore, useChatStore, type TableAction } from '../../stores/appStore';
import { cardKey, generateSimpleSuggestions, summarizeHand } from '../../shared/cards/cardModel';
import { Card } from '../../shared/cards/Card';
import { Hand } from '../../shared/cards/Hand';
import type { CardInfo, PlayerInfo, UtilityDrawer } from '../../protocol/types';

interface GameTableProps {
  socket: GameSocket;
}

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
  const drawer = useAppStore((state) => state.drawer);
  const setDrawer = useAppStore((state) => state.setDrawer);
  const toggleCard = useAppStore((state) => state.toggleCard);
  const setSelection = useAppStore((state) => state.setSelection);
  const seats = useMemo(() => arrangeSeats(players, playerId), [players, playerId]);
  const isMyTurn = currentTurn === playerId;

  return (
    <main className="table-screen terminal-screen ddz-table-screen">
      <section className="ddz-table-shell">
        <header className="ddz-counter-row">
          <CounterRibbon />
          <BottomCardBox cards={bottomCards} revealed={bottomCardsRevealed} />
        </header>

        <section className="ddz-seat-row">
          <PlayerSeat player={seats.left} highlight={currentTurn === seats.left?.id} />
          <PlayerSeat player={seats.right} highlight={currentTurn === seats.right?.id} />
          <PlayedSummary playerName={lastPlayedName} cards={lastPlayed} handType={lastHandType} />
        </section>

        <section className="ddz-hand-box">
          <div className="ddz-hand-title">
            <span>我的手牌 {seats.me?.is_landlord ? '👑' : '🧑‍🌾'}</span>
            <strong>({hand.length}张)</strong>
          </div>
          <div className="ddz-hand-wrap">
            <Hand
              cards={hand}
              selected={selectedCards}
              disabled={phase !== 'playing'}
              onToggle={toggleCard}
              onRangeSelect={setSelection}
            />
          </div>
        </section>

        <TurnPrompt />
        <ActionBar socket={socket} isMyTurn={isMyTurn} phase={phase} />
      </section>

      <UtilityDrawer socket={socket} drawer={drawer} onClose={() => setDrawer('none')} />
    </main>
  );
}

function CounterRibbon() {
  const counter = useAppStore((state) => state.cardCounter);
  const order = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];
  return (
    <div className="ddz-counter-box">
      <div className="ddz-counter-line">
        {order.map((rank) => <span key={rank}>{rankLabel(rank)}</span>)}
      </div>
      <div className="ddz-counter-line ddz-counter-line--values">
        {order.map((rank) => <span key={rank}>{counter[rank] ?? 0}</span>)}
      </div>
    </div>
  );
}

function BottomCardBox({ cards, revealed }: { cards: CardInfo[]; revealed: boolean }) {
  return (
    <div className="ddz-bottom-box">
      <div className="ddz-bottom-title">底牌</div>
      <div className="ddz-bottom-cards">
        {(revealed ? cards : Array.from({ length: 3 }, () => null)).slice(0, 3).map((card, index) => (
          <div key={index} className="ddz-bottom-card">
            {card ? <Card card={card} size="mini" /> : <span className="ddz-bottom-card__back" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerSeat({ player, highlight = false }: { player?: PlayerInfo; highlight?: boolean }) {
  if (!player) return <div className="ddz-seat-box" />;

  return (
    <div className={`ddz-seat-box ${highlight ? 'is-active' : ''}`}>
      <div className="ddz-seat-name">
        <span>{player.is_landlord ? '👑' : '🧑‍🌾'}</span>
        <strong>{player.name}</strong>
      </div>
      <div className="ddz-seat-count">{player.cards_count || 0}张</div>
    </div>
  );
}

function PlayedSummary({ playerName, cards, handType }: { playerName: string; cards: CardInfo[]; handType: string }) {
  return (
    <div className="ddz-played-box">
      {cards.length ? (
        <>
          <div className="ddz-played-title">{playerName || '上一手'}：{handType || '出牌'}</div>
          <div className="ddz-played-cards">
            {cards.map((card, index) => (
              <Card key={`${card.suit}_${card.rank}_${index}`} card={card} size="action" />
            ))}
          </div>
        </>
      ) : (
        <div className="ddz-played-placeholder">等待首家出牌</div>
      )}
    </div>
  );
}

function TurnPrompt() {
  const playerId = useAppStore((state) => state.playerId);
  const players = useAppStore((state) => state.players);
  const currentTurn = useAppStore((state) => state.currentTurn);
  const timeout = useAppStore((state) => state.timeout);
  const timerStart = useAppStore((state) => state.timerStart);
  const multiplier = useAppStore((state) => state.multiplier);
  const tableMessage = useAppStore((state) => state.tableMessage);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, []);

  const remaining = timeout ? Math.max(0, Math.ceil(timeout - (now - timerStart) / 1000)) : 0;
  const actor = players.find((player) => player.id === currentTurn);
  const isMine = currentTurn === playerId;

  return (
    <section className="ddz-prompt-box">
      <p className="ddz-prompt-main">
        ⏳ {String(remaining).padStart(2, '0')}秒 | {isMine ? '轮到你出牌！' : `等待 ${actor?.name || '玩家'} 出牌...`} | 💥×{multiplier || 1}
      </p>
      <p className="ddz-prompt-sub">
        &gt; {tableMessage || 'C 键记牌器，T 键聊天，H 键历史'}
      </p>
    </section>
  );
}

function ActionBar({ socket, isMyTurn, phase }: GameTableProps & { isMyTurn: boolean; phase: string }) {
  const hand = useAppStore((state) => state.hand);
  const selectedCards = useAppStore((state) => state.selectedCards);
  const lastPlayed = useAppStore((state) => state.lastPlayed);
  const mustPlay = useAppStore((state) => state.mustPlay);
  const canBeat = useAppStore((state) => state.canBeat);
  const isGrabTurn = useAppStore((state) => state.isGrabTurn);
  const setSelection = useAppStore((state) => state.setSelection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const setDrawer = useAppStore((state) => state.setDrawer);
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
      useAppStore.setState({ tableMessage: '没有能大过上家的牌，不能 PASS' });
      return;
    }
    socket.send(MsgType.Pass);
    clearSelection();
  }

  function hint() {
    const suggestions = generateSimpleSuggestions(hand, lastPlayed, mustPlay);
    if (!suggestions.length) {
      useAppStore.setState({ tableMessage: mustPlay ? '暂无提示' : '没有能大过上家的牌，输入 PASS' });
      return;
    }
    setSelection(suggestions[0].map(cardKey));
    useAppStore.setState({ tableMessage: `提示：${summarizeHand(suggestions[0])}` });
  }

  if (phase === 'bidding') {
    return (
      <section className="ddz-command-row">
        <button className="terminal-command-button" onClick={() => socket.send(MsgType.Bid, { bid: true })}>
          {isGrabTurn ? '抢地主' : '叫地主'}
        </button>
        <button className="terminal-command-button" onClick={() => socket.send(MsgType.Bid, { bid: false })}>
          {isGrabTurn ? '不抢' : '不叫'}
        </button>
        <button className="terminal-command-button" onClick={() => setDrawer('counter')}>记牌器</button>
      </section>
    );
  }

  return (
    <section className="ddz-command-row">
      <button className="terminal-command-button" disabled={!isMyTurn || mustPlay} onClick={pass}>PASS</button>
      <button className="terminal-command-button" disabled={!isMyTurn} onClick={hint}>提示</button>
      <button className="terminal-command-button" disabled={!selectedCards.size} onClick={clearSelection}>重选</button>
      <button className="terminal-command-button is-primary" disabled={!canPlay} onClick={play}>出牌</button>
      <button className="terminal-command-button" onClick={() => setDrawer('counter')}>记牌器</button>
      <button className="terminal-command-button" onClick={() => setDrawer('chat')}>聊天</button>
      <button className="terminal-command-button" onClick={() => setDrawer('history')}>历史</button>
    </section>
  );
}

function UtilityDrawer({ socket, drawer, onClose }: GameTableProps & { drawer: UtilityDrawer; onClose: () => void }) {
  const messages = useChatStore((state) => state.messages);
  const chatInput = useAppStore((state) => state.chatInput);
  const setChatInput = useAppStore((state) => state.setChatInput);
  const counter = useAppStore((state) => state.cardCounter);
  const actions = useAppStore((state) => state.recentActions);
  const open = drawer !== 'none';

  function sendChat() {
    const content = chatInput.trim();
    if (!content) return;
    socket.send(MsgType.Chat, { content, scope: 'room' });
    setChatInput('');
  }

  return (
    <aside className={`utility-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <header>
        <strong>{drawerTitle(drawer)}</strong>
        <button onClick={onClose} aria-label="关闭">×</button>
      </header>
      {drawer === 'chat' ? (
        <>
          <div className="chat-feed">
            {messages.filter((message) => message.scope === 'room').slice(-18).map((message, index) => (
              <p key={index}><strong>{message.sender_name || '玩家'}：</strong>{message.content}</p>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="键入房间聊天..."
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendChat();
              }}
            />
            <button onClick={sendChat}>发送</button>
          </div>
        </>
      ) : null}
      {drawer === 'counter' ? (
        <div className="terminal-list-block">
          {Object.entries(counter).map(([rank, count]) => (
            <p key={rank}>{rankLabel(Number(rank))}：{count}</p>
          ))}
        </div>
      ) : null}
      {drawer === 'history' ? <HistoryPanel actions={actions} /> : null}
      {drawer === 'rules' ? <RulesPanel /> : null}
    </aside>
  );
}

function HistoryPanel({ actions }: { actions: TableAction[] }) {
  return (
    <div className="terminal-list-block">
      {actions.length ? [...actions].reverse().slice(0, 12).map((action, index) => (
        <p key={index}>
          {action.player_name || '系统'}：{action.label || (action.type === 'pass' ? '不出' : action.hand_type || '出牌')}
        </p>
      )) : <p>暂无动作</p>}
    </div>
  );
}

function RulesPanel() {
  return (
    <div className="terminal-list-block">
      <p>地主独自对抗两名农民。</p>
      <p>炸弹可压大多数牌型，王炸最大。</p>
      <p>出牌时需大过上一手，或新开一轮。</p>
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

function drawerTitle(drawer: UtilityDrawer): string {
  return ({ chat: '房间聊天', counter: '记牌器', history: '动作历史', rules: '玩法说明', none: '' } satisfies Record<UtilityDrawer, string>)[drawer];
}

function rankLabel(rank: number): string {
  if (rank === 17) return 'R';
  if (rank === 16) return 'B';
  if (rank === 15) return '2';
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}
