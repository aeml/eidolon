import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { readStoryHuntFailureEvidence } from './e2e/story-hunt-combat-observer.js';

test('collection failure retains bag evidence even after a login cleared the hunt observer', async () => {
    const seed = { id: 'chronicle-item-seed', name: 'Verdant Memory Seed', type: 'QUEST', stack: 2 };
    const quest = Object.freeze({ id: 'chronicle_earth_walking_ink', accepted: true,
        completed: false, count: 4, maxCount: 60 });
    window.game = { player: { level: 8, stats: { hp: 100, mana: 20 }, position: new Vector3(),
        inventory: [seed, null], quests: [quest], baseStats: {}, talentRanks: {} }, remotePlayers: new Map() };
    delete window.__storyHuntCombatEvidence;
    try {
        const evidence = await readStoryHuntFailureEvidence({ evaluate: callback => callback() });
        expect(evidence.combat).toBeNull();
        expect(evidence.player).toMatchObject({ inventoryCapacity: 2, freeSlots: 1,
            inventory: [expect.objectContaining(seed)], quests: [quest] });
        expect(window.game.player.quests).toEqual([quest]);
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
    expect(source).toContain('await ensureEarnedMerchantWindow(page, async () =>');
    expect(source).toContain('{ moveOnly: true, allowJumpFallback: false }');
    expect(source).not.toMatch(/network\.send|onSellItem\(|player\.gold\s*\+=|useCombatQAWaypoint/);
});

test('no entered character produces no misleading empty inventory receipt', async () => {
    window.game = {};
    const page = { evaluate: jest.fn(callback => callback()) };
    try { expect(await readStoryHuntFailureEvidence(page)).toBeNull(); }
    finally { delete window.game; }
});

test('collection failure records visible reserved fragments without manufacturing pickup or progress', async () => {
    const position = new Vector3();
    const item = Object.freeze({ id: 'chronicle-item-waiting', name: 'Verdant Memory Seed', stack: 1 });
    const quest = Object.freeze({ id: 'chronicle_02_seeds_first_grove', accepted: true, count: 7, maxCount: 8 });
    const drop = { id: 'story-loot-waiting', item, isActive: true, position: new Vector3(12, .5, 0) };
    window.game = { player: { level: 100, stats: { hp: 100 }, position, inventory: [], quests: [quest] },
        remotePlayers: new Map([[drop.id, drop]]), pendingLootPickups: new Map(), autoLootEnabled: true,
        isHostileActorTarget: () => false, canAttemptLootPickup: () => false };
    try {
        const evidence = await readStoryHuntFailureEvidence({ evaluate: callback => callback() });
        expect(evidence.visibleQuestDrops).toEqual([expect.objectContaining({ id: drop.id,
            itemId: item.id, name: item.name, stack: 1, active: true, position: [12, .5, 0],
            inPickupRange: false, pending: false })]);
        expect(evidence.autoLootEnabled).toBe(true);
        expect(evidence.pendingPickups).toBe(0);
        expect(window.game.player.quests).toEqual([quest]);
        expect(window.game.remotePlayers.get(drop.id)).toBe(drop);
    } finally { delete window.game; }
});

test('stash fallback uses real storage clicks and checks complete item conservation, never grants', () => {
    const route = readFileSync('tests/e2e/earned-inventory-management.js', 'utf8');
    const stash = readFileSync('tests/e2e/earned-stash-storage.js', 'utf8');
    expect(route).toContain('const storage = planEarnedBagStorage(afterSales)');
    expect(route).toContain('await storeEarnedSpareEquipment(page, storage, snapshot)');
    expect(route).toContain('...prepared.stash.filter(item => item?.id), ...stored');
    expect(stash).toContain("projectEntity(page, 'stash-1')");
    expect(stash).toContain('earnedStashFreeSlots(initial.stash, capacity)');
    expect(stash).not.toContain('capacity - initial.stash.length');
    expect(stash).toContain("await expect(page.locator('#shop-screen')).toBeHidden()");
    expect(stash).toContain("nth(index).click({ button: 'right' })");
    expect(stash).toContain('.stash.find(entry => entry?.id === item.id)).toEqual(item)');
    expect(stash).toContain('expect(after.gold).toBe(before.gold)');
    expect(stash).toContain('expect(after.equipment).toEqual(before.equipment)');
    expect(stash).toContain('expect(after.quests).toEqual(before.quests)');
    expect(stash).not.toMatch(/network\.send|onStashDeposit\(|player\.(inventory|stash)\s*=/);
});
