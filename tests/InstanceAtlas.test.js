import { getInstanceAtlas, atlasSpaceKey, drawInstanceAtlasFloor } from '../src/ui/InstanceAtlas.js';
import { getAtlasLocations, getWaypointGuidance } from '../src/ui/AtlasNavigation.js';

const dungeon = () => {
    const rooms = [0, 1, 2, 3].map(index => ({ index, x: index * 100, z: 0, width: 60, height: 60,
        type: index === 0 ? 'start' : index === 3 ? 'boss' : 'normal', hook: index === 1 ? 'chest' : '', explored: index < 2, cleared: index === 0 }));
    const summary = { rooms, currentRoomIndex: 0, objectiveRoomIndex: 1 };
    return { currentInstanceId: 'run-a', currentInstanceType: 'molten_core', player: { position: { x: 0, z: 0 } },
        getDungeonRoomSummary: () => summary,
        currentDungeonLayout: { rooms, walkRects: [...rooms, { x: 50, z: 0, width: 40, height: 12, kind: 'corridor' }] } };
};

test('interior uses real floor union with open corridor joins and caches immutable layout geometry', () => {
    const game = dungeon(), model = getInstanceAtlas(game);
    expect(model.title).toBe('Molten Core');
    expect(model.floors.some(r => r.left <= 50 && r.right >= 50 && r.top <= 0 && r.bottom >= 0)).toBe(true);
    expect(model.walls.some(w => w.axis === 'z' && [30, 70].includes(w.at) && w.start < 0 && w.end > 0)).toBe(false);
    const next = getInstanceAtlas(game);
    expect(next.floors).toBe(model.floors);
    game.getDungeonRoomSummary().rooms[1].cleared = true;
    expect(getInstanceAtlas(game).floors).toBe(model.floors);
    expect(getAtlasLocations(game).find(p => p.id === 'room-1').availability).toBe('Cleared');
    game.currentDungeonLayout = { walkRects: [{ x: 0, z: 0, width: 12, height: 14 }] };
    expect(getInstanceAtlas(game).floors).not.toBe(model.floors);
});

test('unknown future room details remain hidden but current and next encounter guidance survive', () => {
    const game = dungeon();
    // A meaningful next room is allowed, just as the existing dungeon guide
    // previews the next beat; a later unexplored boss is not listed.
    game.getDungeonRoomSummary().rooms[2].type = 'elite';
    const locations = getAtlasLocations(game);
    expect(locations.some(p => p.id === 'room-0')).toBe(true);
    expect(locations.some(p => p.id === 'room-1')).toBe(true);
    expect(locations.some(p => p.id === 'room-2')).toBe(true);
    expect(locations.some(p => p.id === 'room-3')).toBe(false);
    expect(locations.some(p => /Forge|Stash|Trading/.test(p.name))).toBe(false);
    const target = { ...locations[1], spaceKey: atlasSpaceKey(game) };
    expect(getWaypointGuidance(game, target)).not.toBeNull();
    game.currentInstanceId = 'run-b'; expect(getWaypointGuidance(game, target)).toBeNull();
});

test('missing/invalid layout never falls back to overworld terrain', () => {
    expect(getInstanceAtlas({ currentInstanceId: 'run', currentInstanceType: 'molten_core' })).toMatchObject({ floors: [], bounds: null, title: 'Molten Core' });
    expect(getInstanceAtlas({ currentInstanceId: 'run', currentDungeonLayout: { walkRects: [{ x: NaN, z: 0, width: 20, height: 20 }] } }).bounds).toBeNull();
    expect(getInstanceAtlas({ currentInstanceType: 'overworld', currentInstanceId: '' })).toBeNull();
});

test('PvP maps actual arena footprint without adding dungeon objectives or enemy dots', () => {
    const model = getInstanceAtlas({ currentInstanceType: 'pvp_arena', currentInstanceId: 'match', currentDungeonLayout: {
        walkRects: [{ x: 0, z: 0, width: 50.5, height: 34.5 }], rooms: [{ x: 0, z: 0, width: 50.5, height: 34.5, type: 'start' }]
    } });
    expect(model.bounds).toEqual({ minX: -25.25, maxX: 25.25, minZ: -17.25, maxZ: 17.25 });
    expect(model.locations).toEqual([]); expect(model.objective).toBeUndefined();
});

test('casino waypoint and station catalogue stay on the selected floor', () => {
    const game = { currentInstanceType: 'casino', currentInstanceId: 'casino', player: { position: { x: 0, z: 152 } },
        casino: { floor: 'public', data: { tables: [{ id: 'down', floor: 'public', game: 'slots', x: 10, z: 152 }, { id: 'up', floor: 'vip', game: 'slots', x: 10, z: 152 }] } } };
    const target = getAtlasLocations(game).find(p => p.id === 'table-down');
    expect(getWaypointGuidance(game, target)).not.toBeNull();
    game.casino.floor = 'vip';
    expect(getWaypointGuidance(game, target)).toBeNull();
    expect(getAtlasLocations(game).some(p => p.id === 'table-down')).toBe(false);
    expect(getAtlasLocations(game).some(p => p.id === 'table-up')).toBe(true);
});

test('atlas and radar floor painter projects actual rotated corners, not half-size screen rectangles', () => {
    const points = [], model = getInstanceAtlas({ currentInstanceType: 'pvp_arena', currentInstanceId: 'match',
        currentDungeonLayout: { walkRects: [{ x: 0, z: 0, width: 40, height: 20 }] } });
    const ctx = { beginPath() {}, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); }, closePath() {}, fill() {}, stroke() {} };
    drawInstanceAtlasFloor(ctx, model, (x, z) => ({ x: x - z, y: x + z }));
    expect(points.slice(0, 4)).toEqual([[-10, -30], [30, 10], [10, 30], [-30, -10]]);
});
