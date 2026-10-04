import { orderedItemStatKeys } from '../src/ui/ItemStatOrder.js';
import { renderForgeDecision, renderForgeLimit } from '../src/ui/ForgeDecisionPreview.js';

const expected = ['damage', 'defense', 'strength', 'dexterity', 'intelligence', 'wisdom', 'vitality', 'critChance', 'fireDamage'];
const values = { damage: 30, defense: 5, strength: 8, dexterity: 9, intelligence: 10, wisdom: 11, vitality: 12, critChance: 0, fireDamage: 2 };

test('item stat order ignores insertion order and retains zero-valued and unfamiliar stats', () => {
    expect(orderedItemStatKeys(null)).toEqual([]);
    expect(orderedItemStatKeys(Object.fromEntries(Object.entries(values).reverse()))).toEqual(expected);
    expect(orderedItemStatKeys(values)).toEqual(expected);
    expect(values.critChance).toBe(0);
});

test.each(['upgrade', 'potency', 'limit'])('%s Forge rows remain ordered across repeated shuffled authoritative refreshes', mode => {
    const host = document.createElement('div');
    for (let offset = 0; offset < expected.length * 2; offset++) {
        const entries = Object.entries(values);
        const split = offset % entries.length;
        const stats = Object.fromEntries([...entries.slice(split), ...entries.slice(0, split)].reverse());
        const item = { level: 30, potency: 0, stats };
        host.replaceChildren();
        if (mode === 'limit') renderForgeLimit(host, item, 'Maximum reached', key => key);
        else renderForgeDecision(host, item, [{ label: 'Next', cost: 1,
            ...(mode === 'upgrade' ? { level: 31 } : { potency: 1 }) }], key => key,
        mode === 'upgrade' ? 'Shards' : 'Hearts', 100);
        const labels = [...host.querySelectorAll(mode === 'limit' ? 'dt' : 'tbody th')].map(node => node.textContent);
        expect(mode === 'limit' ? labels : labels.slice(0, -1)).toEqual(expected);
        const numbers = [...host.querySelectorAll(mode === 'limit' ? 'dd' : 'tbody tr td:first-of-type')].map(node => node.textContent);
        expect(numbers.slice(0, expected.length)).toEqual(expected.map(key => String(values[key])));
    }
});
