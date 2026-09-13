import { itemStatTotals, renderEquipmentComparison } from '../src/ui/EquipmentComparison.js';
import { renderForgeDecision } from '../src/ui/ForgeDecisionPreview.js';
import { forgePreview } from '../src/core/ForgeProgression.js';

beforeEach(() => { document.body.innerHTML = '<div id="host"></div>'; });
const host = () => document.getElementById('host');

test('comparison includes gem gains and stats absent from the replacement', () => {
    const worn = { slot: 'chest', stats: { defense: 12, vitality: 4 }, gems: [{ stats: { wisdom: 5 } }] };
    const candidate = { stats: { defense: 15 }, gems: [{ stats: { wisdom: 2 } }] };
    renderEquipmentComparison(host(), candidate, { equippedItem: worn, slotKey: 'chest', slotLabel: 'Chest' }, { equipment: { chest: worn } }, s => s);
    expect(host().textContent).toContain('+3 defense');
    expect(host().textContent).toContain('-4 vitality');
    expect(host().textContent).toContain('-3 wisdom');
    expect(itemStatTotals(worn)).toEqual({ defense: 12, vitality: 4, wisdom: 5 });
});

test('comparison flags breaking a set and losing a proc instead of hiding them in a score', () => {
    const worn = { slot: 'chest', setId: 'ward', uniqueEffect: 'guardian' };
    const player = { equipment: { chest: worn, head: { slot: 'head', setId: 'ward' } } };
    renderEquipmentComparison(host(), {}, { equippedItem: worn, slotKey: 'chest', slotLabel: 'Chest' }, player, s => s, { ward: { name: 'Ward', bonus2: {} } });
    expect(host().textContent).toContain('Loses Ward 2-piece bonus');
    expect(host().textContent).toContain('Loses special effect: guardian');
});

test('Forge table shows exact per-choice results and remaining resources', () => {
    const item = { level: 30, potency: 0, stats: { damage: 30 } };
    renderForgeDecision(host(), item, [{ label: 'Lv 31', level: 31, cost: 1 }, { label: 'Lv 40', level: 40, cost: 10 }], s => s, 'Shards', 5);
    const row = host().querySelector('tbody tr');
    const cells = [...row.querySelectorAll('td')].map(cell => cell.textContent);
    expect(cells).toEqual(['30', `${forgePreview(item, 31).stats.damage} (0)`, `${forgePreview(item, 40).stats.damage} (+8)`]);
    expect(host().textContent).toContain('Need 5');
    expect(host().textContent).toContain('progress carries forward');
});

test('labels are text, and preview leaves actual combat gear untouched', () => {
    const item = { level: 1, stats: { '<img src=x>': 1 } };
    renderForgeDecision(host(), item, [{ label: 'Next', level: 2, cost: 1 }], s => s, 'Shards', 1);
    expect(host().querySelector('img')).toBeNull();
    expect(item.stats).toEqual({ '<img src=x>': 1 });
});
