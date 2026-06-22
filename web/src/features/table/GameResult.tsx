import { MsgType } from '../../protocol/types';
import type { GameSocket } from '../../transport/wsClient';
import { useAppStore } from '../../stores/appStore';
import { PlayedCards } from '../../shared/cards/PlayedCards';

export function GameResult({ socket }: { socket: GameSocket }) {
  const playerId = useAppStore((state) => state.playerId);
  const winnerName = useAppStore((state) => state.winnerName);
  const winnerId = useAppStore((state) => state.winnerId);
  const winnerIsLandlord = useAppStore((state) => state.winnerIsLandlord);
  const finalMultiplier = useAppStore((state) => state.finalMultiplier);
  const scores = useAppStore((state) => state.scores);
  const playerHands = useAppStore((state) => state.playerHands);
  const didWin = scores.some((score) => score.player_id === playerId && score.score > 0)
    || winnerId === playerId;

  return (
    <main className="result-screen">
      <section className="result-panel">
        <header className="result-header">
          <span className="result-badge">{winnerIsLandlord ? '地主获胜' : '农民获胜'}</span>
          <div>
            <p>{didWin ? '本局胜利' : '本局结束'}</p>
            <h1>{winnerName || '本局玩家'} 获胜</h1>
          </div>
          <strong className="result-multiplier">倍数 ×{finalMultiplier || 1}</strong>
        </header>

        <section className="result-score-section">
          <h2>本局积分</h2>
          <div className="score-list">
          {scores.map((score) => (
            <div className={`score-row ${score.player_id === playerId ? 'is-me' : ''}`} key={score.player_id}>
              <span>
                <small>{score.is_landlord ? '地主' : '农民'}</small>
                {score.player_name}
                {score.player_id === playerId ? '（你）' : ''}
              </span>
              <strong className={score.score >= 0 ? 'is-positive' : 'is-negative'}>{score.score >= 0 ? '+' : ''}{score.score}</strong>
            </div>
          ))}
          </div>
        </section>

        <section className="result-hands-section">
          <h2>剩余手牌</h2>
          <div className="remaining-hands">
            {playerHands.length ? playerHands.map((playerHand) => (
              <PlayedCards key={playerHand.player_id} cards={playerHand.cards} playerName={playerHand.player_name} compact />
            )) : <p className="result-empty">所有玩家均已出完手牌</p>}
          </div>
        </section>

        <div className="room-actions">
          <button className="primary-action" onClick={() => socket.send(MsgType.Ready)}>再来一局</button>
          <button
            className="secondary-action"
            onClick={() => {
              socket.send(MsgType.LeaveRoom);
              useAppStore.getState().leaveLocalRoom();
            }}
          >
            返回大厅
          </button>
        </div>
      </section>
    </main>
  );
}
