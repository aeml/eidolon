import { WorldMap } from '../src/ui/WorldMap.js';
import { TOWN_SERVICE_POINTS } from '../src/ui/townServiceConfig.js';

describe('WorldMap town wayfinding', () => {
    let texts;
    let strokes;
    let ctx;

    beforeEach(() => {
        texts = [];
        strokes = [];
        ctx = {
            fillRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }),
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            clearRect: () => {},
            save: () => {},
            restore: () => {},
            fillText: (...args) => texts.push(String(args[0])),
            set fillStyle(value) { this._fillStyle = value; },
            get fillStyle() { return this._fillStyle; },
            set strokeStyle(value) { this._strokeStyle = value; },
            get strokeStyle() { return this._strokeStyle; },
            set lineWidth(value) { this._lineWidth = value; },
            get lineWidth() { return this._lineWidth; },
            font: '',
            textAlign: ''
        };

        document.body.innerHTML = `
            <div id="world-map" style="display:flex; width: 640px; height: 480px;">
                <div id="world-map-header"></div>
                <canvas id="world-map-canvas"></canvas>
            </div>
        `;

        const container = document.getElementById('world-map');
        Object.defineProperty(container, 'clientWidth', { configurable: true, value: 640 });
        Object.defineProperty(container, 'clientHeight', { configurable: true, value: 480 });

        const canvas = document.getElementById('world-map-canvas');
        canvas.getContext = () => ctx;

        global.ResizeObserver = class {
            constructor(callback) {
                this.callback = callback;
            }
            observe() {}
            disconnect() {}
        };
    });

    test('uses exact canonical town-service anchor positions for world-map wayfinding', () => {
        expect(TOWN_SERVICE_POINTS).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'quest-giver', label: 'Quest Giver', x: -20, z: 200 }),
            expect.objectContaining({ id: 'forge', label: 'Forge', x: -28, z: 218 }),
            expect.objectContaining({ id: 'stash', label: 'Stash', x: 0, z: 185 }),
            expect.objectContaining({ id: 'trading-house', label: 'Trading House', x: -22, z: 185 }),
            expect.objectContaining({ id: 'vendor-repair', label: 'Vendor / Repair', x: 22.5, z: 200 }),
            expect.objectContaining({ id: 'dungeon-guide', label: 'Dungeon Guide', x: 0, z: 240 })
        ]));
    });

    test('touch pan and pinch preserve the location beneath the gesture and stop on cancellation', () => {
        const map = new WorldMap({ player: null });
        map.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 440 });
        const touch = (type, points) => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY]) => ({ clientX, clientY })) });
            map.canvas.dispatchEvent(event);
        };
        touch('touchstart', [[320, 220]]);
        touch('touchmove', [[340, 230]]);
        expect([map.mapOffsetX, map.mapOffsetY]).toEqual([20, 10]);
        touch('touchstart', [[290, 230], [390, 230]]);
        touch('touchmove', [[240, 230], [440, 230]]);
        expect(map.scale).toBe(4);
        expect([map.mapOffsetX, map.mapOffsetY]).toEqual([20, 10]);
        expect(map.zoomLabel.textContent).toBe('200%');
        touch('touchcancel', []);
        touch('touchmove', [[600, 400]]);
        expect([map.mapOffsetX, map.mapOffsetY]).toEqual([20, 10]);
    });

    test('map buttons zoom within limits and recenter without resetting zoom', () => {
        const engine = { player: null };
        const map = new WorldMap(engine);
        document.querySelector('[data-map-zoom="in"]').click();
        expect(map.scale).toBe(2.5);
        document.querySelector('[data-map-zoom="out"]').click();
        expect(map.scale).toBe(2);
        map.setMapScale(100); expect(map.scale).toBe(10);
        map.setMapScale(.01); expect(map.scale).toBe(.5);
        map.setMapScale(NaN); expect(map.scale).toBe(.5);
        engine.player = { position: { x: 70, z: 210 } };
        map._redrawIfVisible = () => {};
        map.mapOffsetX = 99; map.mapOffsetY = 90;
        document.querySelector('[data-map-center]').click();
        expect([map.cameraX, map.cameraZ, map.mapOffsetX, map.mapOffsetY]).toEqual([70, 210, 0, 0]);
        expect(map.scale).toBe(.5);
    });

    test('renders named town POIs for new-player wayfinding', () => {
        const worldMap = new WorldMap({
            player: { position: { x: 0, z: 200 }, id: 'player-1' },
            chunkManager: { getActiveEntities: () => [] },
            uiManager: { partyData: { members: [] } }
        });

        worldMap.draw({ position: { x: 0, z: 200 }, id: 'player-1' });

        expect(texts).toEqual(expect.arrayContaining([
            'Quest Giver',
            'Stash',
            'Forge',
            'Trading House',
            'Vendor / Repair',
            'Dungeon Guide'
        ]));
    });

    test('prioritizes starter-route POIs in onboarding order and emphasizes quest and forge markers', () => {
        const worldMap = new WorldMap({
            player: { position: { x: 0, z: 200 }, id: 'player-1' },
            chunkManager: { getActiveEntities: () => [] },
            uiManager: { partyData: { members: [] } }
        });

        worldMap.draw({ position: { x: 0, z: 200 }, id: 'player-1' });

        const questIndex = texts.indexOf('Quest Giver');
        const forgeIndex = texts.indexOf('Forge');
        const stashIndex = texts.indexOf('Stash');
        const vendorIndex = texts.indexOf('Vendor / Repair');

        expect(questIndex).toBeGreaterThanOrEqual(0);
        expect(forgeIndex).toBeGreaterThanOrEqual(0);
        expect(stashIndex).toBeGreaterThanOrEqual(0);
        expect(vendorIndex).toBeGreaterThanOrEqual(0);
        expect(questIndex).toBeLessThan(forgeIndex);
        expect(forgeIndex).toBeLessThan(stashIndex);
        expect(stashIndex).toBeLessThan(vendorIndex);
        expect(strokes).toEqual(expect.arrayContaining([
            expect.objectContaining({ strokeStyle: '#ffd700' }),
            expect.objectContaining({ strokeStyle: '#ff9b4a' })
        ]));
    });

    test('renders current and next dungeon beat markers for the active instance', () => {
        const worldMap = new WorldMap({
            player: { position: { x: 2400, z: 200 }, id: 'player-1' },
            chunkManager: { getActiveEntities: () => [] },
            uiManager: { partyData: { members: [] } },
            currentInstanceType: 'tempest_spire',
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: false },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: false, cleared: false },
                    { index: 3, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            })
        });

        worldMap.draw({ position: { x: 2400, z: 200 }, id: 'player-1' });

        expect(texts).toEqual(expect.arrayContaining([
            '★ Tempest Spire [Treasure Cache • Payoff]',
            'Next: Ambush Chamber'
        ]));
        expect(strokes).toEqual(expect.arrayContaining([
            expect.objectContaining({ strokeStyle: '#ffd700' }),
            expect.objectContaining({ strokeStyle: 'rgba(255, 145, 90, 0.6)' })
        ]));
    });

    test('renders boss approach beats before the active dungeon boss marker', () => {
        const worldMap = new WorldMap({
            player: { position: { x: 2400, z: 200 }, id: 'player-1' },
            chunkManager: { getActiveEntities: () => [] },
            uiManager: { partyData: { members: [] } },
            currentInstanceType: 'tempest_spire',
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 2,
                objectiveRoomIndex: 3,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'elite', hook: 'elite_ambush', explored: true, cleared: true },
                    { index: 2, type: 'normal', hook: 'shrine', explored: true, cleared: true },
                    { index: 3, type: 'normal', pacing: 'boss_approach', explored: true, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            })
        });

        worldMap.draw({ position: { x: 2400, z: 200 }, id: 'player-1' });

        expect(texts).toEqual(expect.arrayContaining([
            '★ Tempest Spire [Boss Approach • Pressure]',
            'Next: Boss Lair'
        ]));
        expect(strokes).toEqual(expect.arrayContaining([
            expect.objectContaining({ strokeStyle: 'rgba(255, 110, 110, 0.6)' })
        ]));
    });

    test('renders a live boss marker when the active dungeon boss is already engaged', () => {
        const worldMap = new WorldMap({
            player: { position: { x: 2400, z: 200 }, id: 'player-1' },
            chunkManager: { getActiveEntities: () => [] },
            uiManager: { partyData: { members: [] } },
            currentInstanceType: 'tempest_spire',
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 4,
                objectiveRoomIndex: 4,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: true },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: true, cleared: true },
                    { index: 3, type: 'normal', hook: 'shrine', explored: true, cleared: true },
                    { index: 4, type: 'boss', explored: true, cleared: false }
                ]
            })
        });

        worldMap.draw({ position: { x: 2400, z: 200 }, id: 'player-1' });

        expect(texts).toEqual(expect.arrayContaining([
            '★ Tempest Spire [Boss Now • Climax]'
        ]));
        expect(texts).not.toContain('Next: Boss Lair');
        expect(strokes).toEqual(expect.arrayContaining([
            expect.objectContaining({ strokeStyle: 'rgba(255, 110, 110, 0.6)' })
        ]));
    });
});
