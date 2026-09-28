import { readFileSync } from 'node:fs';
import { getAtlasQuestLocations } from '../src/ui/AtlasQuestMarkers.js';
import { QuestUI } from '../src/ui/QuestUI.js';
import { NEXUS_PREPARATION } from '../src/ui/DungeonPreparation.js';
import { TOWN_SERVICE_POINTS } from '../src/ui/townServiceConfig.js';

test.each([['chronicle_14_resonance_gate', 'EidolonDevourer'], ['chronicle_15_dark_king', 'UmbraPrime']])(
    '%s distinguishes private admission from the shared expedition portal', (id, target) => {
        const q = { id, target, type: 'KILL', accepted: true, count: 0, maxCount: 1 };
        const engine = { player: { quests: [q] }, currentInstanceId: '', currentInstanceType: 'overworld' };
        const guide = TOWN_SERVICE_POINTS.find(p => p.id === 'dungeon-guide');
        expect(getAtlasQuestLocations(engine)[0]).toMatchObject({ x: guide.x, z: guide.z,
            availability: 'Tracked · private encounter admission' });
        expect(getAtlasQuestLocations(engine)[0].purpose).toContain('not this private encounter');
        engine.currentInstanceId = 'dark-realm'; engine.currentInstanceType = 'dark_realm';
        const returnTrip = getAtlasQuestLocations(engine)[0];
        expect(returnTrip).toMatchObject({ x: 40012, z: 40800, instanceId: 'dark-realm' });
        expect(returnTrip.purpose).toContain('recovery camp, not a dungeon entrance');
        expect(returnTrip.purpose).toContain('Return to Lanternhold');
        q.count = 1;
        expect(getAtlasQuestLocations(engine)[0]).toMatchObject({ symbol: '?', x: 40012, z: 40800 });
        expect(getAtlasQuestLocations(engine)[0].purpose).toContain('Complete Quest');
        engine.currentInstanceId = 'private-nexus'; engine.currentInstanceType = 'umbral_nexus';
        expect(getAtlasQuestLocations(engine)).toEqual([]);
        q.completed = true;
        engine.currentInstanceId = ''; engine.currentInstanceType = 'overworld';
        expect(getAtlasQuestLocations(engine)).toEqual([]);
    });

test('Nexus completion names Ilyra even in compact tracking, without claiming a reward or opening the court', () => {
    const summary = { objectiveRoomIndex: 3, rooms: [{ index: 0, type: 'start' },
        ...[1, 2, 3].map(index => ({ index, type: 'boss', cleared: index < 3 }))] };
    let instanceId = 'nexus';
    const storyQuest = { id: 'chronicle_14_resonance_gate', accepted: true, completed: false };
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => instanceId, getCurrentInstanceType: () => 'umbral_nexus',
        getDungeonRoomSummary: () => summary, getLastPlayer: () => ({ quests: [storyQuest] }) };
    expect(ui.buildDungeonRoutingObjective().completed).toBe(false);
    instanceId = null; expect(ui.buildDungeonRoutingObjective()).toBeNull();
    instanceId = 'nexus'; expect(ui.buildDungeonRoutingObjective().completed).toBe(false);
    summary.rooms[3].cleared = true; summary.objectiveRoomIndex = -1;
    const exit = ui.buildDungeonRoutingObjective();
    expect(exit).toMatchObject({ title: 'Return to Ilyra in town', completed: true, rewardXP: 0 });
    expect(exit.hint).toContain('Each character claims personally');
    expect(exit.hint).toContain('boss loot does not unlock');
    expect(exit.sequenceHint).toContain('After your personal claim');
    storyQuest.completed = true;
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Return to Lanternhold', completed: true });
    expect(ui.buildDungeonRoutingObjective().hint).toContain('leave with your loot');
});

test('Nexus briefing follows the authoritative guardian order and actual warning', () => {
    const source = readFileSync('server/internal/game/dungeon_runtime.go', 'utf8');
    expect(source).toContain('bosses := []string{"DissonantHerald", "NullArchitect", "EidolonDevourer"}');
    expect(NEXUS_PREPARATION[0]).toContain('Dissonant Herald → Null Architect → Eidolon Devourer');
    const warnings = readFileSync('server/internal/game/dungeon_telegraphs.go', 'utf8');
    expect(warnings).toContain('Label: "MEMORY FRACTURE"');
    expect(warnings).toContain('Leave the marked circle before impact.');
    expect(NEXUS_PREPARATION[1]).toContain('leave the marked circle before impact');
    expect(NEXUS_PREPARATION[2]).toContain('click Complete Quest');
    expect(NEXUS_PREPARATION[2]).toContain('latest cleared boss checkpoint');
});
