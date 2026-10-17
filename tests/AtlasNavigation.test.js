import { jest } from '@jest/globals';
import fs from 'node:fs';
import { AtlasNavigation, getAtlasLocations, getAtlasWorldLocations, getWaypointGuidance, isAtlasPartyMemberVisible, drawAtlasWaypoint } from '../src/ui/AtlasNavigation.js';
import { WORLD_READINGS } from '../src/data/worldPopulation.js';
import { DUNGEON_ENTRY_LEVELS } from '../src/data/dungeonProgression.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/data/dungeonEntrances.js';
import { getPublicEventLocations, publicEventTime } from '../src/ui/PublicEventDiscovery.js';

const engine = () => ({ player: { id: 'me', level: 30, position: { x: 0, z: 200 } }, currentInstanceId: '', currentInstanceType: '' });

function questFocusFixture() {
    document.body.innerHTML = '<div id="quest-focus-map"><canvas></canvas></div>';
    const ge = engine();
    ge.player.quests = [{ id: 'daily_skeleton', title: 'Road patrol', type: 'KILL', target: 'Skeleton', accepted: true, maxCount: 10 }];
    ge.uiManager = { quest: { getTrackedObjectives: () => [], buildObjectiveSummary: () => [] } };
    const map = { gameEngine: ge, container: document.getElementById('quest-focus-map'), canvas: document.querySelector('canvas'),
        cameraX: 0, cameraZ: 200, scale: .1, mapOffsetX: 0, mapOffsetY: 0, autoFitAtlas: true,
        updateZoomLabel: jest.fn(), fitAtlasBounds: jest.fn(), _redrawIfVisible: jest.fn() };
    return { ge, map, navigation: new AtlasNavigation(map) };
}

test('direct quest focus shows a target and restores atlas search and filters without changing tracked quests', () => {
    const { ge, map, navigation } = questFocusFixture();
    navigation.search.value = navigation.query = 'forge'; navigation.filters.delete('quests'); navigation.refresh(true);
    expect(navigation.focusQuest('daily_skeleton')).toBe(true);
    expect(navigation.questFocusId).toBe('daily_skeleton'); expect(navigation.query).toBe('');
    expect(navigation.filters.has('quests')).toBe(true);
    const selected = navigation.locations.find(p => p.id === navigation.selectedId);
    expect(selected.questId).toBe('daily_skeleton'); expect(selected.category).toBe('quests');
    expect(map.cameraX).toBe(selected.x); expect(map.cameraZ).toBe(selected.z);
    expect(navigation.detail.querySelector('h3')).toBe(document.activeElement);
    expect(ge.uiManager.quest.getTrackedObjectives()).toEqual([]);
    navigation.clearQuestFocus();
    expect(navigation.questFocusId).toBeNull(); expect(navigation.query).toBe('forge');
    expect(navigation.search.value).toBe('forge'); expect(navigation.filters.has('quests')).toBe(false);
    expect(navigation.locations.filter(p => p.questId)).toEqual([]);
});

test('unavailable quest focus leaves the current destination and viewport alone', () => {
    const { map, navigation } = questFocusFixture();
    navigation.query = navigation.search.value = 'forge'; const before = { cameraX: map.cameraX, cameraZ: map.cameraZ, scale: map.scale };
    expect(navigation.focusQuest('missing')).toBe(false);
    expect(navigation.questFocusId).toBeNull(); expect(navigation.query).toBe('forge');
    expect({ cameraX: map.cameraX, cameraZ: map.cameraZ, scale: map.scale }).toEqual(before);
});

