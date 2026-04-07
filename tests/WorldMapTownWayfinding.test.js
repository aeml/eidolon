import { WorldMap } from '../src/ui/WorldMap.js';

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
            'Vendor / Repair'
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