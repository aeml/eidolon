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
            expect.objectContaining({ id: 'quest-giver', label: 'Quest Giver', x: -25, z: 200 }),
            expect.objectContaining({ id: 'forge', label: 'Forge', x: -28, z: 218 }),
            expect.objectContaining({ id: 'stash', label: 'Stash', x: 0, z: 185 }),
            expect.objectContaining({ id: 'trading-house', label: 'Trading House', x: -22, z: 185 }),
            expect.objectContaining({ id: 'vendor-repair', label: 'Vendor / Repair', x: 22.5, z: 200 }),
            expect.objectContaining({ id: 'dungeon-guide', label: 'Dungeon Guide', x: 0, z: 240 })
        ]));
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
});