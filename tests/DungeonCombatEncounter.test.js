import { dungeonBossEncounter } from './dungeonCombatEncounter.js';
import { planRangedHuntStep, retreatStaysInEncounter } from './wizardHuntControls.js';

const room = { x: 20000, z: 19460, width: 120, height: 120, type: 'boss' };
const layout = { rooms: [{ x: 20000, z: 19820, width: 100, height: 100, type: 'normal' }, room,
    { x: 20000, z: 18920, width: 120, height: 120, type: 'boss' }] };
const bosses = ['RootboundWarden', 'BriarMatron'];

test('boss identities map to fixed authored rooms, not current enemy positions', () => {
    const before = JSON.stringify(layout);
    expect(dungeonBossEncounter(layout, bosses, 'RootboundWarden')).toEqual({ x: 20000, z: 19460, width: 120, height: 120 });
    expect(dungeonBossEncounter(layout, bosses, 'BriarMatron').z).toBe(18920);
    expect(dungeonBossEncounter(layout, bosses, 'DemonOrc')).toBeUndefined();
    expect(JSON.stringify(layout)).toBe(before);
});
test('a known boss without valid room geometry cannot silently fall back to unbounded movement', () => {
    expect(() => dungeonBossEncounter({ rooms: [] }, bosses, 'RootboundWarden')).toThrow('Missing valid boss room');
});
test('recorded failed death position lies outside the Warden encounter, with a full body margin', () => {
    const encounter = dungeonBossEncounter(layout, bosses, 'RootboundWarden');
    expect(retreatStaysInEncounter(encounter, { x: 20035.233783749074, z: 19771.176993562265 })).toBe(false);
    expect(retreatStaysInEncounter(encounter, { x: 20058.75, z: 19460 })).toBe(true);
    expect(retreatStaysInEncounter(encounter, { x: 20059, z: 19460 })).toBe(false);
});
test.each(['Wizard', 'Rogue'])('%s retreats within the boss room instead of down a connected corridor', className => {
    const encounter = dungeonBossEncounter(layout, bosses, 'RootboundWarden');
    const state = { className, x: 20000, z: 19518, radius: 1.25, healthRatio: 1, mana: 0,
        threats: [{ x: 20000, z: 19510, meleeReach: 7.5 }],
        walkRects: [{ ...room }, { x: 20000, z: 19560, width: 40, height: 120 }] };
    const unbounded = planRangedHuntStep(state);
    expect(unbounded.z).toBeGreaterThan(8);
    const bounded = planRangedHuntStep({ ...state, encounter });
    expect(bounded?.action).toBe('retreat');
    expect(retreatStaysInEncounter(encounter, { x: state.x + bounded.x, z: state.z + bounded.z })).toBe(true);
    expect(Math.hypot(bounded.x, bounded.z)).toBeCloseTo(9);
    expect(planRangedHuntStep({ ...state, encounter, canRetreat: () => false })).toBeNull();
});
test('existing circular contexts and absent contexts retain their meaning', () => {
    expect(retreatStaysInEncounter({ x: 0, z: 0, radius: 5 }, { x: 3, z: 4 })).toBe(true);
    expect(retreatStaysInEncounter({ x: 0, z: 0, radius: 5 }, { x: 4, z: 4 })).toBe(false);
    expect(retreatStaysInEncounter(undefined, { x: 100, z: 100 })).toBe(true);
});
