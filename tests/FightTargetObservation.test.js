import { observeFightTargetsInPage } from './fightTargetObservation.js';

beforeEach(() => {
    const requested = { id: 'requested', state: 'ATTACKING', health: 102, isActive: true };
    const acquired = { id: 'acquired', state: 'DEAD', health: 0, isActive: false };
    const next = { id: 'next', state: 'IDLE', health: 830, isActive: true };
    window.game = { pendingInteraction: next, remotePlayers: new Map([requested, acquired, next].map(a => [a.id, a])),
        player: { stats: { hp: 140 }, state: 'ATTACKING', position: { toArray: () => [1, 2, 3] } },
        isHostileActorTarget: () => true };
    window.__equippedFightReview = { damage: [{ localSource: true, targetId: 'acquired', amount: 54 }] };
});
afterEach(() => { delete window.game; delete window.__equippedFightReview; });

test('a prior acquired target death remains visible after pointer intent changes to a living enemy', () => {
    const result = observeFightTargetsInPage({ requestedId: 'requested', acquiredIds: ['acquired'] });
    expect(result).toMatchObject({ id: 'acquired', dead: true, targetHp: 0 });
    expect(result.acquiredIds).toEqual(['requested', 'acquired', 'next']);
    expect(window.game.pendingInteraction.id).toBe('next');
});

test('a removed or streamed-out target is not a confirmed defeat', () => {
    window.game.remotePlayers.delete('acquired');
    expect(observeFightTargetsInPage({ requestedId: 'requested', acquiredIds: ['acquired'] }).dead).toBe(false);
});

test.each(['none', 'remote', 'zero'])('death without positive local damage is not credited (%s)', mode => {
    window.__equippedFightReview.damage = mode === 'none' ? [] :
        [{ localSource: mode !== 'remote', targetId: 'acquired', amount: mode === 'zero' ? 0 : 54 }];
    expect(observeFightTargetsInPage({ requestedId: 'requested', acquiredIds: ['acquired'] }).dead).toBe(false);
});

test('a living acquired target remains incomplete even after receiving damage', () => {
    Object.assign(window.game.remotePlayers.get('acquired'), { state: 'ATTACKING', health: 42, isActive: true });
    expect(observeFightTargetsInPage({ requestedId: 'requested', acquiredIds: ['acquired'] }).dead).toBe(false);
});
