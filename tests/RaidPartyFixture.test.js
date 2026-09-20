import { RAID_PARTY_ROLES, DARK_KING_RAID, raidPartyFixture } from './raidPartyFixture.js';
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
    expect(fixture.priorChapterIds).toEqual(catalog.quests.slice(0, -2).map(quest => quest.id));
    expect(fixture.priorChapterIds).not.toContain(fixture.chapterId);
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

function finaleCatalog() {
    return { ...catalog, level: 100,
        roleItems: Object.fromEntries(Object.entries(catalog.roleItems).map(([role, rarities]) => [role,
            Object.fromEntries(Object.entries(rarities).map(([rarity, items]) => [rarity,
                new Proxy({}, { get: (_target, name) => ({ ...items[name], level: 100 }) })]))])),
        quests: [...catalog.quests.slice(0, 4),
            ...['Earth', 'Water', 'Fire', 'Air'].map(element => ({ id: `${element}-vigil`, type: 'REPAIR', target: `${element}Crystal`, maxCount: 1 })),
            { id: PARTY_DUNGEON_CHAPTERS.umbral_nexus, type: 'KILL', target: 'EidolonDevourer', maxCount: 1 },
            { id: DARK_KING_RAID.RestoredQuest, type: 'KILL', target: 'UmbraPrime', maxCount: 1 }]
    };
}

test('finale preparation uses five legal level100 roles but never grants the King kill or weekly reward', () => {
    const fixture = raidPartyFixture(finaleCatalog(), 'weekly_raid', names);
    expect(fixture.nextChapterId).toBeNull();
    expect(fixture.boss).toBe('UmbraPrime');
    expect(fixture.priorChapterIds).toEqual(finaleCatalog().quests.slice(0, -1).map(quest => quest.id));
    expect(fixture.priorChapterIds).not.toContain(DARK_KING_RAID.RestoredQuest);
    for (const character of fixture.characters) {
        expect(character.level).toBe(100);
        expect(character.quests.at(-1)).toEqual({ id: DARK_KING_RAID.RestoredQuest, accepted: true, completed: false, count: 0 });
        expect(Object.values(character.equipment).every(item => item.level === 100)).toBe(true);
        expect(character.gold).toBe(0);
        expect(character).not.toHaveProperty('dungeon_progress');
        expect(character).not.toHaveProperty('raid_lockouts');
    }
});

test.each([
    c => { c.level = 70; }, c => { c.quests.splice(0, 1); },
    c => { c.quests = c.quests.filter(q => q.target !== 'AirCrystal'); },
    c => { c.quests = c.quests.filter(q => q.target !== 'EidolonDevourer'); },
    c => { c.quests.at(-1).target = 'ordinary-enemy'; },
    c => { c.quests.push({ id: 'invented-future-chapter' }); }
])('finale preparation rejects missing progression or a mismatched terminal chapter', change => {
    const c = finaleCatalog(); change(c);
    expect(() => raidPartyFixture(c, 'weekly_raid', names)).toThrow();
});
