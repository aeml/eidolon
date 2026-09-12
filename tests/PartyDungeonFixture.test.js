import { PARTY_ROLES, partyDungeonCharacter, requireIsolatedPartyFixture, partyGraphicsQuality, partyGearProfile, partyEquippedItemSnapshot } from './partyDungeonFixture.js';

const env = { EIDOLON_E2E_PARTY_DUNGEON: '1', EIDOLON_E2E_REGISTER: '1',
    EIDOLON_E2E_BUILD_MONGO_CONTAINER: 'eidolon-isolated-qa-mongo-party',
    EIDOLON_E2E_BUILD_MONGO_PORT: '18581', EIDOLON_E2E_WS_URL: 'ws://127.0.0.1:18580/ws',
    EIDOLON_E2E_USERNAME: 'codexqa012345abcdef' };

test('party graphics comparisons retain the High baseline and require an explicit supported override', () => {
    expect(partyGraphicsQuality()).toBe('high');
    for (const quality of ['low', 'medium', 'high']) expect(partyGraphicsQuality({ EIDOLON_E2E_PARTY_QUALITY: quality })).toBe(quality);
    expect(() => partyGraphicsQuality({ EIDOLON_E2E_PARTY_QUALITY: 'off' })).toThrow();
});

test('party seeding requires every disposable isolation guard', () => {
    expect(() => requireIsolatedPartyFixture(env)).not.toThrow();
    for (const key of Object.keys(env)) expect(() => requireIsolatedPartyFixture({ ...env, [key]: '' })).toThrow();
    for (const url of ['wss://eserver.mendola.tech/ws', 'ws://example.com:18580/ws']) {
        expect(() => requireIsolatedPartyFixture({ ...env, EIDOLON_E2E_WS_URL: url })).toThrow();
    }
});

test.each(PARTY_ROLES)('%s fixture has legal level30 specialization without future skills or protection', className => {
    const items = new Proxy({}, { get: (_target, name) => ({ name, level: 30, rarity: 'Common',
        stats: { defense: 1 }, maxStack: 1, statScaleVersion: 1 }) });
    const quests = [{ id: 'chronicle_03_roots_remember', accepted: true, completed: false, count: 0 }];
    const character = partyDungeonCharacter({ stats: { strength: 68 }, items }, quests, className, 'fixture', 'common');
    expect(character.level).toBe(30);
    expect(Object.keys(character.equipment)).toHaveLength(14);
    expect(new Set(Object.values(character.equipment).map(item => item.id)).size).toBe(14);
    expect(character.unlocked_skills).toHaveLength(4);
    expect(character.unlocked_skills).not.toEqual(expect.arrayContaining(['Guardian Roar']));
    expect(Object.values(character.talent_ranks)).toEqual([5]);
    expect(character).not.toHaveProperty('resources');
    expect(character).not.toHaveProperty('well_rested');
    expect(character.gold).toBe(0);
    character.quests[0].count = 1;
    expect(quests[0].count).toBe(0);
});

test('progressed gear is the default and the original Common baseline remains an explicit diagnostic', () => {
    expect(partyGearProfile()).toBe('progressed');
    expect(partyGearProfile({ EIDOLON_E2E_PARTY_GEAR: 'common' })).toBe('common');
    expect(() => partyGearProfile({ EIDOLON_E2E_PARTY_GEAR: 'legendary' })).toThrow();
});

test('equipped verification reads hydrated rarity names without altering item stats', () => {
    const item = { name: 'Strong Iron Sword of the Whale', level: 30, rarity: 'Rare', stats: { damage: 11, strength: 9, vitality: 9 } };
    expect(partyEquippedItemSnapshot({ ...item, rarity: { name: 'Rare', color: '#0070dd' } })).toEqual(item);
    expect(partyEquippedItemSnapshot(item)).toEqual(item);
    expect(partyEquippedItemSnapshot({ ...item, stats: { damage: 1 } }).stats).toEqual({ damage: 1 });
    expect(partyEquippedItemSnapshot(null)).toBeNull();
});

test.each([
    ['Fighter', 'strength', 'Strong'], ['Rogue', 'dexterity', 'Agile'],
    ['Wizard', 'intelligence', 'Brilliant'], ['Cleric', 'wisdom', 'Wise']
])('%s wears only its own role-affixed Uncommon/Rare catalog items', (className, stat, prefix) => {
    const roleItems = { [className]: Object.fromEntries(['Uncommon', 'Rare'].map(rarity => [rarity,
        new Proxy({}, { get: (_target, name) => ({ name: `${prefix} ${name}${rarity === 'Rare' ? ' of the Whale' : ''}`,
            level: 30, rarity, stats: { [stat]: 9, ...(rarity === 'Rare' ? { vitality: 9 } : {}) },
            maxStack: 1, statScaleVersion: 1 }) })])) };
    const stats = { strength: 68, vitality: 68, dexterity: 39, intelligence: 39, wisdom: 39 };
    const catalog = { gearProfile: 'progressed', stats, roleItems };
    const c = partyDungeonCharacter(catalog, [], className, 'fixture');
    const items = Object.values(c.equipment);
    expect(items).toHaveLength(14);
    expect(items.filter(item => item.rarity === 'Rare')).toHaveLength(5);
    expect(items.filter(item => item.rarity === 'Uncommon')).toHaveLength(9);
    expect(items.every(item => item.name.startsWith(`${prefix} `) && item.stats[stat] > 0)).toBe(true);
    expect(c.stats).toEqual(stats); // No level-dependent stat bonus.
    expect(Object.values(c.talent_ranks)).toEqual([5]);
    expect(() => partyDungeonCharacter(catalog, [], className, 'fixture', 'common')).toThrow('profile mismatch');
    const wrong = { ...catalog, roleItems: { [className]: { Rare: new Proxy({}, { get: () => ({
        name: 'Hearty Iron Sword of the Bear', level: 30, rarity: 'Rare', stats: { strength: 9, vitality: 9 }
    }) }) } } };
    expect(() => partyDungeonCharacter(wrong, [], className, 'fixture')).toThrow('Wrong role affixes');
});

test('unknown roles and missing or inflated catalog gear fail closed', () => {
    expect(() => partyDungeonCharacter({}, [], 'Unknown', 'fixture')).toThrow();
    expect(() => partyDungeonCharacter({ items: {} }, [], 'Fighter', 'fixture')).toThrow();
    const items = new Proxy({}, { get: () => ({ level: 100, rarity: 'Legendary' }) });
    expect(() => partyDungeonCharacter({ items }, [], 'Fighter', 'fixture')).toThrow();
});
