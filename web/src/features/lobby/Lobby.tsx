import { MsgType } from '../../protocol/types';
import type { GameSocket } from '../../transport/wsClient';
import { useAppStore, useChatStore } from '../../stores/appStore';
import { Icon } from '../../shared/ui/Icon';

interface LobbyProps {
  socket: GameSocket;
}

export function Lobby({ socket }: LobbyProps) {
  const phase = useAppStore((state) => state.phase);
  const panel = useAppStore((state) => state.lobbyPanel);
  const roomCode = useAppStore((state) => state.roomCode);
  const players = useAppStore((state) => state.players);
  const onlineCount = useAppStore((state) => state.onlineCount);
  const playerName = useAppStore((state) => state.playerName);
  const setLobbyPanel = useAppStore((state) => state.setLobbyPanel);

  return (
    <main className="lobby-screen terminal-screen">
      <header className="terminal-header lobby-terminal-header">
        <div className="terminal-title-block">
          <div className="terminal-title-mark" aria-hidden="true">[]</div>
          <div>
            <p className="terminal-kicker">ddz lobby / web terminal</p>
            <h1>斗地主大厅</h1>
            <p className="terminal-subtitle">
              {playerName ? `${playerName}，欢迎回来` : '浏览器版终端大厅'}
            </p>
          </div>
        </div>
        <div className="terminal-chip-row">
          <span className="terminal-chip">在线 {onlineCount || 0}</span>
          <span className="terminal-chip terminal-chip--accent">{phaseLabel(phase)}</span>
        </div>
      </header>

      {phase === 'matching' ? <MatchingPanel /> : null}
      {phase === 'waiting' ? <RoomWaiting socket={socket} roomCode={roomCode} players={players} /> : null}
      {phase !== 'matching' && phase !== 'waiting' ? (
        panel === 'home' ? <LobbyHome socket={socket} /> : <LobbySubPanel socket={socket} panel={panel} />
      ) : null}

      <nav className="terminal-tabs bottom-nav" aria-label="大厅导航">
        <button className={panel === 'home' ? 'is-active' : ''} onClick={() => setLobbyPanel('home')}>大厅</button>
        <button
          className={panel === 'leaderboard' ? 'is-active' : ''}
          onClick={() => {
            setLobbyPanel('leaderboard');
            socket.send(MsgType.GetLeaderboard, { type: 'total', offset: 0, limit: 30 });
          }}
        >
          排行榜
        </button>
        <button
          className={panel === 'stats' ? 'is-active' : ''}
          onClick={() => {
            setLobbyPanel('stats');
            socket.send(MsgType.GetStats);
          }}
        >
          战绩
        </button>
        <button className={panel === 'chat' ? 'is-active' : ''} onClick={() => setLobbyPanel('chat')}>聊天</button>
      </nav>
    </main>
  );
}

