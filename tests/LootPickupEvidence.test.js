import { inventoryQuantity, pickupReceipt } from './e2e/lootPickupEvidence.js';

describe('real pickup evidence', () => {
    const equipment = { id: 'new-sword', name: 'Sword', stack: 1, maxStack: 1 };
    const shard = { id: 'drop-shard', name: 'Eidolic Shard', stack: 1, maxStack: 1000 };
    test('recognizes a stack merge even when 24 occupied slots stay 24', () => {
        const before = Array.from({ length: 23 }, (_, i) => ({ id: `gear-${i}`, name: 'Sword', stack: 1, maxStack: 1 }));
        before.push({ ...shard, id: 'owned-stack', stack: 9 });
        const after = before.map(item => item.id === 'owned-stack' ? { ...item, stack: 10 } : item);
        expect(after.filter(item => item.id).length > before.filter(item => item.id).length).toBe(false);
        expect(pickupReceipt(before, after, shard)).toMatchObject({ previousQuantity: 9, quantity: 10 });
    });
    test('tracks equipment by exact id, not a matching equipment name', () => {
        const before = [{ ...equipment, id: 'old-sword' }];
        expect(pickupReceipt(before, [...before, equipment], equipment)).toMatchObject({ previousQuantity: 0, quantity: 1 });
        expect(pickupReceipt([], before, equipment)).toBeNull();
    });
    test('does not accept unchanged inventory, unrelated pickups or missing loot', () => {
        expect(pickupReceipt([], [], shard)).toBeNull();
        expect(pickupReceipt([], [equipment], shard)).toBeNull();
        expect(pickupReceipt([], [equipment], null)).toBeNull();
    });
    test('sums split stacks and proves saved quantity independently of item id', () => {
        const saved = [{ ...shard, id: 'stack-a', stack: 7 }, { ...shard, id: 'stack-b', stack: 3 }];
        expect(inventoryQuantity(saved, shard)).toBe(10);
        expect(inventoryQuantity([{ ...shard, stack: 9 }], shard)).toBeLessThan(10);
    });
    test('a partial stack pickup counts only the quantity actually received', () => {
        const before = [{ ...shard, id: 'existing', stack: 999 }];
        expect(pickupReceipt(before, [{ ...before[0], stack: 1000 }], { ...shard, stack: 5 }))
            .toMatchObject({ previousQuantity: 999, quantity: 1000 });
    });
});
