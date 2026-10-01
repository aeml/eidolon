import { jest } from '@jest/globals';
import fs from 'node:fs';
import { AtlasNavigation, getAtlasLocations, getAtlasWorldLocations, getWaypointGuidance, isAtlasPartyMemberVisible, drawAtlasWaypoint } from '../src/ui/AtlasNavigation.js';
import { WORLD_READINGS } from '../src/data/worldPopulation.js';
import { DUNGEON_ENTRY_LEVELS } from '../src/data/dungeonProgression.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/data/dungeonEntrances.js';
import { getPublicEventLocations, publicEventTime } from '../src/ui/PublicEventDiscovery.js';

const engine = () => ({ player: { id: 'me', level: 30, position: { x: 0, z: 200 } }, currentInstanceId: '', currentInstanceType: '' });

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
