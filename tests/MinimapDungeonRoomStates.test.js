import { jest } from '@jest/globals';
import { Minimap } from '../src/ui/Minimap.js';

describe('Minimap dungeon room states', () => {
    let fillRects;
    let strokes;
    let texts;
    let ctx;

    beforeEach(() => {
        fillRects = [];
        strokes = [];
        texts = [];
        ctx = {
            save: () => {},
            restore: () => {},
            clearRect: () => {},
            beginPath: () => {},
            arc: () => {},
            clip: () => {},
            fillRect: (...args) => fillRects.push({ fillStyle: ctx.fillStyle, args }),
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }),
            fill: () => {},
            fillText: (...args) => texts.push({ fillStyle: ctx.fillStyle, args }),
            translate: () => {},
            rotate: () => {},
            closePath: () => {},
            set fillStyle(value) { this._fillStyle = value; },
            get fillStyle() { return this._fillStyle; },
            set strokeStyle(value) { this._strokeStyle = value; },
            get strokeStyle() { return this._strokeStyle; },
            set lineWidth(value) { this._lineWidth = value; },
            get lineWidth() { return this._lineWidth; },
            font: '',
            textAlign: '',
            textBaseline: ''
        };

        document.body.innerHTML = '';
        const originalCreateElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement(tagName);
            if (tagName === 'canvas') {
                el.getContext = () => ctx;
            }
            return el;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders dungeon room overlays and objective marker colors', () => {
        const minimap = new Minimap(200);
        minimap.gameEngine = {
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, x: 0, z: 0, width: 40, height: 40, type: 'start', explored: true, cleared: false },
                    { index: 1, x: 50, z: 0, width: 40, height: 40, type: 'normal', explored: true, cleared: true },
                    { index: 2, x: 100, z: 0, width: 40, height: 40, type: 'boss', explored: false, cleared: false }
                ]
            }),
            uiManager: { partyData: { members: [] } }
        };

        minimap.update({ position: { x: 50, z: 0 }, id: 'player-1' }, []);

        expect(fillRects.some((entry) => entry.fillStyle === 'rgba(90, 160, 255, 0.18)')).toBe(true);
        expect(fillRects.some((entry) => entry.fillStyle === 'rgba(120, 255, 160, 0.22)')).toBe(true);
        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(255, 110, 110, 0.95)')).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('Boss'))).toBe(true);
    });

    test('renders boss objective rooms with a distinct boss marker', () => {
        const minimap = new Minimap(200);
        minimap.gameEngine = {
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, x: 0, z: 0, width: 40, height: 40, type: 'start', explored: true, cleared: true },
                    { index: 1, x: 50, z: 0, width: 40, height: 40, type: 'elite', explored: true, cleared: true },
                    { index: 2, x: 100, z: 0, width: 40, height: 40, type: 'boss', explored: true, cleared: false }
                ]
            }),
            uiManager: { partyData: { members: [] } }
        };

        minimap.update({ position: { x: 50, z: 0 }, id: 'player-1' }, []);

        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(255, 110, 110, 0.95)')).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('Boss'))).toBe(true);
    });

    test('renders a distinct exit marker when the dungeon objective is complete', () => {
        const minimap = new Minimap(200);
        minimap.gameEngine = {
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 2,
                objectiveRoomIndex: -1,
                rooms: [
                    { index: 0, x: 0, z: 0, width: 40, height: 40, type: 'start', explored: true, cleared: true },
                    { index: 1, x: 50, z: 0, width: 40, height: 40, type: 'normal', explored: true, cleared: true },
                    { index: 2, x: 100, z: 0, width: 40, height: 40, type: 'boss', explored: true, cleared: true }
                ]
            }),
            uiManager: { partyData: { members: [] } }
        };

        minimap.update({ position: { x: 100, z: 0 }, id: 'player-1' }, []);

        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(120, 220, 255, 0.95)')).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('Exit'))).toBe(true);
    });

    test('renders canonical walk rects and join markers when dungeon debug overlay is enabled', () => {
        const minimap = new Minimap(200);
        minimap.setDungeonDebugOverlayEnabled(true);
        minimap.gameEngine = {
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, x: 0, z: 0, width: 80, height: 80, type: 'start', explored: true, cleared: false },
                    { index: 1, x: 80, z: -120, width: 120, height: 120, type: 'boss', explored: true, cleared: false }
                ]
            }),
            getDungeonDebugOverlayData: () => ({
                walkRects: [
                    { x: 0, z: 0, width: 80, height: 80, kind: 'room' },
                    { x: 0, z: -60, width: 40, height: 40, kind: 'corridor' },
                    { x: 40, z: -60, width: 80, height: 40, kind: 'corridor' },
                    { x: 80, z: -90, width: 40, height: 60, kind: 'corridor' },
                    { x: 80, z: -120, width: 120, height: 120, kind: 'room' }
                ],
                rooms: [
                    { index: 0, x: 0, z: 0, width: 80, height: 80, type: 'start' },
                    { index: 1, x: 80, z: -120, width: 120, height: 120, type: 'boss' }
                ],
                corridors: [
                    { fromRoomIndex: 0, toRoomIndex: 1, walkRectIndices: [1, 2, 3] }
                ]
            }),
            uiManager: { partyData: { members: [] } }
        };

        minimap.update({ position: { x: 0, z: 0 }, id: 'player-1' }, []);

        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(120, 220, 255, 0.72)')).toBe(true);
        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(255, 180, 90, 0.82)')).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('DBG WALK'))).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('J1'))).toBe(true);
    });

    test('highlights risky boss approach segments when the final corridor segment is shorter than half corridor width', () => {
        const minimap = new Minimap(200);
        minimap.setDungeonDebugOverlayEnabled(true);
        minimap.gameEngine = {
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, x: 0, z: 0, width: 100, height: 100, type: 'start', explored: true, cleared: false },
                    { index: 1, x: 80, z: -180, width: 180, height: 180, type: 'boss', explored: true, cleared: false }
                ]
            }),
            getDungeonDebugOverlayData: () => ({
                walkRects: [
                    { x: 0, z: 0, width: 100, height: 100, kind: 'room', roomIndex: 0 },
                    { x: 80, z: -180, width: 180, height: 180, kind: 'room', roomIndex: 1 },
                    { x: 0, z: -60, width: 40, height: 60, kind: 'corridor' },
                    { x: 40, z: -70, width: 120, height: 40, kind: 'corridor' },
                    { x: 80, z: -98, width: 40, height: 16, kind: 'corridor' }
                ],
                rooms: [
                    { index: 0, x: 0, z: 0, width: 100, height: 100, type: 'start' },
                    { index: 1, x: 80, z: -180, width: 180, height: 180, type: 'boss' }
                ],
                corridors: [
                    { fromRoomIndex: 0, toRoomIndex: 1, width: 40, walkRectIndices: [2, 3, 4] }
                ]
            }),
            uiManager: { partyData: { members: [] } }
        };

        minimap.update({ position: { x: 0, z: 0 }, id: 'player-1' }, []);

        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(255, 90, 90, 0.95)')).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('RISK'))).toBe(true);
    });
});
