import { describe, expect, it } from 'vitest';
import { MsgType, type CardInfo } from '../src/protocol/types';
import { getManagedDecision } from '../src/features/table/GameTable';

function card(suit: number, rank: number): CardInfo {
  return { suit, rank, color: suit === 1 || suit === 3 ? 1 : 0 };
}

describe('managed play decisions', () => {
  it('declines bidding and grabbing without reconnecting', () => {
    expect(getManagedDecision({
      phase: 'bidding',
      isGrabTurn: false,
      hand: [],
      lastPlayed: [],
      mustPlay: false,
      canBeat: false
    })).toMatchObject({ type: MsgType.Bid, payload: { bid: false }, message: '托管：自动不叫' });

    expect(getManagedDecision({
      phase: 'bidding',
      isGrabTurn: true,
      hand: [],
      lastPlayed: [],
      mustPlay: false,
      canBeat: false
    })).toMatchObject({ type: MsgType.Bid, payload: { bid: false }, message: '托管：自动不抢' });
  });

  it('plays a suggested card when leading', () => {
    const decision = getManagedDecision({
      phase: 'playing',
      isGrabTurn: false,
      hand: [card(0, 8), card(1, 3)],
      lastPlayed: [],
      mustPlay: true,
      canBeat: true
    });

    expect(decision?.type).toBe(MsgType.PlayCards);
    expect(decision?.payload).toEqual({ cards: [card(1, 3)] });
  });

  it('passes when the server says the hand cannot beat the table', () => {
    expect(getManagedDecision({
      phase: 'playing',
      isGrabTurn: false,
      hand: [card(0, 8)],
      lastPlayed: [card(1, 14)],
      mustPlay: false,
      canBeat: false
    })).toMatchObject({ type: MsgType.Pass, message: '托管：自动不出' });
  });
});