function LobbyHome({ socket }: LobbyProps) {
  const roomCodeInput = useAppStore((state) => state.roomCodeInput);
  const roomList = useAppStore((state) => state.roomList);
  const setRoomCodeInput = useAppStore((state) => state.setRoomCodeInput);
  const setError = useAppStore((state) => state.setError);
  const playerName = useAppStore((state) => state.playerName);
  const onlineCount = useAppStore((state) => state.onlineCount);

  function joinRoom() {
    const roomCode = roomCodeInput.trim();
    if (!roomCode) {
      setError('请输入房间号');
      return;
    }
    socket.send(MsgType.JoinRoom, { room_code: roomCode });
  }

  function refreshRooms() {
    socket.send(MsgType.GetRoomList);
  }

  function joinListedRoom(roomCode: string) {
    setRoomCodeInput(roomCode);
    socket.send(MsgType.JoinRoom, { room_code: roomCode });
  }

  return (
    <section className="lobby-home lobby-terminal-layout">
      <section className="terminal-panel terminal-panel--hero">
        <div className="hero-ascii" aria-hidden="true">
          <span>FIGHT THE LANDLORD</span>
          <span>READY / MATCH / PLAY</span>
        </div>
        <div className="terminal-panel__head">
          <span className="terminal-panel__label">会话状态</span>
          <span className="terminal-panel__meta">玩家 {playerName || 'Guest'}</span>
        </div>
        <div className="terminal-hero-copy">
          <h2>进入牌桌</h2>
          <p>保留浏览器联机，把视觉压成终端客户端的干净感。</p>
        </div>
        <div className="terminal-stat-grid">
          <TerminalStat label="在线人数" value={onlineCount || 0} />
          <TerminalStat label="房间缓存" value={roomList.length} />
          <TerminalStat label="模式" value="经典三人" />
        </div>
        <div className="terminal-command-row">
          <button
            className="primary-action"
            onClick={() => {
              useAppStore.setState({ phase: 'matching' });
              socket.send(MsgType.QuickMatch);
            }}
          >
            <Icon name="play" /> 快速开局
          </button>
          <button className="secondary-action secondary-action--green" onClick={() => socket.send(MsgType.CreateRoom)}>
            <Icon name="room" /> 创建房间
          </button>
          <button className="secondary-action secondary-action--blue" onClick={() => socket.send(MsgType.PracticeMatch)}>
            <Icon name="bot" /> 人机练习
          </button>
        </div>
      </section>

      <section className="terminal-panel terminal-panel--sidebar">
        <div className="terminal-panel__head">
          <span className="terminal-panel__label">加入房间</span>
          <span className="terminal-panel__meta">manual connect</span>
        </div>
        <div className="join-strip join-strip--terminal">
          <label htmlFor="room-code">房号</label>
          <input
            id="room-code"
            value={roomCodeInput}
            onChange={(event) => setRoomCodeInput(event.target.value)}
            maxLength={8}
            placeholder="输入房间号"
          />
          <button onClick={joinRoom}>加入</button>
        </div>
        <div className="terminal-log">
          <p>&gt; 支持快速匹配、好友房、人机练习</p>
          <p>&gt; 房号可直接复制给朋友</p>
          <p>&gt; 现在的目标是复刻终端感，不牺牲可玩性</p>
        </div>
      </section>

      <section className="terminal-panel room-browser terminal-panel--wide" aria-label="可加入房间">
        <div className="room-browser__head terminal-panel__head">
          <span className="terminal-panel__label">公开房间列表</span>
          <button className="secondary-action secondary-action--muted" onClick={refreshRooms}>刷新</button>
        </div>
        <div className="terminal-room-table">
          <div className="terminal-room-table__head">
            <span>房间号</span>
            <span>人数</span>
            <span>状态</span>
          </div>
          <div className="room-browser__list">
            {roomList.length ? roomList.map((room) => (
              <button className="room-browser__row" key={room.room_code} onClick={() => joinListedRoom(room.room_code)}>
                <span>{room.room_code}</span>
                <em>{room.player_count}/{room.max_players || 3}</em>
                <strong>{room.player_count >= (room.max_players || 3) ? '满员' : '可加入'}</strong>
              </button>
            )) : <p className="empty-text">暂无可加入房间，点一下刷新试试。</p>}
          </div>
        </div>
      </section>
    </section>
  );
}

