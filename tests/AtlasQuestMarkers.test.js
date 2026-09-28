import fs from 'node:fs';
import { getAtlasQuestLocations, getAtlasQuestGiverState } from '../src/ui/AtlasQuestMarkers.js';
import { getAtlasLocations } from '../src/ui/AtlasNavigation.js';
import { QuestUI } from '../src/ui/QuestUI.js';
import { chronicleInvestigations, darkRealmChapters } from '../src/data/chronicleCatalog.js';
import { WORLD_LOCATIONS } from '../src/data/worldLocations.js';
import { darkRealmFixture } from './darkRealmFixture.js';
import { questMarkerState } from '../src/entities/QuestNPC.js';

function game(quests) {
    const engine = { player: { id: 'atlas-reader', level: 100, position: { x: 150, z: 60 }, quests },
        currentInstanceId: '', currentInstanceType: 'overworld', uiManager: {} };
    engine.uiManager.quest = new QuestUI({ getLastPlayer: () => engine.player });
    return engine;
}
const investigation = (id = 'chronicle_earth_returning_scar') => ({ id, type: 'INVESTIGATE', category: 'chronicle',
    accepted: true, completed: false, count: 0, maxCount: 3, investigationMask: 0 });
beforeEach(() => { localStorage.clear(); document.body.innerHTML = '<div id="journal-list"></div>'; });

test('saved discovery identity comes from the authoritative sparse mask, never the count', () => {
    const q = investigation(), engine = game([q]);
    q.count = 2; q.investigationMask = 5;
    const sites = getAtlasQuestLocations(engine);
    expect(sites.filter(p => p.category === 'discoveries').map(p => p.name)).toEqual(['Severed root', 'Marked stone']);
    expect(sites.filter(p => p.category === 'quests').map(p => p.name)).toEqual(['New growth']);
    for (const site of getChronicleSites(q.id)) expect(JSON.stringify(sites)).not.toContain(site.text);
    // Reconnected snapshot, without reusing the old UI or in-memory discovery state.
    expect(getAtlasQuestLocations(game(JSON.parse(JSON.stringify([q]))))).toEqual(sites);
    q.completed = true;
    expect(getAtlasQuestLocations(engine).map(p => p.category)).toEqual(['discoveries', 'discoveries']);
    delete q.investigationMask;
    expect(getAtlasQuestLocations(engine)).toEqual([]);
});
const getChronicleSites = id => chronicleInvestigations.find(q => q.id === id).sites;

test('journal tracking preferences apply to atlas and switch with character ownership', () => {
    const q = investigation(), engine = game([q]);
    expect(getAtlasQuestLocations(engine)).toHaveLength(3);
    engine.uiManager.quest.setQuestTracked(q, false);
    expect(getAtlasQuestLocations(engine)).toEqual([]);
    q.investigationMask = 1;
    expect(getAtlasQuestLocations(engine)).toHaveLength(1); // known lore stays known
    engine.player = { ...engine.player, id: 'other-character', quests: [investigation()] };
    expect(getAtlasQuestLocations(engine)).toHaveLength(3);
    engine.player = { ...engine.player, id: 'atlas-reader', quests: [q] };
    expect(getAtlasQuestLocations(engine)).toHaveLength(1);
    engine.currentInstanceId = 'private-run'; engine.currentInstanceType = 'molten_core';
    expect(getAtlasQuestLocations(engine)).toEqual([]);
});

test('unaccepted and prerequisite-locked sites never leak into the catalogue', () => {
    const chapter = chronicleInvestigations.find(q => q.sites?.some(s => s.requires));
    expect(chapter).toBeDefined();
    const q = investigation(chapter.id), engine = game([q]);
    engine.currentInstanceId = chapter.instanceId || ''; engine.currentInstanceType = chapter.instanceId ? 'dark_realm' : 'overworld';
    const gated = chapter.sites.find(s => s.requires);
    expect(getAtlasQuestLocations(engine).some(p => p.name === gated.title)).toBe(false);
    q.investigationMask = 1 << chapter.sites.findIndex(s => s.id === gated.requires);
    expect(getAtlasQuestLocations(engine).some(p => p.name === gated.title)).toBe(true);
    q.accepted = false;
    expect(getAtlasQuestLocations(engine).every(p => p.name.startsWith('Accept'))).toBe(true);
    engine.currentInstanceId = 'another-private-scene';
    expect(getAtlasQuestLocations(engine)).toEqual([]);
});

