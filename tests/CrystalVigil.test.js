import { createProceduralCrystalSanctum, disposeCrystalSanctum } from '../src/art/ProceduralCrystalSanctums.js';
import { QuestUI } from '../src/ui/QuestUI.js';
import { jest } from '@jest/globals';
import { installGameEngineNetworkMessages } from '../src/core/GameEngineNetworkMessages.js';

const crystal = {
    stage: 'repairing', raidType: 'air_crystal_raid', name: 'Skyglass Crystal', wave: 2,
    progress: 33, x: 110000, z: 19280,
    objective: {
        title: 'Pass the four winds', hint: 'A different raider must touch the next anchor.',
        current: 1, total: 4, paused: false,
        points: [
            { x: 110030, z: 19280, radius: 6, label: 'Wind anchor 1', state: 'complete' },
            { x: 110000, z: 19310, radius: 6, label: 'Wind anchor 2', state: 'active' }
        ]
    }
};

test('multi-circle boss pattern shows every footprint with only one movement callout', () => {
    class Harness {}
    installGameEngineNetworkMessages(Harness);
    const engine = new Harness();
    engine.player = { id: 'prepared-party-member' };
    engine.spawnTransientEffect = jest.fn();
    engine.uiManager = { showCombatCallout: jest.fn() };
    for (let index = 0; index < 3; index++) {
        engine.handleServerMessage({ type: 'telegraph', payload: { x: index * 10, z: 0, radius: 6, duration: 2, label: 'ROOT QUAKE', hint: 'Step sideways.', silent: index > 0 } });
    }
    expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(3);
    expect(engine.uiManager.showCombatCallout).toHaveBeenCalledTimes(1);
    expect(engine.uiManager.showCombatCallout.mock.calls[0][0].subtitle).toBe('Step sideways.');
});

test('ritual remains the tracked objective after the boss dies, including recovery', () => {
    const summary = { rooms: [{ type: 'boss', cleared: true }], objectiveRoomIndex: -1, crystal: JSON.parse(JSON.stringify(crystal)) };
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => 'raid', getCurrentInstanceType: () => 'air_crystal_raid', getDungeonRoomSummary: () => summary };
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Pass the four winds', completed: false, progressLabel: 'Wave 2/3 · 1/4' });
    summary.crystal.objective.paused = true;
    expect(ui.buildDungeonRoutingObjective().badge).toBe('Regroup');
    summary.crystal.stage = 'restored';
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Return to Ilyra in town', completed: true });
});

test.each(['earth', 'water', 'fire', 'air'])('%s never tells a cleared assault to leave before its Vigil', realm => {
    const summary = { rooms: [{ index: 0, type: 'start' }, { index: 1, type: 'boss', cleared: true }],
        objectiveRoomIndex: -1, crystal: { stage: 'fractured', wave: 0 } };
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => 'raid', getCurrentInstanceType: () => `${realm}_crystal_raid`,
        getDungeonRoomSummary: () => summary };
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Stay for Maelin’s Vigil', completed: false,
        progressLabel: 'Guardian defeated · repair pending', progressPct: 0 });
    expect(ui.buildDungeonRoutingObjective().hint).toContain('not restored');
    summary.crystal.stage = 'repairing';
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ completed: false, progressLabel: 'Preparing the Vigil' });
    summary.crystal.stage = 'restored';
    const ready = ui.buildDungeonRoutingObjective();
    // Phones hide both hint lines: the compact title must identify Ilyra too.
    expect(ready).toMatchObject({ title: 'Return to Ilyra in town', completed: true, progressPct: 100 });
    expect(ready.hint).toContain('speak to Ilyra');
    expect(ready.hint).toContain('Complete Quest');
    expect(ready.sequenceHint).toContain('click Complete Quest');
    expect(ready.sequenceHint).toContain('Every character must claim their own quest');
});

test('ordinary completed dungeons retain their loot exit guidance', () => {
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => 'dungeon', getCurrentInstanceType: () => 'tempest_spire',
        getDungeonRoomSummary: () => ({ rooms: [{ type: 'boss', cleared: true }], objectiveRoomIndex: -1 }) };
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Return to Lanternhold', completed: true });
    expect(ui.buildDungeonRoutingObjective().hint).toContain('leave with your loot');
});

test('town recovery and re-entry use the current repair snapshot without premature completion', () => {
    let instanceId = 'raid';
    const summary = { rooms: [{ index: 0, type: 'start' }, { index: 1, type: 'boss', cleared: false }],
        objectiveRoomIndex: 1, crystal: { stage: 'fractured', wave: 0 } };
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => instanceId, getCurrentInstanceType: () => 'air_crystal_raid',
        getDungeonRoomSummary: () => summary };
    const assault = ui.buildDungeonRoutingObjective();
    expect(assault.completed).toBe(false);
    expect(assault.id).toBe('dungeon-route-air_crystal_raid');
    summary.rooms[1].cleared = true;
    summary.objectiveRoomIndex = -1;
    summary.crystal = JSON.parse(JSON.stringify(crystal));
    summary.crystal.objective.paused = true;
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ badge: 'Regroup', completed: false });
    instanceId = null;
    expect(ui.buildDungeonRoutingObjective()).toBeNull();
    instanceId = 'raid';
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ badge: 'Regroup', completed: false });
    summary.crystal.objective.paused = false;
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ badge: 'Crystal Vigil', completed: false,
        progressLabel: 'Wave 2/3 · 1/4' });
    // A restarted partial repair can legitimately return a fractured snapshot.
    summary.crystal = { stage: 'fractured', wave: 0 };
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Stay for Maelin’s Vigil', completed: false });
});

test('markers use exact server footprints, ordered pips, low-quality visibility and no collisions', () => {
    const root = createProceduralCrystalSanctum('air_crystal_raid');
    root.applySnapshot(crystal);
    root.animate(1, 'low');
    const first = root.getObjectByName('VigilMarker:1');
    const next = root.getObjectByName('VigilMarker:2');
    expect(first.position.x).toBe(30);
    expect(next.position.z).toBe(30);
    expect(next.getObjectByName('VigilFootprint').scale.x).toBe(6);
    expect(next.userData.label).toBe('Wind anchor 2');
    expect(next.children.filter(child => child.name.startsWith('StepPip') && child.visible)).toHaveLength(2);
    expect(first.getObjectByName('StepPip:0').visible).toBe(false);
    expect(next.visible).toBe(true);
    const hits = [];
    next.traverse(child => { if (child.isMesh) child.raycast({}, hits); });
    expect(hits).toEqual([]);
    root.applySnapshot({ ...crystal, stage: 'restored' });
    expect(next.visible).toBe(false);
    disposeCrystalSanctum(root);
});

test('missing or invalid marker snapshots never leave a stale target visible', () => {
    const root = createProceduralCrystalSanctum('air_crystal_raid');
    root.applySnapshot(crystal);
    root.applySnapshot({ ...crystal, objective: { points: [{ x: NaN, z: 0, radius: 6 }] } });
    expect(root.getObjectByName('VigilMarker:1').visible).toBe(false);
    expect(root.getObjectByName('VigilMarker:2').visible).toBe(false);
    root.applySnapshot({ stage: 'repairing' });
    expect(root.getObjectByName('VigilMarker:1').visible).toBe(false);
    disposeCrystalSanctum(root);
});
