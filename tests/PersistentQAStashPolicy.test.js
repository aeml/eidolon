import { planPersistentQAStashSpare } from './persistentQAStashPolicy.js';

const gear = id => ({ id, type: 'ARMOR', slot: 'head', rarity: 'Legendary', stack: 1, maxStack: 1,
    potency: 7, gems: [{ id: 'retained-gem' }], extra: { retained: true } });
test('storage preserves invested/rare gear rather than expanding the sale policy', () => {
    const item = Object.freeze(gear('spare'));
    const state = { inventory: [item], equipment: {}, stash: [] };
    expect(planPersistentQAStashSpare(state)).toEqual({ index: 0, item });
    expect(state.inventory[0]).toBe(item);
    expect(state.stash).toEqual([]);
});
test.each([
    { id: 'chronicle-item-story' }, { type: 'RELIC' }, { type: 'MATERIAL' },
    { slot: 'unknown' }, { maxStack: 99 }, { stack: 2 }
])('quests, unknown gear and stack-merging cases are not moved: %j', extra => {
    expect(planPersistentQAStashSpare({ inventory: [{ ...gear('spare'), ...extra }], equipment: {}, stash: [] })).toBeNull();
});
test('worn and duplicate identities are refused; padded stash uses occupancy, not length', () => {
    const item = gear('spare');
    expect(planPersistentQAStashSpare({ inventory: [item], equipment: { head: item }, stash: [] })).toBeNull();
    expect(planPersistentQAStashSpare({ inventory: [item, item], equipment: {}, stash: [] })).toBeNull();
    expect(planPersistentQAStashSpare({ inventory: [item], equipment: {}, stash: [item] })).toBeNull();
    expect(planPersistentQAStashSpare({ inventory: [item], equipment: {}, stash: Array(100).fill(null) })).toEqual({ index: 0, item });
    expect(planPersistentQAStashSpare({ inventory: [item], equipment: {}, stash: [gear('other')] }, 1)).toBeNull();
});
