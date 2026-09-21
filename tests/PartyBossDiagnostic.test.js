import { partyBossDiagnostic, preparePartyBossDiagnostic, partyDiagnosticRoom } from './partyBossDiagnostic.js';

const selection = { dungeonType: 'molten_core', difficulty: 'normal', runLevel: 70 };
const env = { EIDOLON_E2E_DIAGNOSTIC_BOSS: 'ObsidianGuardian' };
const layout = { generationSeed: '7811600862583822555', generatorVersion: 2,
    rooms: Array.from({ length: 6 }, (_, i) => ({ x: 30000, z: 20000 - 300 * i, width: 140, height: 140, type: i ? 'boss' : 'start' })),
    walkRects: [{ x: 30000, z: 18800, width: 140, height: 140, kind: 'room', roomIndex: 4 }],
    corridors: [{ fromRoomIndex: 3, toRoomIndex: 4, width: 20, walkRectIndices: [0] }] };
const character = { name: 'codexqa0123456789ab-fighter', class: 'Fighter', level: 70, gold: 0,
    quests: [{ id: 'chronicle_07_crown_of_embers', count: 0, completed: false }], equipment: { mainHand: { rarity: 'Rare' } } };

test('opt-in is narrow and cannot be confused with earned continuation', () => {
    expect(partyBossDiagnostic({}, selection)).toBeNull();
    expect(partyBossDiagnostic(env, selection)).toBe('ObsidianGuardian');
    for (const extra of [{ EIDOLON_E2E_EARNED_PARTY: '1' }, { EIDOLON_E2E_EARNED_RESUME: '1' },
        { EIDOLON_E2E_EARNED_CHECKPOINT: '/private/save' }, { EIDOLON_E2E_DIAGNOSTIC_BOSS: 'LordInfernax' }]) {
        expect(() => partyBossDiagnostic({ ...env, ...extra }, selection)).toThrow();
    }
    for (const wrong of [null, { ...selection, difficulty: 'mythic' }, { ...selection, runLevel: 100 }]) {
        expect(() => partyBossDiagnostic(env, wrong)).toThrow();
    }
});

test('fresh fixture skips only prior rooms, preserves quest/gear and leaves live bosses uncleared', () => {
    const before = JSON.stringify({ character, layout });
    const now = new Date('2026-09-20T22:00:00Z');
    const fixtures = [0, 1, 2, 3].map(i => preparePartyBossDiagnostic(character, layout, 'codexqa0123456789ab', i, now));
    expect(new Set(fixtures.map(c => c.instance_id)).size).toBe(1);
    expect(fixtures.map(c => c.dungeon_progress.party_id)).toEqual(
        Array(4).fill(`party-player-${character.name}`));
    expect(fixtures.every(c => !c.party_id)).toBe(true);
    expect(new Set(fixtures.map(c => c.x)).size).toBe(4);
    const c = fixtures[0], d = c.dungeon_progress;
    expect(c.quests).toEqual(character.quests);
    expect(c.equipment).toEqual(character.equipment);
    expect(c.gold).toBe(0);
    expect(c.last_logout).toEqual({ $date: now.toISOString() });
    expect(d.current_room_index).toBe(4);
    expect(d.rooms.slice(0, 4).every(r => r.cleared && r.rewarded)).toBe(true);
    expect(d.rooms.slice(4).every(r => !r.cleared && !r.rewarded)).toBe(true);
    expect(d.layout.walk_rects[0].room_index).toBe(4);
    expect(d.layout.corridors[0].walk_rect_indices).toEqual([0]);
    expect(JSON.stringify({ character, layout })).toBe(before);
});

test('rejects existing-instance characters, non-QA accounts and a different generator identity', () => {
    for (const c of [{ ...character, instance_id: 'earned' }, { ...character, dungeon_progress: {} }]) {
        expect(() => preparePartyBossDiagnostic(c, layout, 'codexqa0123456789ab', 0)).toThrow();
    }
    expect(() => preparePartyBossDiagnostic(character, layout, 'real-player', 0)).toThrow();
    expect(() => preparePartyBossDiagnostic(character, layout, 'codexqa0123456789ab', 4)).toThrow();
    expect(() => preparePartyBossDiagnostic(character, { ...layout, generatorVersion: 1 }, 'codexqa0123456789ab', 0)).toThrow();
});

test('prepared pack uses its recorded room and leaves its enemies and quest alive', () => {
    const pack = { ...layout, generationSeed: '-1634763615133968283',
        rooms: Array.from({ length: 12 }, (_, i) => ({ x: 30027.77138373022, z: 20000 - i * 200,
            width: 110, height: 110, type: i === 0 ? 'start' : i < 10 && i % 2 ? 'boss' : 'normal' })) };
    const selected = { EIDOLON_E2E_DIAGNOSTIC_BOSS: 'MoltenPack' };
    expect(partyBossDiagnostic(selected, selection)).toBe('MoltenPack');
    expect(() => partyBossDiagnostic({ ...selected, EIDOLON_E2E_EARNED_CHECKPOINT: '/private/earned' }, selection)).toThrow();
    const before = JSON.stringify({ pack, character });
    const prepared = preparePartyBossDiagnostic(character, pack, 'codexqa0123456789ab', 0, undefined, 'MoltenPack');
    expect(prepared.z).toBe(18110);
    expect(prepared.dungeon_progress.current_room_index).toBe(10);
    expect(prepared.dungeon_progress.rooms.slice(0, 10).every(r => r.cleared && r.rewarded)).toBe(true);
    expect(prepared.dungeon_progress.rooms.slice(10).every(r => !r.cleared && !r.rewarded)).toBe(true);
    expect(prepared.quests).toEqual(character.quests);
    expect(JSON.stringify({ pack, character })).toBe(before);
    expect(() => partyDiagnosticRoom(pack, 'ObsidianGuardian')).toThrow();
    expect(() => partyDiagnosticRoom(layout, 'MoltenPack')).toThrow();
    expect(() => partyDiagnosticRoom(pack, 'unknown')).toThrow();
});