function MatchingPanel() {
  return (
    <section className="state-panel terminal-panel terminal-state-panel">
      <span className="spinner spinner--large" />
      <h2>正在寻找牌友</h2>
      <p>系统正在为你分配牌桌，通常几秒内就会进入等待房间。</p>
    </section>
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
    <section className="room-waiting terminal-panel">
      <div className="room-code-panel room-code-panel--terminal">
        <span>当前房间</span>
        <strong>{roomCode || '----'}</strong>
        <p>{players.length}/3 已入座</p>
      </div>
      <div className="seat-list seat-list--terminal">
        {Array.from({ length: 3 }, (_, index) => {
          const player = players.find((item) => item.seat === index) ?? players[index];
          return (
            <div className={`seat-row ${player?.id === playerId ? 'is-me' : ''}`} key={index}>
              <span>{index + 1}</span>
              <strong>{player?.name || '等待加入'}</strong>
              <em>{player ? (player.ready ? '已准备' : '等待中') : '空位'}</em>
            </div>
          );
        })}
      </div>
      <div className="room-actions">
        <button className="primary-action" onClick={() => socket.send(me?.ready ? MsgType.CancelReady : MsgType.Ready)}>
          {me?.ready ? '取消准备' : '准备开始'}
        </button>
        <button
          className="secondary-action secondary-action--muted"
          onClick={() => {
            socket.send(MsgType.LeaveRoom);
            useAppStore.getState().leaveLocalRoom();
          }}
        >
          离开房间
        </button>
      </div>
    </section>
  );
}

function LobbySubPanel({ socket, panel }: LobbyProps & { panel: string }) {
  if (panel === 'leaderboard') return <LeaderboardPanel />;
  if (panel === 'stats') return <StatsPanel />;
  if (panel === 'chat') return <LobbyChat socket={socket} />;
  return <RulesPanel />;
}

function LeaderboardPanel() {
  const entries = useAppStore((state) => state.leaderboard);
  return (
    <section className="sub-panel terminal-panel">
      <div className="terminal-panel__head">
        <span className="terminal-panel__label">排行榜</span>
        <span className="terminal-panel__meta">score board</span>
      </div>
      <div className="ranking-list">
        {entries.length ? entries.map((entry, index) => (
          <div className="ranking-row" key={`${entry.player_id}_${index}`}>
            <span>#{entry.rank || index + 1}</span>
            <strong>{entry.player_name}</strong>
            <em>{entry.score} 分</em>
          </div>
        )) : <p className="empty-text">暂时还没有排行榜数据。</p>}
      </div>
    </section>
  );
}

function StatsPanel() {
  const stats = useAppStore((state) => state.stats);
  return (
    <section className="sub-panel terminal-panel">
      <div className="terminal-panel__head">
        <span className="terminal-panel__label">个人战绩</span>
        <span className="terminal-panel__meta">player profile</span>
      </div>
      {stats ? (
        <div className="stats-grid">
          <Stat label="总局数" value={stats.total_games} />
          <Stat label="胜局" value={stats.wins} />
          <Stat label="胜率" value={`${stats.win_rate.toFixed(1)}%`} />
          <Stat label="积分" value={stats.score} />
          <Stat label="排名" value={`#${stats.rank || '-'}`} />
          <Stat label="最高连胜" value={stats.max_win_streak} />
        </div>
      ) : <p className="empty-text">点一下底部“战绩”后，这里会显示你的统计。</p>}
    </section>
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
    <section className="sub-panel chat-panel terminal-panel">
      <div className="terminal-panel__head">
        <span className="terminal-panel__label">大厅聊天</span>
        <span className="terminal-panel__meta">global messages</span>
      </div>
      <div className="chat-feed">
        {messages.filter((message) => message.scope !== 'room').slice(-20).map((message, index) => (
          <p key={index}><strong>{message.sender_name || '玩家'}:</strong> {message.content}</p>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder="和大厅里的玩家聊两句"
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
        />
        <button onClick={send}>发送</button>
      </div>
    </section>
  );
}

function RulesPanel() {
  return (
    <section className="sub-panel rules-panel terminal-panel">
      <div className="terminal-panel__head">
        <span className="terminal-panel__label">玩法说明</span>
        <span className="terminal-panel__meta">rules</span>
      </div>
      <p>地主独自对抗两名农民，任意一方先出完手牌即可获胜。</p>
      <p>支持单张、对子、三张、顺子、连对、飞机、炸弹和王炸。</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TerminalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="terminal-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function phaseLabel(phase: string): string {
  if (phase === 'matching') return '匹配中';
  if (phase === 'waiting') return '等待房间';
  if (phase === 'connecting') return '连接中';
  return '大厅';
}
