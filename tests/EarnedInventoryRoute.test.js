import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { readStoryHuntFailureEvidence } from './e2e/story-hunt-combat-observer.js';

test('collection failure retains bag evidence even after a login cleared the hunt observer', async () => {
    const seed = { id: 'chronicle-item-seed', name: 'Verdant Memory Seed', type: 'QUEST', stack: 2 };
    window.game = { player: { level: 8, stats: { hp: 100, mana: 20 }, position: new Vector3(),
        inventory: [seed, null], baseStats: {}, talentRanks: {} }, remotePlayers: new Map() };
    delete window.__storyHuntCombatEvidence;
    try {
        const evidence = await readStoryHuntFailureEvidence({ evaluate: callback => callback() });
        expect(evidence.combat).toBeNull();
        expect(evidence.player).toMatchObject({ inventoryCapacity: 2, freeSlots: 1,
            inventory: [expect.objectContaining(seed)] });
    } finally { delete window.game; }
});

test('normal inventory visits precede combat watchdogs and do not alter no-rest diagnostics', () => {
    for (const name of ['fresh-collection-route', 'fresh-story-hunt-route']) {
        const source = readFileSync(`tests/e2e/${name}.js`, 'utf8');
        const call = source.indexOf('await maintainEarnedInventory(page, { leaveTown })');
        expect(call).toBeGreaterThan(source.indexOf('if (earnedTownRecoveryEnabled())'));
        expect(call).toBeLessThan(source.indexOf('const deadline = Date.now() + 120_000'));
    }
});

test('merchant route uses ordinary right-click sales and independently verifies each gold receipt', async () => {
    const source = readFileSync('tests/e2e/earned-inventory-management.js', 'utf8');
    expect(source).toContain("nth(index).click({ button: 'right' })");
    expect(source).toContain('current.gold + sale.value');
    expect(source).toContain('expect(after.quests).toEqual(before.quests)');
    expect(source).toContain('await leaveTown()');
    expect(source).not.toMatch(/network\.send|onSellItem\(|player\.gold\s*\+=|useCombatQAWaypoint/);
});

test('no entered character produces no misleading empty inventory receipt', async () => {
    window.game = {};
    const page = { evaluate: jest.fn(callback => callback()) };
    try { expect(await readStoryHuntFailureEvidence(page)).toBeNull(); }
    finally { delete window.game; }
});
