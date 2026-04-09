import { jest } from '@jest/globals';
import { QuestUI } from '../src/ui/QuestUI.js';
import { Minimap } from '../src/ui/Minimap.js';

function buildQuestDom() {
    document.body.innerHTML = `
        <div id="quest-window" style="display:none"></div>
        <div id="quest-list"></div>
        <div id="quest-journal" style="display:none"></div>
        <div id="journal-list"></div>
        <div id="objectives-panel" style="display:none"></div>
        <div id="objectives-list"></div>
        <button id="btn-close-quest"></button>
        <button id="btn-close-journal"></button>
    `;
}

describe('Dungeon room hooks', () => {
    test('builds shrine and chest routing objectives from hooked room state', () => {
        buildQuestDom();

        const shrineQuestUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'shrine', explored: true, cleared: false },
                    { index: 2, type: 'normal', explored: false, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'verdant_bastion_catacombs'
        });

        expect(shrineQuestUI.buildObjectiveSummary([])).toEqual([
            expect.objectContaining({
                title: 'Reach the shrine room',
                badge: 'Shrine',
                badgeClass: 'is-shrine',
                routeTone: 'support',
                hint: 'Shrine discovered'
            })
        ]);

        const chestQuestUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] }),
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', explored: true, cleared: true },
                    { index: 2, type: 'normal', hook: 'chest', explored: true, cleared: false },
                    { index: 3, type: 'normal', explored: false, cleared: false },
                    { index: 4, type: 'boss', explored: false, cleared: false }
                ]
            }),
            getCurrentInstanceId: () => 'instance-1',
            getCurrentInstanceType: () => 'tempest_spire'
        });

        expect(chestQuestUI.buildObjectiveSummary([])).toEqual([
            expect.objectContaining({
                title: 'Secure the treasure room',
                badge: 'Chest',
                badgeClass: 'is-chest',
                routeTone: 'support',
                hint: 'Treasure room discovered',
                sequenceHint: 'Route: Chest -> Boss'
            })
        ]);
    });

    test('renders shrine, chest, and ambush markers with distinct labels', () => {
        const fillRects = [];
        const strokes = [];
        const texts = [];
        const ctx = {
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

        const minimap = new Minimap(200);
        minimap.gameEngine = {
            getDungeonRoomSummary: () => ({
                currentRoomIndex: 1,
                objectiveRoomIndex: 3,
                rooms: [
                    { index: 0, x: 0, z: 0, width: 40, height: 40, type: 'start', explored: true, cleared: true },
                    { index: 1, x: 50, z: 0, width: 40, height: 40, type: 'normal', hook: 'shrine', explored: true, cleared: true },
                    { index: 2, x: 100, z: 0, width: 40, height: 40, type: 'normal', hook: 'chest', explored: true, cleared: false },
                    { index: 3, x: 150, z: 0, width: 40, height: 40, type: 'elite', hook: 'elite_ambush', explored: true, cleared: false },
                    { index: 4, x: 200, z: 0, width: 40, height: 40, type: 'boss', explored: false, cleared: false }
                ]
            }),
            uiManager: { partyData: { members: [] } }
        };

        minimap.update({ position: { x: 50, z: 0 }, id: 'player-1' }, []);

        expect(fillRects.some((entry) => entry.fillStyle === 'rgba(120, 255, 220, 0.18)')).toBe(true);
        expect(fillRects.some((entry) => entry.fillStyle === 'rgba(255, 220, 120, 0.12)')).toBe(true);
        expect(strokes.some((entry) => entry.strokeStyle === 'rgba(255, 145, 90, 0.95)')).toBe(true);
        expect(texts.some((entry) => String(entry.args[0]).includes('Ambush'))).toBe(true);
    });
});