test('direct Dark Realm quest focus shows an untracked manual turn-in without changing progress or pins', () => {
    const { ge, navigation } = questFocusFixture();
    ge.currentInstanceId = 'dark-realm'; ge.currentInstanceType = 'dark_realm';
    const quest = { id: 'chronicle_dark_shore_collectors', title: 'Shore collectors', category: 'chronicle',
        accepted: true, completed: false, count: 3, maxCount: 3 };
    ge.player.quests = [quest]; navigation.refresh();
    const before = JSON.stringify(quest);
    expect(navigation.locations.filter(p => p.questId)).toEqual([]);
    expect(navigation.focusQuest(quest.id)).toBe(true);
    expect(navigation.locations.find(p => p.id === navigation.selectedId)).toMatchObject({
        questId: quest.id, instanceId: 'dark-realm', symbol: '?', name: 'Turn in · Shore collectors'
    });
    expect(JSON.stringify(quest)).toBe(before); expect(ge.uiManager.quest.getTrackedObjectives()).toEqual([]);
    navigation.clearQuestFocus(); expect(navigation.locations.filter(p => p.questId)).toEqual([]);
});

test('quest focus chooses the unread site the player is already standing at', () => {
    const { ge, navigation } = questFocusFixture();
    const questId = 'chronicle_earth_returning_scar';
    ge.player.quests = [{ id: questId, category: 'chronicle', type: 'INVESTIGATE', accepted: true, count: 1, maxCount: 3, investigationMask: 1 }];
    const targets = getAtlasLocations(ge, { questId }).filter(p => p.category === 'quests' && p.questId === questId);
    expect(targets.length).toBeGreaterThan(1);
    const here = targets.at(-1); ge.player.position = { x: here.x, z: here.z };
    expect(navigation.focusQuest(questId)).toBe(true); expect(navigation.selectedId).toBe(here.id);
});

test('recording the selected site advances focus to unread work and then to manual turn-in', () => {
    const { ge, navigation } = questFocusFixture();
    const quest = { id: 'chronicle_earth_returning_scar', category: 'chronicle', type: 'INVESTIGATE', accepted: true,
        count: 0, maxCount: 3, investigationMask: 0 }; ge.player.quests = [quest];
    const targets = getAtlasLocations(ge, { questId: quest.id }).filter(p => p.category === 'quests' && p.questId === quest.id);
    ge.player.position = { x: targets[0].x, z: targets[0].z }; navigation.focusQuest(quest.id);
    const first = navigation.selectedId; quest.investigationMask = 1; quest.count = 1; navigation.refresh();
    expect(navigation.selectedId).not.toBe(first);
    expect(document.activeElement).toBe(navigation.detail.querySelector('h3'));
    expect(navigation.locations.find(p => p.id === navigation.selectedId).category).toBe('quests');
    quest.investigationMask = 7; quest.count = 3; navigation.refresh();
    expect(navigation.locations.find(p => p.id === navigation.selectedId).name).toContain('Turn in');
    expect(quest.completed).not.toBe(true); expect(ge.uiManager.quest.getTrackedObjectives()).toEqual([]);
});

test('typing a location exits temporary quest focus without changing the typed case or caret', () => {
    const { navigation } = questFocusFixture(); navigation.focusQuest('daily_skeleton');
    navigation.search.value = 'Root'; navigation.search.setSelectionRange(2, 2);
    navigation.search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(navigation.questFocusId).toBeNull(); expect(navigation.query).toBe('root');
    expect(navigation.search.value).toBe('Root'); expect(navigation.search.selectionStart).toBe(2);
});

test('a deliberate different destination leaves quest focus and stays selected through later progress', () => {
    const { ge, navigation } = questFocusFixture(); navigation.focusQuest('daily_skeleton');
    const service = navigation.locations.find(p => p.category === 'services'); navigation.select(service.id);
    ge.player.quests[0].count = 2; navigation.refresh();
    expect(navigation.questFocusId).toBeNull(); expect(navigation.selectedId).toBe(service.id);
});

test('claimed completion retires temporary focus and restores the prior normal map state', () => {
    const { ge, map, navigation } = questFocusFixture();
    navigation.query = navigation.search.value = 'forge'; const scale = map.scale;
    navigation.focusQuest('daily_skeleton'); ge.player.quests[0].completed = true; navigation.refresh();
    expect(navigation.questFocusId).toBeNull(); expect(navigation.query).toBe('forge'); expect(map.scale).toBe(scale);
    expect(navigation.questFocusNotice.hidden).toBe(true);
});

