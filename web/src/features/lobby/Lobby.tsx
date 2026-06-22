import { MsgType, type LobbyPanel } from '../../protocol/types';
import type { GameSocket } from '../../transport/wsClient';
import { useAppStore, useChatStore } from '../../stores/appStore';

interface LobbyProps {
  socket: GameSocket;
}

const MENU_ITEMS: Array<{ key: LobbyPanel | 'rules'; label: string }> = [
  { key: 'home', label: '1. 快速匹配' },
  { key: 'home', label: '2. 创建房间' },
  { key: 'home', label: '3. 加入房间' },
  { key: 'leaderboard', label: '4. 排行榜' },
  { key: 'stats', label: '5. 我的战绩' },
  { key: 'rules', label: '6. 游戏规则' }
];

export function Lobby({ socket }: LobbyProps) {
  const phase = useAppStore((state) => state.phase);
  const roomCode = useAppStore((state) => state.roomCode);
  const players = useAppStore((state) => state.players);

  if (phase === 'matching') return <MatchingPanel />;
  if (phase === 'waiting') return <RoomWaiting socket={socket} roomCode={roomCode} players={players} />;

  return <LobbyTerminal socket={socket} />;
}

function LobbyTerminal({ socket }: LobbyProps) {
  const panel = useAppStore((state) => state.lobbyPanel);
  const onlineCount = useAppStore((state) => state.onlineCount);
  const playerName = useAppStore((state) => state.playerName);
  const setLobbyPanel = useAppStore((state) => state.setLobbyPanel);

  function choose(item: LobbyPanel | 'rules', index: number) {
    if (index === 0) {
      useAppStore.setState({ phase: 'matching' });
      socket.send(MsgType.QuickMatch);
      return;
    }
    if (index === 1) {
      socket.send(MsgType.CreateRoom);
      return;
    }
    if (index === 2) {
      setLobbyPanel('home');
      return;
    }
    if (item === 'leaderboard') {
      setLobbyPanel('leaderboard');
      socket.send(MsgType.GetLeaderboard, { type: 'total', offset: 0, limit: 30 });
      return;
    }
    if (item === 'stats') {
      setLobbyPanel('stats');
      socket.send(MsgType.GetStats);
      return;
    }
    if (item === 'rules') {
      setLobbyPanel('chat');
      return;
    }
  }

  return (
    <main className="lobby-screen terminal-screen lobby-terminal-screen">
      <section className="lobby-shell">
        <header className="lobby-terminal-intro">
          <p className="lobby-terminal-brand">🎮 欢乐斗地主</p>
          <h1>欢迎，{playerName || '玩家'}！</h1>
          <p className="lobby-terminal-online">🌐 在线玩家：{onlineCount || 0} 人</p>
        </header>

        <section className="lobby-terminal-main">
          <aside className="lobby-menu-panel">
            <h2>请选择：</h2>
            <div className="lobby-menu-list">
              {MENU_ITEMS.map((item, index) => {
                const selected = (index <= 2 && panel === 'home') || (item.key !== 'home' && item.key !== 'rules' && panel === item.key);
                return (
                  <button
                    key={`${item.label}_${index}`}
                    className={`lobby-menu-item ${selected && index === 0 ? 'is-primary' : ''}`}
                    onClick={() => choose(item.key, index)}
                  >
                    <span className="lobby-menu-caret">{selected && index === 0 ? '▶' : ' '}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="lobby-content-panel">
            {panel === 'leaderboard' ? <LeaderboardPanel /> : null}
            {panel === 'stats' ? <StatsPanel /> : null}
            {panel === 'chat' ? <LobbyChat socket={socket} /> : null}
            {panel === 'home' ? <LobbyHome socket={socket} /> : null}
          </section>
        </section>

        <footer className="lobby-terminal-footer">
          <p>&gt; ↑↓ 选择 | 回车确认 | 或输入房间号</p>
          <p className="lobby-terminal-credit">Made with ♥ by Palemoky</p>
        </footer>
      </section>
    </main>
  );
}

function LobbyHome({ socket }: LobbyProps) {
  const messages = useChatStore((state) => state.messages);
  const chatInput = useAppStore((state) => state.chatInput);
  const setChatInput = useAppStore((state) => state.setChatInput);
  const roomCodeInput = useAppStore((state) => state.roomCodeInput);
  const setRoomCodeInput = useAppStore((state) => state.setRoomCodeInput);
  const setError = useAppStore((state) => state.setError);

  function send() {
    const content = chatInput.trim();
    if (!content) return;
    socket.send(MsgType.Chat, { content, scope: 'lobby' });
    setChatInput('');
  }

  function joinRoom() {
    const roomCode = roomCodeInput.trim();
    if (!roomCode) {
      setError('请输入房间号');
      return;
    }
    socket.send(MsgType.JoinRoom, { room_code: roomCode });
  }

  return (
    <div className="lobby-chat-room">
      <div className="lobby-panel-title">💬 聊天室</div>
      <div className="lobby-chat-feed">
        {(messages.filter((message) => message.scope !== 'room').slice(-3)).map((message, index) => (
          <p key={index}>
            [{clockText(message.time)}] {message.sender_name || '玩家'}：{message.content}
          </p>
        ))}
        {!messages.filter((message) => message.scope !== 'room').length ? (
          <>
            <p>[08:37] 系统：欢迎来到大厅</p>
            <p>[08:37] 系统：左侧可快速匹配、建房、查看战绩</p>
            <p>[08:37] 系统：输入房间号后可直接加入好友房</p>
          </>
        ) : null}
      </div>
      <div className="lobby-inline-entry">
        <span>&gt;</span>
        <button className="terminal-inline-button" onClick={joinRoom}>按</button>
        <input
          value={roomCodeInput}
          onChange={(event) => setRoomCodeInput(event.target.value)}
          maxLength={8}
          placeholder="输入房间号加入，或直接在下方聊天..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') joinRoom();
          }}
        />
      </div>
      <div className="lobby-inline-entry">
        <span>&gt;</span>
        <button className="terminal-inline-button" onClick={send}>发</button>
        <input
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder="键入聊天..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
        />
      </div>
    </div>
  );
}

function LobbyChat({ socket }: LobbyProps) {
  const messages = useChatStore((state) => state.messages);
  const chatInput = useAppStore((state) => state.chatInput);
  const setChatInput = useAppStore((state) => state.setChatInput);

  function send() {
    const content = chatInput.trim();
    if (!content) return;
    socket.send(MsgType.Chat, { content, scope: 'lobby' });
    setChatInput('');
  }

  return (
    <div className="lobby-chat-room">
      <div className="lobby-panel-title">💬 聊天室</div>
      <div className="lobby-chat-feed lobby-chat-feed--full">
        {messages.filter((message) => message.scope !== 'room').slice(-12).map((message, index) => (
          <p key={index}>
            [{clockText(message.time)}] {message.sender_name || '玩家'}：{message.content}
          </p>
        ))}
      </div>
      <div className="lobby-inline-entry">
        <span>&gt;</span>
        <button className="terminal-inline-button" onClick={send}>发</button>
        <input
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder="键聊天..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
        />
      </div>
    </div>
  );
}

function LeaderboardPanel() {
  const entries = useAppStore((state) => state.leaderboard);
  return (
    <div className="terminal-info-block">
      <div className="lobby-panel-title">🏆 排行榜</div>
      <div className="terminal-list-block">
        {entries.length ? entries.slice(0, 8).map((entry, index) => (
          <p key={`${entry.player_id}_${index}`}>
            #{entry.rank || index + 1} {entry.player_name} · {entry.score} 分
          </p>
        )) : <p>暂无排行榜数据</p>}
      </div>
    </div>
  );
}

function StatsPanel() {
  const stats = useAppStore((state) => state.stats);
  return (
    <div className="terminal-info-block">
      <div className="lobby-panel-title">📊 我的战绩</div>
      <div className="terminal-list-block">
        {stats ? (
          <>
            <p>总局数：{stats.total_games}</p>
            <p>胜局：{stats.wins}</p>
            <p>胜率：{stats.win_rate.toFixed(1)}%</p>
            <p>积分：{stats.score}</p>
            <p>排名：#{stats.rank || '-'}</p>
            <p>最高连胜：{stats.max_win_streak}</p>
          </>
        ) : <p>点一次“我的战绩”后这里会显示数据。</p>}
      </div>
    </div>
  );
}

function MatchingPanel() {
  return (
    <main className="lobby-screen terminal-screen lobby-terminal-screen">
      <section className="terminal-wait-panel">
        <span className="spinner spinner--large" />
        <h2>正在寻找牌友</h2>
        <p>系统正在匹配在线玩家，请稍候...</p>
      </section>
    </main>
  );
}

function RoomWaiting({
  socket,
  roomCode,
  players
}: LobbyProps & { roomCode: string; players: ReturnType<typeof useAppStore.getState>['players'] }) {
  const playerId = useAppStore((state) => state.playerId);
  const me = players.find((player) => player.id === playerId);

  return (
    <main className="lobby-screen terminal-screen lobby-terminal-screen">
      <section className="waiting-shell">
        <div className="waiting-room-code">房间 {roomCode || '----'}</div>
        <div className="waiting-seat-list">
          {Array.from({ length: 3 }, (_, index) => {
            const player = players.find((item) => item.seat === index) ?? players[index];
            return (
              <div className={`waiting-seat ${player?.id === playerId ? 'is-me' : ''}`} key={index}>
                <strong>{player?.name || '等待加入'}</strong>
                <span>{player ? (player.ready ? '已准备' : '等待中') : '空位'}</span>
              </div>
            );
          })}
        </div>
        <div className="waiting-actions">
          <button className="terminal-text-button" onClick={() => socket.send(me?.ready ? MsgType.CancelReady : MsgType.Ready)}>
            {me?.ready ? '取消准备' : '准备开始'}
          </button>
          <button
            className="terminal-text-button"
            onClick={() => {
              socket.send(MsgType.LeaveRoom);
              useAppStore.getState().leaveLocalRoom();
            }}
          >
            离开房间
          </button>
        </div>
      </section>
    </main>
  );
}

function clockText(time?: number): string {
  if (!time) return '00:00';
  const date = new Date(time * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
