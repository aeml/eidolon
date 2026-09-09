import { createEarnedCombatEvidence, recordEarnedCombatMessage } from './earnedCombatEvidence.js';

test('records actual outgoing and incoming damage separately from accepted casts', () => {
    const state = createEarnedCombatEvidence();
    state.requestedId = 'imp-goal';
    recordEarnedCombatMessage(state, { type: 'ability_result', payload: { skillName: 'Fireball', accepted: true } }, 'hero', 10);
    recordEarnedCombatMessage(state, { type: 'damage', payload: { sourceId: 'hero', targetId: 'elite-other', amount: 72, kind: 'fire' } }, 'hero', 11);
    recordEarnedCombatMessage(state, { type: 'damage', payload: { sourceId: 'imp-goal', targetId: 'hero', amount: 9, kind: 'physical' } }, 'hero', 12);
    expect(state.outgoing).toEqual({ hits: 1, amount: 72 });
    expect(state.incoming).toEqual({ hits: 1, amount: 9 });
    expect(state.samples[1]).toMatchObject({ requestedId: 'imp-goal', targetId: 'elite-other', amount: 72, kind: 'fire', at: 11 });
    expect(state.samples[0]).toMatchObject({ type: 'ability_result', skillName: 'Fireball', accepted: true });
});

test('ignores unrelated combat and invalid damage without manufacturing hits', () => {
    const state = createEarnedCombatEvidence();
    for (const amount of [NaN, Infinity, -1, '9']) {
        recordEarnedCombatMessage(state, { type: 'damage', payload: { sourceId: 'hero', targetId: 'imp', amount } }, 'hero', 0);
    }
    recordEarnedCombatMessage(state, { type: 'damage', payload: { sourceId: 'other-player', targetId: 'imp', amount: 9 } }, 'hero', 0);
    recordEarnedCombatMessage(state, { type: 'update', payload: {} }, 'hero', 0);
    expect(state.samples).toEqual([]);
    expect(state.outgoing.hits).toBe(0);
});

test('bounds retained detail while preserving exact total hit counters', () => {
    const state = createEarnedCombatEvidence();
    for (let i = 0; i < 150; i++) recordEarnedCombatMessage(state,
        { type: 'damage', payload: { sourceId: 'hero', targetId: 'imp', amount: 2 } }, 'hero', i);
    expect(state.samples).toHaveLength(100);
    expect(state.samples[0].at).toBe(50);
    expect(state.outgoing).toEqual({ hits: 150, amount: 300 });
});
