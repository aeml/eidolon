import { forgePreview, forgeUpgradeCost } from '../src/core/ForgeProgression.js';
import { eidolon } from '../src/proto/state_pb.js';

describe('Forge accumulated progression previews', () => {
    test('binary and JSON item snapshots preserve the same preview, including zero potency', () => {
        const item = { level: 41, potency: 2, stats: { damage: 46 },
            forgeBasis: { level: 30, potency: 0, stats: { damage: 30 }, value: 300 } };
        const decoded = eidolon.state.Item.decode(eidolon.state.Item.encode(item).finish());
        for (const snapshot of [decoded, JSON.parse(JSON.stringify(decoded))]) {
            expect(forgePreview(snapshot, 41, 3)).toEqual({ stats: { damage: 50 }, value: 507 });
        }
    });
    test.each([1, 10, 99])('retains small stat gains and tier prices with batches of %i', batch => {
        const item = { level: 1, potency: 0, stats: { damage: 1, intelligence: 3 }, value: 10 };
        item.forgeBasis = { ...item, stats: { ...item.stats } };
        let cost = 0;
        while (item.level < 100) {
            const quote = forgeUpgradeCost(item.level, batch);
            Object.assign(item, forgePreview(item, quote.target), { level: quote.target });
            cost += quote.cost;
        }
        expect(item.stats).toEqual({ damage: 13, intelligence: 41 });
        expect(item.value).toBe(139);
        expect(cost).toBe(119);
    });

    test('legacy gear retains its current stats as the initial basis', () => {
        const item = { level: 30, potency: 4, stats: { damage: 17 }, value: 300 };
        expect(forgePreview(item, 30, 4)).toEqual({ stats: item.stats, value: 300 });
        expect(forgePreview(item, 40, 4).stats.damage).toBe(21);
        expect(item.stats.damage).toBe(17);
    });

    test('potency preview includes retained fractional progress', () => {
        const item = { level: 100, potency: 4, stats: { damage: 19 },
            forgeBasis: { level: 1, potency: 0, stats: { damage: 1 }, value: 10 } };
        expect(forgePreview(item, 100, 5)).toEqual({ stats: { damage: 20 }, value: 208 });
    });

    test.each([[79, 10, 89, 19], [89, 10, 99, 20], [95, 10, 100, 10], [100, 1, 100, 0]])(
        'quotes the entire %i + %i range', (level, amount, target, cost) => {
            expect(forgeUpgradeCost(level, amount)).toEqual({ target, cost });
        });
});