test('manual available/ready/claimed states and daily-blue/story-gold markers agree', () => {
    const q = { id: 'daily_imp', type: 'KILL', target: 'Imp', accepted: true, count: 10, maxCount: 10 };
    const offered = { ...investigation(), accepted: false };
    const engine = game([q, offered]);
    const daily = getAtlasLocations(engine).find(p => p.id === 'quest-giver');
    expect(daily).toMatchObject({ symbol: '?', color: '#65baff' });
    expect(getAtlasLocations(engine).find(p => p.id === 'story-wizard').symbol).toBe('!');
    const turnin = getAtlasQuestLocations(engine).find(p => p.questId === q.id);
    expect(turnin).toMatchObject({ symbol: '?', category: 'quests', x: -20, z: 200 });
    expect(turnin.purpose).toContain('Complete Quest');
    q.completed = true;
    expect(getAtlasQuestLocations(engine).some(p => p.questId === q.id)).toBe(false);
    expect(getAtlasQuestGiverState([q], false).symbol).toBe('·');
});

test('Dark Realm turn-in uses the same canonical Ilyra position as the server spawn', () => {
    const q = investigation('chronicle_dark_shore_collectors'); q.count = q.maxCount;
    const engine = game([q]); engine.currentInstanceId = 'dark-realm'; engine.currentInstanceType = 'dark_realm';
    const location = WORLD_LOCATIONS.find(p => p.id === 'story-wizard-dark-realm');
    expect(getAtlasQuestLocations(engine)[0]).toMatchObject({ x: location.x, z: location.z, instanceId: location.instanceId, symbol: '?' });
    expect(getAtlasQuestLocations(engine)[0].purpose).toContain('Resonant Projection');
});

test('atlas giver states match physical NPC markers without advertising future story chapters', () => {
    const current = { ...investigation(), chapter: 1 }, future = { ...investigation('chronicle_future'), accepted: false, chapter: 2 };
    const optional = { ...investigation('chronicle_legacy'), accepted: false, chapter: 0, legacyOptional: true };
    for (const quests of [[current, future], [{ ...current, count: 3 }, future], [current, future, optional], [{ ...current, completed: true }, future], []]) {
        expect(getAtlasQuestGiverState(quests, true).symbol).toBe(questMarkerState(quests, true) || '·');
    }
});

test('tracked hunts use labelled areas and boss/repair contracts use real admission points', () => {
    const engine = game([]);
    for (const [target, type, name] of [['Cinderheart Ore', 'COLLECT', 'Fire Realm area'], ['Skeleton', 'KILL', 'Earth Realm area'],
        ['HollowSentinel', 'KILL', 'entrance'], ['EarthCrystal', 'REPAIR', 'Dungeon Guide']]) {
        engine.player.quests = [{ id: 'chronicle_test', target, type, accepted: true, count: 0, maxCount: 8 }];
        const result = getAtlasQuestLocations(engine)[0];
        expect(result.name).toContain(name);
        expect(result.instanceId).toBe('');
        if (name.endsWith('area')) { expect(result.area).toBeDefined(); expect(result.purpose).toContain('not a specific spawn'); }
    }
    const chapter = darkRealmChapters.find(q => q.type === 'KILL');
    engine.player.quests = [{ id: chapter.id, target: chapter.enemy, type: chapter.type, accepted: true, count: 0, maxCount: chapter.count }];
    engine.currentInstanceId = 'dark-realm'; engine.currentInstanceType = 'dark_realm'; engine.currentDungeonLayout = darkRealmFixture();
    expect(getAtlasQuestLocations(engine)[0]).toMatchObject({ x: 40000, z: 40400, availability: 'Tracked · search this district' });
});

test('regional collection mappings continue to match the authoritative source families', () => {
    const source = fs.readFileSync('server/internal/game/quests.go', 'utf8');
    for (const item of ['Verdant Memory Seed', 'Moon-Tide Pearl', 'Cinderheart Ore', 'Stormglass Pinion']) {
        const enemies = [...source.match(new RegExp(`"${item}":\\s*\\{([^}]+)\\}`))[1].matchAll(/"([^"]+)":\s*true/g)].map(m => m[1]);
        const region = target => getAtlasQuestLocations(game([{ id: 'daily-test', target, type: 'KILL', accepted: true, count: 0, maxCount: 1 }]))[0].area.id;
        expect(enemies.length).toBeGreaterThan(0);
        for (const enemy of enemies) expect(region(enemy)).toBe(region(item));
    }
});
