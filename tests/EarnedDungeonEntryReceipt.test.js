import { readEarnedDungeonEntryInPage } from './earnedDungeonEntryReceipt.js';

class Wizard {}
const fixture = () => ({ currentInstanceType: 'overworld', player: Object.assign(new Wizard(), {
    id: 'private-player-id', name: 'private-player-name', password: 'not-for-artifacts',
    level: 31, xp: 10652, gold: 22432, baseStats: { intelligence: 40 },
    stats: { hp: 1140, maxHp: 1140, mana: 670, maxMana: 670 },
    inventory: [{ id: 'shards', name: 'Eidolon Shard', type: 'MATERIAL', stack: 19,
        maxStack: 999, stats: {}, rarity: { name: 'Common' }, statScaleVersion: 1 }, null],
    equipment: { mainHand: { id: 'sword', stats: { damage: 9 },
        gems: [{ type: 'Sapphire', quality: 'Flawed', stats: { intelligence: 2 } }] } },
    stash: [{ id: 'spare', stats: { intelligence: 6 } }],
    talentRanks: { WIZ_01: 5 }, selectedBranch: 'C', skillRunes: {},
    hotbar: ['Teleport', 'Arcane Shield', 'Gravity Well'], unlockedSkills: ['Fireball', 'Teleport'],
    quests: [{ id: 'chronicle_03_roots_remember', accepted: true, completed: false, count: 0 }],
    position: { x: 0, y: .5, z: 200 }, wellRestedSeconds: 15, safeZoneId: 'lanternhold'
}) });

afterEach(() => { delete window.game; });

test('entry receipt retains full items, stash, materials and build without account identity', () => {
    window.game = fixture();
    const receipt = readEarnedDungeonEntryInPage({ sourceCommit: 'a'.repeat(40), sourceDirty: false });
    expect(receipt).toMatchObject({ schemaVersion: 1, className: 'Wizard', level: 31,
        sourceCommit: 'a'.repeat(40), sourceDirty: false, gold: 22432, health: 1140, mana: 670,
        inventory: window.game.player.inventory, equipment: window.game.player.equipment,
        stash: window.game.player.stash, quests: window.game.player.quests });
    expect(receipt.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(receipt)).not.toMatch(/private-player|not-for-artifacts|password/);
});

test('receipt is detached from later equipment, bag, stash and quest changes', () => {
    window.game = fixture();
    const receipt = readEarnedDungeonEntryInPage();
    window.game.player.inventory[0].stack = 0;
    window.game.player.equipment.mainHand.gems[0].stats.intelligence = 10;
    window.game.player.stash[0].stats.intelligence = 20;
    window.game.player.quests[0].count = 1;
    expect(receipt.inventory[0].stack).toBe(19);
    expect(receipt.equipment.mainHand.gems[0].stats.intelligence).toBe(2);
    expect(receipt.stash[0].stats.intelligence).toBe(6);
    expect(receipt.quests[0].count).toBe(0);
    expect(receipt.sourceDirty).toBeNull();
});

test('unknown stash is not reported as verified empty storage', () => {
    window.game = fixture();
    delete window.game.player.stash;
    expect(readEarnedDungeonEntryInPage().stash).toBeNull();
});

test('missing entered character fails instead of producing an empty preparation receipt', () => {
    expect(() => readEarnedDungeonEntryInPage()).toThrow('entered character');
});
