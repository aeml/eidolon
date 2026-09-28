import * as THREE from 'three';
import { getCasinoMapState, drawCasinoWorldMap } from '../src/ui/CasinoMap.js';
import { Minimap } from '../src/ui/Minimap.js';
import { WorldMap } from '../src/ui/WorldMap.js';
import { createCasinoInterior, disposeCasinoObject } from '../src/art/ProceduralCasino.js';

const tables = ['public', 'vip'].flatMap(floor => ['slots', 'blackjack', 'poker', 'roulette', 'baccarat']
    .map((game, index) => ({ id: `${floor}-${game}`, floor, game, x: index * 10 - 20, z: 152 })));
const engine = floor => ({ currentInstanceType: 'casino', currentInstanceId: 'lanternhold-casino',
    casino: { floor, vipActive: false, data: { tables } }, remotePlayers: new Map() });
function canvas() {
    const texts = [], arcs = [], rectangles = [];
    return { texts, arcs, rectangles, save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {},
        arc(...args) { arcs.push(args); }, fillRect(...args) { rectangles.push(args); },
        strokeRect() {}, fillText(text, x, y) { texts.push({ text, x, y }); } };
}

test.each(['public', 'vip'])('%s map includes all game types and only the current floor', floor => {
    const state = getCasinoMapState(engine(floor));
    expect(state.tables.map(table => table.id)).toEqual(tables.filter(table => table.floor === floor).map(table => table.id));
    expect(state.tables.map(table => table.label)).toEqual(['Slots', 'Blackjack', 'Hold’em', 'Roulette', 'Baccarat']);
    expect(new Set(state.tables.map(table => table.symbol)).size).toBe(5);
});

test('guest dots do not reveal the other floor or a different known instance', () => {
    const game = engine('public');
    game.remotePlayers = new Map([
        ['public', { position: { x: 1, y: 0, z: 150 } }],
        ['vip', { position: { x: 1, y: 8, z: 150 } }],
        ['other', { instanceId: 'dungeon', position: { x: 1, y: 0, z: 150 } }]
    ]);
    expect(getCasinoMapState(game).guests).toEqual([game.remotePlayers.get('public')]);
    game.casino.floor = 'vip';
    expect(getCasinoMapState(game).guests).toEqual([game.remotePlayers.get('vip')]);
});

test('VIP access label follows authoritative controller state and upstairs has no public exit/guard', () => {
    const game = engine('public');
    expect(getCasinoMapState(game).landmarks[0].label).toContain('VIP required');
    game.casino.vipActive = true;
    expect(getCasinoMapState(game).landmarks[0].label).toContain('Upstairs access');
    game.casino.floor = 'vip';
    expect(getCasinoMapState(game).landmarks.map(marker => marker.label)).toEqual(['Return downstairs']);
});

test('map anchors match the actual production interior objects', () => {
    const root = createCasinoInterior(new THREE.Scene(), { addCollider() {} });
    const publicState = getCasinoMapState(engine('public')), vipState = getCasinoMapState(engine('vip'));
    expect(publicState.landmarks.map(marker => marker.z)).toEqual([
        root.userData.casinoGuard.position.z, root.userData.casinoExit.position.z
    ]);
    expect(vipState.landmarks[0].z).toBe(root.userData.casinoStairs.position.z);
    disposeCasinoObject(root);
});

test.each([[320, 480], [1000, 660]])('production world-map route renders current floor/legend within %sx%s canvas', (width, height) => {
    const ctx = canvas(), game = engine('vip');
    WorldMap.prototype.draw.call({ ctx, canvas: { width, height }, gameEngine: game }, { position: { x: 0, y: 8, z: 152 } });
    expect(ctx.texts.map(entry => entry.text)).toEqual(expect.arrayContaining([
        'Lanternhold Casino · VIP / EP', 'Return downstairs', 'R Roulette · B Baccarat'
    ]));
    expect(ctx.texts.some(entry => /Public|VIP Guard|Exit to/.test(entry.text))).toBe(false);
    expect(ctx.arcs.every(([x, y]) => x >= 0 && x <= width && y >= 0 && y <= height)).toBe(true);
    const [, , floorWidth, floorDepth] = ctx.rectangles[1];
    expect(floorWidth).toBe(floorDepth); // Current venue is 112 x 112, not the old 68 x 76.
});

test('minimap shows upstairs stairs even north of old town bounds, never the public exit', () => {
    const game = engine('vip'), ctx = canvas(), positions = [];
    Minimap.prototype._drawTownServiceMarkers.call({ gameEngine: game }, ctx,
        (x, z) => { positions.push([x, z]); return { x: 100, y: 100 }; },
        { position: { x: 0, y: 8, z: 98 } }, 100);
    expect(positions).toEqual([[0, 98]]);
    expect(ctx.texts.map(entry => entry.text)).toEqual(['Downstairs']);
});

test('casino minimap global party dots require a live guest on the selected floor', () => {
    const game = engine('public'), ctx = canvas(), seen = [];
    game.uiManager = { partyData: { members: ['here', 'upstairs', 'absent'].map(id => ({ id, x: 1, z: 150 })) } };
    game.remotePlayers = new Map([
        ['here', { position: { x: 1, y: 0, z: 150 } }],
        ['upstairs', { position: { x: 1, y: 8, z: 150 } }]
    ]);
    Minimap.prototype._drawGlobalPartyMembers.call({ gameEngine: game }, ctx,
        (x, z) => { seen.push([x, z]); return { x: 100, y: 100 }; }, 100, { id: 'self' });
    expect(seen).toEqual([[1, 150]]);
});

test('unavailable catalog and invalid entries fail closed without inventing blackjack tables', () => {
    expect(getCasinoMapState({}).tables).toEqual([]);
    const game = engine('public');
    game.casino.data.tables = [{ game: 'unknown', x: 0, z: 152 }, { game: 'slots', x: NaN, z: 152 }];
    expect(getCasinoMapState(game).tables).toEqual([]);
    const ctx = canvas();
    drawCasinoWorldMap(ctx, 320, 480, {}, { position: { x: 0, z: 200 } });
    expect(ctx.texts.some(entry => entry.text === 'You')).toBe(true);
});