test('an instance transition clears quest focus without restoring the overworld viewport into the instance', () => {
    const { ge, map, navigation } = questFocusFixture(); navigation.focusQuest('daily_skeleton');
    ge.currentInstanceId = 'casino-shared'; ge.currentInstanceType = 'casino';
    map.cameraX = 0; map.cameraZ = 132; map.scale = 1; navigation.refresh();
    expect(navigation.questFocusId).toBeNull(); expect(navigation.selectedId).toBeNull();
    expect([map.cameraX, map.cameraZ, map.scale]).toEqual([0, 132, 1]);
});

test('terrain legend explains actual Earth relief only in a raised overworld, never in flat or instance maps', () => {
    document.body.innerHTML = '<div id="map"><canvas></canvas></div>';
    const ge = engine(), map = { gameEngine: ge, container: document.getElementById('map'), canvas: document.querySelector('canvas') };
    const navigation = new AtlasNavigation(map), legend = navigation.root.querySelector('[data-atlas-terrain-legend]');
    expect(legend.hidden).toBe(true);
    map.cartography = { elevation: {} }; navigation.refresh();
    expect(legend.hidden).toBe(false); expect(legend.textContent).toContain('3m elevation intervals');
    ge.currentInstanceId = 'casino-shared'; ge.currentInstanceType = 'casino'; navigation.refresh();
    expect(legend.hidden).toBe(true);
    ge.currentInstanceId = ''; ge.currentInstanceType = 'overworld'; navigation.refresh();
    expect(legend.hidden).toBe(false);
});

test('atlas publishes authoritative event windows with objectives and stable occurrence waypoints', () => {
    const ge = engine();
    const current = { id: 'disturbance-1', phase: 'defending', site: { title: 'Root ward', realm: 'earth', x: -750, z: 200, level: 35, objective: 'Hold the center.', lore: '<b>Old road</b>' },
        startsAt: '2026-10-01T00:01:00Z', endsAt: '2026-10-01T00:08:00Z',
        upcoming: [{ id: 'disturbance-2', site: { title: 'Tide ward', realm: 'water', x: 0, z: -900, level: 55, objective: 'Follow the rune.' }, startsAt: '2026-10-01T00:11:00Z', endsAt: '2026-10-01T00:18:00Z' }] };
    ge.publicEvents = { data: current };
    const events = getAtlasLocations(ge).filter(p => p.category === 'events');
    expect(events).toHaveLength(2);
    expect(events[0].availability).toContain('Defend the ward');
    expect(events[0].purpose).toContain('Hold the center.');
    expect(events[0].purpose).toContain('no Gold purse or reward claim');
    expect(events[1]).toMatchObject({ id: 'public-event-disturbance-2', x: 0, z: -900, symbol: '◷' });
    expect(events[1].availability).toContain('Scheduled · water realm · recommended level 55');
    expect(events[1].availability).toContain('2026-10-01 00:11 UTC');
    document.body.innerHTML = '<div id="map"><canvas></canvas></div>';
    const map = { gameEngine: ge, container: document.getElementById('map'), canvas: document.querySelector('canvas'), _redrawIfVisible: jest.fn(), updateZoomLabel: jest.fn() };
    const navigation = new AtlasNavigation(map);
    navigation.select(events[1].id); navigation.detail.querySelector('button').click();
    expect(navigation.waypoint).toMatchObject({ id: events[1].id, x: 0, z: -900 });
    ge.publicEvents.data = { ...current.upcoming[0], phase: 'announced', upcoming: [] };
    navigation.refresh();
    expect(navigation.selectedId).toBe(events[1].id);
    expect(navigation.detail.textContent).toContain('Gather at the ward');
    expect(navigation.waypoint).toMatchObject({ x: 0, z: -900 });
    ge.currentInstanceId = 'private';
    expect(getAtlasLocations(ge).filter(p => p.category === 'events')).toEqual([]);
});

