import { restedAuraMeetsBudget } from './restedAuraEvidence.js';

const high = { bank: 20, attached: true, quality: 'high', meshes: 5, batches: 2,
    sparks: 16, ownerGroups: 1, invalid: 0, ownerMatches: true, distance: .05 };

test('native High and Low observations require every spark as well as the draw-mesh budget', () => {
    expect(restedAuraMeetsBudget(high, 'high')).toBe(true);
    expect(restedAuraMeetsBudget({ ...high, quality: 'low', meshes: 4, sparks: 8 }, 'low')).toBe(true);
    expect(restedAuraMeetsBudget(high, 'low')).toBe(false);
    expect(restedAuraMeetsBudget(high, 'unknown')).toBe(false);
    expect(restedAuraMeetsBudget(null, 'high')).toBe(false);
});

test.each([
    { meshes: 19, batches: 0 }, { meshes: 0 }, { sparks: 0 }, { sparks: 15 },
    { batches: 1 }, { ownerGroups: 0 }, { ownerGroups: 2 }, { invalid: 1 },
    { ownerMatches: false }, { attached: false }, { bank: 0 }, { bank: NaN },
    { bank: Infinity }, { distance: null }, { distance: NaN }, { distance: .2 }, { distance: -1 }
])('incomplete, duplicated or detached aura evidence cannot pass: %j', invalid => {
    expect(restedAuraMeetsBudget({ ...high, ...invalid }, 'high')).toBe(false);
});
