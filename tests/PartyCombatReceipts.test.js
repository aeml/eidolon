import { recordPartyCombatReceipt } from './partyCombatReceipts.js';

test('retains real healing recipient and damage order without inferring health from the net change', () => {
    const receipts = [];
    const heal = Object.freeze({ type: 'heal', payload: Object.freeze({ sourceId: 'cleric', targetId: 'tank', amount: 180 }) });
    recordPartyCombatReceipt(receipts, heal, 'tank', 1000);
    recordPartyCombatReceipt(receipts, { type: 'damage', payload: { sourceId: 'boss', targetId: 'tank', amount: 183 } }, 'tank', 1001);
    expect(receipts).toEqual([
        { type: 'heal', sourceId: 'cleric', targetId: 'tank', amount: 180, observedAtMs: 1000 },
        { type: 'damage', sourceId: 'boss', targetId: 'tank', amount: 183, observedAtMs: 1001 }
    ]);
    expect(heal.payload.amount).toBe(180);
});
test('records actual accepted support targets including self-heals and overheal casts', () => {
    const receipts = [];
    recordPartyCombatReceipt(receipts, { type: 'ability', payload: { sourceId: 'cleric', targetId: 'cleric', skillName: 'Healing Light', extra: 'not retained' } }, 'cleric', 10);
    expect(receipts).toEqual([{ type: 'ability', sourceId: 'cleric', targetId: 'cleric', skillName: 'Healing Light', observedAtMs: 10 }]);
});
test.each([
    { type: 'login', payload: { sourceId: 'tank', targetId: 'tank', amount: 1 } },
    { type: 'heal', payload: { sourceId: 'other', targetId: 'other', amount: 1 } },
    { type: 'heal', payload: { sourceId: 'cleric', targetId: 'tank', amount: NaN } },
    { type: 'damage', payload: { sourceId: 'boss', targetId: 'tank', amount: -1 } },
    { type: 'ability', payload: { sourceId: 'tank', targetId: '', skillName: '' } },
    null
])('ignores unrelated or invalid receipts: %j', message => {
    const receipts = [];
    recordPartyCombatReceipt(receipts, message, 'tank', 100);
    expect(receipts).toEqual([]);
});
test('retention is bounded and rejects invalid times', () => {
    const receipts = [], message = { type: 'heal', payload: { sourceId: 'cleric', targetId: 'tank', amount: 1 } };
    recordPartyCombatReceipt(receipts, message, 'tank', NaN);
    expect(receipts).toEqual([]);
    for (let i = 0; i < 100; i++) recordPartyCombatReceipt(receipts, message, 'tank', i);
    expect(receipts).toHaveLength(64);
    expect(receipts[0].observedAtMs).toBe(36);
    expect(receipts.at(-1).observedAtMs).toBe(99);
});