test('event discovery is bounded and does not promote expired local windows to active encounters', () => {
    const valid = { id: 'future', site: { x: 0, z: 0 }, startsAt: '2020-01-01T00:00:00Z' };
    const result = getPublicEventLocations({ id: 'expired', phase: 'expired', site: { x: 0, z: 0 }, upcoming: [valid, valid, { id: 'bad', site: { x: NaN, z: 0 } }, valid] });
    expect(result).toHaveLength(1);
    expect(result[0].availability).toContain('Scheduled');
    expect(result[0].availability).toContain('Time unavailable');
    expect(getPublicEventLocations(null)).toEqual([]);
    expect(publicEventTime('invalid')).toBe('Time unavailable');
    expect(publicEventTime(null)).toBe('Time unavailable');
});

test('public realm places use physical approaches and lore anchors without exposing story text or saved ticks', () => {
    const ge = engine(), sites = getAtlasWorldLocations(ge);
    expect(sites).toHaveLength(26);
    expect(sites.map(site => site.id)).toEqual(expect.arrayContaining([
        'spire-muster', 'horizon-orrery', 'couriers-exchange', 'weatherkeepers-bivouac',
        'unsent-dispatch', 'unmeasured-sky'
    ]));
    expect(sites.every(site => site.category === 'places' && site.symbol !== '✓')).toBe(true);
    expect(sites.find(site => site.id === 'verdant-approach')).toMatchObject({ x: 800, z: 242 });
    expect(sites.some(site => site.id === 'keepers-empty-house' || site.id === 'returning-scar')).toBe(false);
    for (const reading of WORLD_READINGS) {
        const marker = sites.find(site => site.id === reading.locationId);
        expect(marker).toMatchObject({ x: reading.x, z: reading.z, symbol: '▤' });
        expect(marker.availability).toContain('not a saved quest discovery');
        expect(JSON.stringify(marker)).not.toContain(reading.reading.paragraphs[0]);
    }
    ge.currentInstanceId = 'private'; expect(getAtlasWorldLocations(ge)).toEqual([]);
    ge.currentInstanceId = ''; ge.currentInstanceType = 'casino'; expect(getAtlasWorldLocations(ge)).toEqual([]);
});

test('known catalogue derives all entrances and seven real gates without revealing private/discovery data', () => {
    const ge = engine(), locations = getAtlasLocations(ge);
    expect(locations.filter(p => p.category === 'passages')).toHaveLength(7);
    for (const [id, definition] of Object.entries(DUNGEON_ENTRANCE_DEFINITIONS)) {
        expect(locations.find(p => p.id === id)).toMatchObject({ x: definition.position[0], z: definition.position[2], instanceId: '' });
    }
    expect(locations.find(p => p.id === 'molten_core').availability).toContain('Minimum level 70');
    expect(locations.find(p => p.id === 'resonance-portal').availability).toContain('Requires level 100');
    ge.atlasDungeonEntryLevels = { molten_core: 75 };
    ge.currentInstanceType = 'overworld'; // actual return-to-town wire type
    expect(getAtlasLocations(ge).find(p => p.id === 'molten_core').availability).toContain('Minimum level 75');
    for (const type of ['casino', 'dark_realm', 'molten_core', 'earth_crystal_raid', 'arena']) {
        ge.currentInstanceType = type; expect(getAtlasLocations(ge)).toEqual([]);
    }
    ge.currentInstanceType = ''; ge.currentInstanceId = 'private-123'; expect(getAtlasLocations(ge)).toEqual([]);
});

test('rolling-deployment dungeon level defaults agree with current server authority', () => {
    const source = fs.readFileSync('server/internal/game/dungeon_progression.go', 'utf8');
    for (const [id, level] of Object.entries(DUNGEON_ENTRY_LEVELS)) {
        const match = source.match(new RegExp(`"${id}":\\s*(\\d+|MaxPlayerLevel)`));
        expect(match).not.toBeNull();
        expect(match[1] === 'MaxPlayerLevel' ? 100 : Number(match[1])).toBe(level);
    }
});

