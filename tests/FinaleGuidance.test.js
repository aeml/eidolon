import { readFileSync } from 'node:fs';
import { FINALE_PREPARATION, appendFinaleBriefing, getFinaleExitGuidance } from '../src/ui/FinaleGuidance.js';
import { QuestUI } from '../src/ui/QuestUI.js';

const quest = () => ({ id: 'chronicle_15_dark_king', accepted: true, completed: false, count: 1, maxCount: 1 });

test('ready finale directs a personal claim and rereadable epilogue, never a reward grant', () => {
    const q = quest(), before = JSON.stringify(q);
    const guidance = getFinaleExitGuidance('weekly_raid', [q]);
    expect(guidance.title).toBe('Return to Ilyra in town');
    expect(guidance.hint).toContain('Each character claims personally');
    expect(guidance.sequenceHint).toContain('A Letter Without a Throne');
    expect(JSON.stringify(q)).toBe(before);
    expect(guidance).not.toHaveProperty('rewardXP');
});

test.each([{ completed: true }, { accepted: false }, { count: 0 }, { maxCount: 0 }, { id: 'daily_1' }])(
    'non-ready and repeat-clear state retains ordinary exit guidance: %j', patch => {
        expect(getFinaleExitGuidance('weekly_raid', [{ ...quest(), ...patch }])).toBeNull();
    });

test('town, other instances, absent quests and a live boss never show the finale exit prompt', () => {
    expect(getFinaleExitGuidance('umbral_nexus', [quest()])).toBeNull();
    expect(getFinaleExitGuidance('weekly_raid')).toBeNull();
    const summary = { objectiveRoomIndex: 1, rooms: [{ index: 0, type: 'start' }, { index: 1, type: 'boss', cleared: false }] };
    let instanceId = 'raid';
    const ui = Object.create(QuestUI.prototype);
    ui.ctx = { getCurrentInstanceId: () => instanceId, getCurrentInstanceType: () => 'weekly_raid',
        getDungeonRoomSummary: () => summary, getLastPlayer: () => ({ quests: [quest()] }) };
    expect(ui.buildDungeonRoutingObjective().completed).toBe(false);
    summary.objectiveRoomIndex = -1; summary.rooms[1].cleared = true;
    expect(ui.buildDungeonRoutingObjective()).toMatchObject({ title: 'Return to Ilyra in town', completed: true, rewardXP: 0 });
    instanceId = null;
    expect(ui.buildDungeonRoutingObjective()).toBeNull();
});

test('briefing is opt-in reading with no action and describes actual authoritative aid', () => {
    const host = document.createElement('section');
    const briefing = appendFinaleBriefing(host);
    expect(briefing.open).toBe(false);
    expect(briefing.querySelectorAll('p')).toHaveLength(4);
    expect(briefing.querySelector('button')).toBeNull();
    expect(briefing.textContent).toContain('does not resurrect');
    expect(briefing.textContent).toContain('MEMORY FRACTURE');
    expect(briefing.textContent).toContain('personally click Complete Quest');
    const source = readFileSync('server/internal/game/raid_phases.go', 'utf8');
    for (const amount of ['20%', '25%', '8%', '35%']) {
        expect(source).toContain(amount);
        expect(FINALE_PREPARATION.join(' ')).toContain(amount);
    }
});
