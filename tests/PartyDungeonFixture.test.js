import { PARTY_ROLES, partyDungeonCharacter, requireIsolatedPartyFixture, partyGraphicsQuality } from './partyDungeonFixture.js';

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
    const character = partyDungeonCharacter({ stats: { strength: 68 }, items }, quests, className, 'fixture');
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

test('unknown roles and missing or inflated catalog gear fail closed', () => {
    expect(() => partyDungeonCharacter({}, [], 'Unknown', 'fixture')).toThrow();
    expect(() => partyDungeonCharacter({ items: {} }, [], 'Fighter', 'fixture')).toThrow();
    const items = new Proxy({}, { get: () => ({ level: 100, rarity: 'Legendary' }) });
    expect(() => partyDungeonCharacter({ items }, [], 'Fighter', 'fixture')).toThrow();
});
