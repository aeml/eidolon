import { recordCollectionCombatReceipt } from './collectionCombatReceipts.js';
import { runInNewContext } from 'node:vm';

test('the deployed-browser counter is self-contained and does not need published test modules', () => {
    const receipts = {};
    const record = runInNewContext(`(${recordCollectionCombatReceipt.toString()})`);
    record(receipts, { type: 'damage', payload: { sourceId: 'hero', targetId: 'foe', amount: 7 } }, 'hero');
    record(receipts, { type: 'damage', payload: { sourceId: 'other', targetId: 'foe', amount: 99 } }, 'hero');
    expect(receipts).toEqual({ foe: { attacks: 0, hits: 1, damage: 7 } });
});

test('separates admitted attacks and actual damage by authoritative target', () => {
    const receipts = {};
    const record = (type, targetId, amount) => recordCollectionCombatReceipt(receipts,
        { type, payload: { sourceId: 'hero', targetId, amount, secret: 'excluded' } }, 'hero');
    record('attack', 'selected');
    record('attack', 'front-enemy');
    record('damage', 'front-enemy', 3);
    record('damage', 'front-enemy', 4);
    expect(receipts).toEqual({ selected: { attacks: 1, hits: 0, damage: 0 },
        'front-enemy': { attacks: 1, hits: 2, damage: 7 } });
});

test('ignores other attackers and unrelated or invalid payloads', () => {
    const receipts = {};
    for (const message of [{ type: 'damage', payload: { sourceId: 'enemy', targetId: 'hero', amount: 3 } },
        { type: 'login', payload: { sourceId: 'hero', password: 'excluded' } },
        { type: 'attack' }, { type: 'attack', payload: { sourceId: 'hero' } }]) {
        recordCollectionCombatReceipt(receipts, message, 'hero');
    }
    expect(receipts).toEqual({});
});