test('waypoint reports world direction and straight-line distance only in its own scene', () => {
    const ge = engine(), waypoint = { name: 'Water gate', instanceId: '', x: 0, z: -600 };
    expect(getWaypointGuidance(ge, waypoint)).toMatchObject({ distance: 800, direction: 'N' });
    expect(getWaypointGuidance(ge, waypoint).text).toContain('straight line');
    waypoint.x = 800; waypoint.z = 200;
    expect(getWaypointGuidance(ge, waypoint).direction).toBe('E');
    ge.currentInstanceId = 'dungeon-one'; expect(getWaypointGuidance(ge, waypoint)).toBeNull();
    ge.currentInstanceId = ''; waypoint.x = NaN; expect(getWaypointGuidance(ge, waypoint)).toBeNull();
});

test('party dots require explicit matching instance identity and finite positions', () => {
    const ge = engine(), member = { instanceId: '', x: 10, z: 200 };
    expect(isAtlasPartyMemberVisible(ge, member)).toBe(true);
    expect(isAtlasPartyMemberVisible(ge, { x: 10, z: 200 })).toBe(false);
    member.instanceId = 'dungeon-one'; expect(isAtlasPartyMemberVisible(ge, member)).toBe(false);
    ge.currentInstanceId = 'dungeon-one'; expect(isAtlasPartyMemberVisible(ge, member)).toBe(true);
    member.x = Infinity; expect(isAtlasPartyMemberVisible(ge, member)).toBe(false);
});

test('search, category filters, selection, waypoint clearing and scene transitions use accessible DOM', () => {
    document.body.innerHTML = '<div id="map"><canvas></canvas></div>';
    const ge = engine(), map = { gameEngine: ge, container: document.getElementById('map'), canvas: document.querySelector('canvas'),
        _redrawIfVisible: jest.fn(), updateZoomLabel: jest.fn(), showWorldOverview: jest.fn() };
    const navigation = new AtlasNavigation(map);
    navigation.search.value = 'molten'; navigation.search.dispatchEvent(new Event('input'));
    expect(navigation.results.querySelectorAll('button')).toHaveLength(2);
    navigation.results.querySelector('button').click();
    expect([map.cameraX, map.cameraZ]).toEqual([-2400, 200]);
    expect(document.activeElement.textContent).toBe('Molten Core');
    expect(navigation.detail.textContent).toContain('Minimum level 70');
    navigation.detail.querySelector('button').click();
    expect(navigation.waypoint.id).toBe('molten_core');
    expect(navigation.status.textContent).toContain('2400m W');
    const entries = [...navigation.root.querySelectorAll('.atlas-filters label')].find(label => label.textContent.includes('Entrances')).querySelector('input');
    entries.click();
    expect(navigation.results.querySelectorAll('button')).toHaveLength(1);
    expect(navigation.results.textContent).toContain('Molten Core Approach');
    ge.currentInstanceId = 'other'; navigation.refresh();
    expect(navigation.detail.hidden).toBe(true);
    expect(navigation.results.textContent).toContain('Current instance');
    expect(navigation.status.textContent).toContain('waypoint in the overworld');
    navigation.clear.click(); expect(navigation.waypoint).toBeNull();
    const replacement = new AtlasNavigation(map);
    expect(document.querySelectorAll('.atlas-navigation')).toHaveLength(1);
    expect(replacement.waypoint).toBeNull();
});

test('waypoint overlay clamps its directional arrow to the radar edge', () => {
    const ctx = Object.fromEntries(['save', 'restore', 'translate', 'rotate', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'fillText'].map(k => [k, jest.fn()]));
    drawAtlasWaypoint(ctx, { x: 1000, y: 100 }, { x: 100, y: 100 }, 75, '900m');
    expect(ctx.translate).toHaveBeenCalledWith(175, 100);
    expect(ctx.rotate).toHaveBeenCalledWith(0);
    expect(ctx.fillText).toHaveBeenCalledWith('900m', 175, 87);
});
