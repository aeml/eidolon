import { createProceduralCrystalSanctum, disposeCrystalSanctum } from '../src/art/ProceduralCrystalSanctums.js';
import { QuestUI } from '../src/ui/QuestUI.js';

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

test('ritual remains the tracked objective after the boss dies, including recovery', () => {
    const summary = { rooms: [{ type: 'boss', cleared: true }], objectiveRoomIndex: -1, crystal: JSON.parse(JSON.stringify(crystal)) };
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => 'raid', getCurrentInstanceType: () => 'air_crystal_raid', getDungeonRoomSummary: () => summary };
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Pass the four winds', completed: false, progressLabel: 'Wave 2/3 · 1/4' });
    summary.crystal.objective.paused = true;
    expect(ui.buildDungeonRoutingObjective().badge).toBe('Regroup');
    summary.crystal.stage = 'restored';
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Return to Lanternhold', completed: true });
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
