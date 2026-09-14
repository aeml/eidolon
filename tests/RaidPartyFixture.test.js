import { RAID_PARTY_ROLES, raidPartyFixture } from './raidPartyFixture.js';
import { PARTY_DUNGEON_CHAPTERS } from './partyDungeonStory.js';

const roles = { Fighter: ['strength', 'Strong'], Cleric: ['wisdom', 'Wise'],
    Wizard: ['intelligence', 'Brilliant'], Rogue: ['dexterity', 'Agile'] };
const raidType = 'earth_crystal_raid';
const names = ['tank', 'healer', 'wizard', 'rogue', 'second-healer'];
const catalog = {
    level: 70, gearProfile: 'progressed', stats: { strength: 100, wisdom: 100 },
    roleItems: Object.fromEntries(Object.entries(roles).map(([role, [stat, prefix]]) => [role,
        Object.fromEntries(['Rare', 'Uncommon'].map(rarity => [rarity, new Proxy({}, {
            get: (_target, name) => ({ name: `${prefix} ${name}${rarity === 'Rare' ? ' of the Whale' : ''}`,
                level: 70, rarity, stats: { [stat]: 10, vitality: 10 } })
        })]))])),
    quests: Object.entries(PARTY_DUNGEON_CHAPTERS).filter(([type]) => type !== 'umbral_nexus')
        .map(([, id]) => ({ id, maxCount: 1 })).concat([
            { id: 'vigil', type: 'REPAIR', target: 'EarthCrystal', maxCount: 1 },
            { id: 'next-vigil', type: 'REPAIR', target: 'WaterCrystal', maxCount: 1 }
        ]),
    raids: { [raidType]: { Type: raidType, RequiredLevel: 30,
        RequiredDungeonQuest: PARTY_DUNGEON_CHAPTERS.verdant_bastion_catacombs,
        RestoredQuest: 'vigil', RepairTarget: 'EarthCrystal', Boss: 'GravenColossus' } }
};

test('five independent geared roles start with an unfinished Vigil and no future credit', () => {
    const fixture = raidPartyFixture(catalog, raidType, names);
    expect(fixture.characters.map(c => c.class)).toEqual(RAID_PARTY_ROLES);
    expect(fixture.nextChapterId).toBe('next-vigil');
    const ids = new Set();
    for (const c of fixture.characters) {
        expect(c.level).toBe(70);
        expect(c.stats).toEqual(catalog.stats);
        expect(c.gold).toBe(0);
        expect(c).not.toHaveProperty('dungeon_progress');
        expect(c).not.toHaveProperty('raid_progress');
        expect(c.quests.at(-1)).toEqual({ id: 'vigil', accepted: true, completed: false, count: 0 });
        expect(c.quests.slice(0, -1).every(q => q.completed && q.count === 1)).toBe(true);
        expect(c.quests.some(q => q.id === 'next-vigil')).toBe(false);
        const gear = Object.values(c.equipment);
        expect(gear.filter(i => i.rarity === 'Rare')).toHaveLength(5);
        expect(gear.filter(i => i.rarity === 'Uncommon')).toHaveLength(9);
        expect(gear.every(i => i.stats[roles[c.class][0]] > 0)).toBe(true);
        for (const item of gear) ids.add(item.id);
    }
    expect(ids.size).toBe(70);
    fixture.characters[1].quests.at(-1).count = 1;
    fixture.characters[1].stats.wisdom = 999;
    fixture.characters[1].equipment.mainHand.stats.wisdom = 999;
    expect(fixture.characters[4].quests.at(-1).count).toBe(0);
    expect(fixture.characters[4].stats.wisdom).toBe(100);
    expect(fixture.characters[4].equipment.mainHand.stats.wisdom).toBe(10);
    expect(catalog.stats.wisdom).toBe(100);
});

test('entrance access alone cannot substitute for the post-dungeon repair chapter', () => {
    expect(() => raidPartyFixture({ ...catalog, level: 30 }, raidType, names)).toThrow();
    expect(() => raidPartyFixture({ ...catalog, level: undefined }, raidType, names)).toThrow();
    expect(() => raidPartyFixture({ ...catalog, quests: catalog.quests.slice(1) }, raidType, names)).toThrow();
    expect(() => raidPartyFixture({ ...catalog, quests: catalog.quests.slice(0, -1) }, raidType, names)).toThrow();
    expect(() => raidPartyFixture({ ...catalog, quests: catalog.quests.map(q => ({ ...q, target: 'wrong' })) }, raidType, names)).toThrow();
});

test('unknown raids and fewer than five unique participants fail before preparation', () => {
    expect(() => raidPartyFixture(catalog, 'unknown', names)).toThrow();
    expect(() => raidPartyFixture(catalog, raidType, names.slice(0, 4))).toThrow();
    expect(() => raidPartyFixture(catalog, raidType, [...names.slice(0, 4), names[0]])).toThrow();
});
