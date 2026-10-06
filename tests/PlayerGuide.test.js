import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { classAllowsEquipment } from '../src/core/EquipmentSlots.js';
import { DUNGEON_ENTRY_LEVELS, MAX_PLAYER_LEVEL } from '../src/data/dungeonProgression.js';
import { PORTAL_DIRECTIONS } from '../src/data/worldLocations.js';

const html = readFileSync(new NodeURL('../index.html', import.meta.url), 'utf8');
beforeEach(() => { document.body.innerHTML = html; });
const chapter = id => {
    const node = document.getElementById(`help-${id}-guide`);
    expect(node).not.toBeNull();
    expect(node.closest('#help-screen')).not.toBeNull();
    return node;
};

test('player reference chapters use native collapsed disclosures without external navigation', () => {
    for (const id of ['equipment', 'instance', 'party', 'crafting', 'economy', 'settings']) {
        const node = chapter(id);
        expect(node.tagName).toBe('DETAILS');
        expect(node.open).toBe(false);
        expect(node.querySelector(':scope > summary').textContent.trim()).not.toBe('');
        expect(node.querySelectorAll('iframe, form, input, a[href^="http"]').length).toBe(0);
    }
});

test('documented armor families match current class eligibility', () => {
    const samples = {cloth: 'Robes', leather: 'Leather Tunic', plate: 'Plate Mail'};
    for (const actorClass of ['Fighter', 'Cleric', 'Rogue', 'Wizard']) {
        const entry = chapter('equipment').querySelector(`[data-guide-class="${actorClass}"]`);
        expect(entry).not.toBeNull();
        const allowed = Object.entries(samples).filter(([, name]) => classAllowsEquipment(actorClass, {name, type: 'ARMOR', slot: 'chest'})).map(([family]) => family);
        expect(entry.dataset.guideArmor.split(' ').sort()).toEqual(allowed.sort());
        for (const family of allowed) expect(entry.textContent.toLowerCase()).toContain(family);
    }
    expect(chapter('equipment').textContent).toContain('Rogues cannot use staves, shields or tomes');
    expect(classAllowsEquipment('Rogue', {name: 'Wooden Staff', type: 'WEAPON', slot: 'mainHand'})).toBe(false);
    expect(classAllowsEquipment('Rogue', {name: 'Wooden Shield', type: 'ARMOR', slot: 'offHand'})).toBe(false);
});

test('dungeon reference retains every current entry floor and personal story gates', () => {
    const guide = chapter('instance');
    for (const [family, minimum] of Object.entries(DUNGEON_ENTRY_LEVELS)) {
        const entry = guide.querySelector(`[data-guide-dungeon="${family}"]`);
        expect(entry).not.toBeNull();
        expect(Number(entry.dataset.guideMinLevel)).toBe(minimum);
        expect(entry.textContent).toContain(`level ${minimum}`);
    }
    expect(guide.textContent).toContain(`level ${MAX_PLAYER_LEVEL}`);
    expect(guide.textContent).toContain('claim each ready repair quest');
    expect(guide.textContent).toContain(PORTAL_DIRECTIONS);
    expect(guide.textContent).toContain('latest cleared boss checkpoint');
    expect(guide.textContent).toContain('15-minute');
    expect(guide.textContent).toContain('5 minutes');
});

test('economy reference matches configured EP exchange/allowance and keeps the no-power boundary', () => {
    const guide = chapter('economy').textContent;
    const source = name => readFileSync(new NodeURL(`../server/internal/database/${name}.go`, import.meta.url), 'utf8');
    const rate = Number(source('ep_exchange').match(/const GoldPerEP = ([\d_]+)/)[1].replaceAll('_', ''));
    const monthly = Number(source('vip').match(/const VIPMonthlyEP = (\d+)/)[1]);
    expect(guide).toContain(`${rate.toLocaleString('en-US')} Gold for 1 EP`);
    expect(guide).toContain(`${monthly} EP`);
    for (const text of ['cannot exchange EP back into Gold', 'cosmetics', 'EP wagers return only EP', 'Payment integration is not available', '3:2 profit', 'real players']) expect(guide).toContain(text);
    expect(guide).toContain('this browser visit only');
    expect(guide).not.toContain('spend/time limits');
});

test('party, Forge and settings documentation keeps authority and accessibility limits visible', () => {
    expect(chapter('party').textContent).toContain('5–10-player raid');
    expect(chapter('party').textContent).toContain('same dungeon');
    expect(chapter('crafting').textContent).toContain('server-confirmed');
    expect(chapter('crafting').textContent).toContain('not a promised campaign requirement');
    expect(chapter('settings').textContent).toContain('Keyboard');
    expect(chapter('settings').textContent).toContain('Low');
    expect(chapter('settings').textContent).toContain('not a guarantee');
});
