import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';
import { itemStatTotals } from '../src/ui/EquipmentComparison.js';
import { RARITY, SET_DEFINITIONS, UNIQUE_EFFECTS } from '../src/core/ItemSystem.js';

const probe = '<b data-tooltip-probe="saved">Legacy & "quoted"</b>';
const gear = (id, fields = {}) => ({ id, name: `Blade ${id}`, baseName: 'Iron Sword', slot: 'mainHand',
    type: 'WEAPON', rarity: { ...RARITY.RARE }, level: 4, stats: { damage: 7 }, ...fields });
const owners = [];
function fixture({ level = 10, equipped = gear('equipped'), candidate = gear('candidate'), compare = false } = {}) {
    document.body.innerHTML = '<div id="stat-tooltip"><h3 id="stat-tooltip-title"></h3><div id="stat-tooltip-desc"></div></div>'
        + '<div id="compare-tooltip"><h3 id="compare-tooltip-title"></h3><div id="compare-tooltip-desc"></div></div>'
        + '<div id="shop-screen" style="display:none"></div>';
    const player = { level, equipment: { mainHand: equipped }, inventory: [candidate] };
    const ui = new InventoryUI({ isMobile: false, getLastPlayer: () => player,
        formatStatName: key => key, getItemIconPath: () => '/icons/item.png' });
    ui.compareMode = compare; owners.push(ui);
    return { ui, player, candidate, main: ui.statTooltipDesc, secondary: ui.compareTooltipDesc };
}
afterEach(() => { for (const ui of owners.splice(0)) ui.dispose(); document.body.replaceChildren(); });

test.each([10, 30])('saved comparison names stay literal in starter/current hints at level%i', level => {
    const f = fixture({ level, equipped: gear('equipped', { name: probe }), candidate: gear('new', { level: 6 }) });
    const before = JSON.stringify(f.player);
    f.ui.showItemTooltip(f.candidate, 20, 20);
    expect(f.main.querySelector('[data-tooltip-probe]')).toBeNull();
    expect(f.main.textContent).toContain(probe);
    expect(JSON.stringify(f.player)).toBe(before);
});

test('item metadata and unknown stat keys/values stay text on both comparison panels', () => {
    const metadata = { rarity: { ...RARITY.RARE, name: probe }, level: probe,
        stats: { damage: 7, [probe]: probe } };
    const f = fixture({ equipped: gear('old', metadata), candidate: gear('new', metadata), compare: true });
    const before = JSON.stringify(f.player);
    f.ui.showItemTooltip(f.candidate, 20, 20);
    for (const panel of [f.main, f.secondary]) {
        expect(panel.querySelector('[data-tooltip-probe]')).toBeNull();
        expect(panel.textContent).toContain(probe);
        expect(panel.querySelector('div')).not.toBeNull(); // Trusted layout still renders as markup.
    }
    expect(JSON.stringify(f.player)).toBe(before);
});

test('unknown socket descriptions stay literal in the item and equipped comparison', () => {
    const gem = { type: probe, quality: probe };
    const f = fixture({ equipped: gear('old', { gems: [gem] }), candidate: gear('new', { gems: [gem] }), compare: true });
    f.ui.showItemTooltip(f.candidate, 20, 20);
    for (const panel of [f.main, f.secondary]) {
        expect(panel.querySelector('[data-tooltip-probe]')).toBeNull();
        expect(panel.textContent).toContain(probe);
    }
});

test('prototype-named legacy definitions do not crash or become catalogue entries', () => {
    const f = fixture({ candidate: gear('old', { setId: '__proto__', uniqueEffect: 'constructor',
        gems: [{ type: 'constructor', quality: '__proto__' }] }) });
    expect(() => f.ui.showItemTooltip(f.candidate, 20, 20)).not.toThrow();
    expect(f.main.textContent).toContain('constructor');
    expect(f.main.textContent).toContain('__proto__');
    expect(f.main.textContent).not.toContain('undefined');
});

test('socket/stat totals preserve own prototype-named keys as numbers without changing the prototype', () => {
    const item = JSON.parse('{"stats":{"__proto__":5,"constructor":7},"gems":[{"stats":{"__proto__":2,"constructor":3}}]}');
    const before = JSON.stringify(item);
    const totals = itemStatTotals(item);
    expect(Object.hasOwn(totals, '__proto__')).toBe(true);
    expect(totals.__proto__).toBe(7); expect(totals.constructor).toBe(10);
    expect(JSON.stringify(item)).toBe(before);
    expect(Object.prototype).not.toHaveProperty('damage');
});

test('canonical stat, set, unique and gem formatting remains readable in both panels', () => {
    const setId = Object.keys(SET_DEFINITIONS)[0], uniqueEffect = Object.keys(UNIQUE_EFFECTS)[0];
    const item = gear('normal', { setId, uniqueEffect, gems: [{ type: 'RUBY', quality: 'NORMAL', stats: { strength: 3 } }] });
    const f = fixture({ candidate: item, equipped: gear('equipped', { ...item, id: 'equipped' }), compare: true });
    f.ui.showItemTooltip(item, 20, 20);
    for (const panel of [f.main, f.secondary]) {
        expect(panel.textContent).toContain('+7 damage');
        expect(panel.textContent).toContain(SET_DEFINITIONS[setId].name);
        expect(panel.textContent).toContain(UNIQUE_EFFECTS[uniqueEffect].name);
        expect(panel.textContent).toContain('Ruby');
    }
});
