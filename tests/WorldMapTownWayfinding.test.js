import { WorldMap } from '../src/ui/WorldMap.js';

describe('WorldMap town wayfinding', () => {
    let texts;
    let ctx;

    beforeEach(() => {
        texts = [];
        ctx = {
            fillRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {},
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
            'Stash'
        ]));
    });
});