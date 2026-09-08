import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { isEarnedRetreatPathClear, planWizardCrowdControl, planWizardHuntStep, planWizardTravelDefense } from './wizardHuntControls.js';

const state = { className: 'Wizard', dead: false, x: 0, z: 0, healthRatio: 0.7,
    shieldHP: 0, mana: 50, shieldCost: 40, hotbar: ['Teleport', 'Arcane Shield'],
    cooldowns: {}, unlockedSkills: ['Teleport', 'Arcane Shield'], sinceCastMs: 1000, threats: [{ x: 3, z: 0 }] };

const crowd = { ...state, mana: 100, wellCost: 60, hotbar: ['Teleport', 'Arcane Shield', 'Gravity Well'],
    unlockedSkills: ['Gravity Well'], threats: [{ x: 5, z: 0 }, { x: 6, z: 0 }, { x: 7, z: 0 }] };

test('earned west-wall replay rejects blocked full paths without moving the player', () => {
    const manager = new CollisionManager();
    manager.addCollider(new THREE.Box3(new THREE.Vector3(-102, -5, 200), new THREE.Vector3(-98, 20, 300)));
    const position = new THREE.Vector3(-105.55617685, 0, 269.11594458);
    const original = position.clone();
    const canRetreat = delta => isEarnedRetreatPathClear(manager, position, 1.25, delta);
    expect(canRetreat({ x: 7.0513, z: -5.5927 })).toBe(false);
    // An endpoint outside the wall is insufficient: the segment crosses it.
    expect(canRetreat({ x: 12.022655, z: .675 })).toBe(false);
    const plan = planWizardHuntStep({ ...state, healthRatio: 1,
        x: position.x, z: position.z, canRetreat,
        threats: [{ x: position.x - 3, z: position.z }] });
    expect(plan.action).toBe('retreat');
    expect(canRetreat(plan)).toBe(true);
    expect(Math.hypot(plan.x, plan.z)).toBeCloseTo(9);
    expect(position.equals(original)).toBe(true);
    expect(planWizardHuntStep({ ...state, healthRatio: 1, canRetreat: () => false })).toBeNull();
});

test('retreat queries honor circular and rotated building collision too', () => {
    const manager = new CollisionManager();
    const position = new THREE.Vector3(0, 0, 0);
    manager.addCircularCollider(4, 0, 1);
    expect(isEarnedRetreatPathClear(manager, position, 1.25, { x: 9, z: 0 })).toBe(false);
    expect(isEarnedRetreatPathClear(manager, position, 1.25, { x: 0, z: 9 })).toBe(true);
    manager.clear();
    const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 4);
    matrix.setPosition(4, 0, 0);
    manager.addOrientedCollider({ matrix, inverse: matrix.clone().invert(),
        box: new THREE.Box3(new THREE.Vector3(-1, -5, -4), new THREE.Vector3(1, 5, 4)) });
    expect(isEarnedRetreatPathClear(manager, position, 1.25, { x: 9, z: 0 })).toBe(false);
});

test('travel does not repeatedly clear mobs or retreat off-route while healthy', () => {
    expect(planWizardTravelDefense({ ...state, healthRatio: 1 })).toBeNull();
    expect(planWizardTravelDefense({ ...state, healthRatio: .5, shieldHP: 100 })).toBeNull();
    expect(planWizardTravelDefense(state)).toEqual({ action: 'shield', key: '2' });
    expect(planWizardTravelDefense({ ...state, healthRatio: .3, mana: 0 })).toEqual({ action: 'fight' });
    expect(planWizardTravelDefense({ ...state, healthRatio: .3 })).toEqual({ action: 'shield', key: '2' });
    expect(planWizardTravelDefense({ ...state, healthRatio: .3, dead: true })).toBeNull();
    expect(planWizardTravelDefense({ ...state, healthRatio: .3, threats: [] })).toBeNull();
});

test('prepared crowd control uses the actual unlocked hotbar and an in-range cluster', () => {
    expect(planWizardCrowdControl(crowd)).toEqual({ action: 'gravity-well', key: '3', x: 6, z: 0 });
    expect(planWizardCrowdControl({ ...crowd, hotbar: ['Gravity Well'] }).key).toBe('1');
});

test.each([{ dead: true }, { className: 'Fighter' }, { mana: 59 }, { sinceCastMs: 200 },
    { cooldowns: { 'Gravity Well': 1 } }, { hotbar: [] }, { unlockedSkills: [] },
    { hotbar: ['', '', '', '', 'Gravity Well'] }, { threats: [{ x: 4, z: 0 }] },
    { threats: [{ x: 4, z: 0 }, { x: -4, z: 0 }, { x: 0, z: 12 }] },
    { threats: [{ x: 30, z: 0 }, { x: 31, z: 0 }, { x: 32, z: 0 }] }])(
    'does not invent unavailable or unsuitable crowd control: %j', change => {
        expect(planWizardCrowdControl({ ...crowd, ...change })).toBeNull();
    });

test('uses the available shield through its actual hotbar key', () => {
    expect(planWizardHuntStep(state)).toEqual({ action: 'shield', key: '2' });
    expect(planWizardHuntStep({ ...state, hotbar: ['Arcane Shield'] })).toEqual({ action: 'shield', key: '1' });
});
test.each([{ mana: 39 }, { shieldHP: 10 }, { cooldowns: { 'Arcane Shield': 2 } },
    { sinceCastMs: 200 }, { hotbar: [] }, { unlockedSkills: ['Teleport'] }, { healthRatio: 1 }])('retreats instead of an unavailable/redundant shield: %j', change => {
    const plan = planWizardHuntStep({ ...state, ...change });
    expect(plan.action).toBe('retreat');
    expect(plan.x).toBeLessThan(-8);
    expect(Math.hypot(plan.x, plan.z)).toBeCloseTo(9);
});
test('does not walk directly into a second nearby enemy', () => {
    const plan = planWizardHuntStep({ ...state, healthRatio: 1, threats: [{ x: 3, z: 0 }, { x: -8, z: 0 }] });
    expect(Math.abs(plan.z)).toBeGreaterThan(6);
});
test.each([{ dead: true }, { className: 'Fighter' }, { threats: [] }, { threats: [{ x: 12, z: 0 }] }])(
    'leaves ordinary combat alone when no defensive action is needed: %j', change => {
        expect(planWizardHuntStep({ ...state, ...change })).toBeNull();
    });

test('earned Verdant corner replay selects a full nine-unit retreat inside the floor', () => {
    // Generator 2, seed 610775016641147330: failed run's room 8 and position.
    const corner = { ...state, healthRatio: 1, x: 19956.91379991249, z: 18511.25,
        radius: 1.25, walkRects: [{ x: 20005.66379991249, z: 18560, width: 100, height: 100 }],
        threats: [{ x: 19958.50390625, z: 18513.57421875 }, { x: 19958.71484375, z: 18513.615234375 }] };
    const plan = planWizardHuntStep(corner);
    expect(plan?.action).toBe('retreat');
    expect(plan.x).toBeGreaterThanOrEqual(-1e-8);
    expect(plan.z).toBeGreaterThanOrEqual(-1e-8);
    expect(Math.hypot(plan.x, plan.z)).toBeCloseTo(9);
});

test('does not pretend a nine-unit retreat fits inside a tiny enclosed floor', () => {
    expect(planWizardHuntStep({ ...state, healthRatio: 1, radius: 1.25,
        walkRects: [{ x: 0, z: 0, width: 8, height: 8 }] })).toBeNull();
});

test('does not choose a reachable-looking endpoint across a floor gap', () => {
    const plan = planWizardHuntStep({ ...state, healthRatio: 1, radius: 1.25,
        walkRects: [{ x: 0, z: 0, width: 8, height: 8 }, { x: -9, z: 0, width: 8, height: 8 }] });
    expect(plan).toBeNull();
});

test('objective combat retreats stay near the anchor rather than chasing new crowds across Fire', () => {
    const encounter = { x: -1192, z: 145, radius: 32 };
    const player = { ...state, healthRatio: 1, x: -1221, z: 145, encounter,
        threats: [{ x: -1218, z: 145 }] };
    const unconstrained = planWizardHuntStep({ ...player, encounter: undefined });
    expect(Math.hypot(player.x + unconstrained.x - encounter.x,
        player.z + unconstrained.z - encounter.z)).toBeGreaterThan(32);
    const bounded = planWizardHuntStep(player);
    expect(bounded.action).toBe('retreat');
    expect(Math.hypot(player.x + bounded.x - encounter.x,
        player.z + bounded.z - encounter.z)).toBeLessThanOrEqual(32);
    expect(Math.hypot(bounded.x, bounded.z)).toBeCloseTo(9);
});

test('objective bounds do not pretend a retreat exists or override dungeon collision planning', () => {
    expect(planWizardHuntStep({ ...state, healthRatio: 1, encounter: { x: 0, z: 0, radius: 2 } })).toBeNull();
    expect(planWizardHuntStep({ ...state, healthRatio: 1, encounter: { x: 0, z: 0, radius: 32 },
        radius: 1.25, walkRects: [{ x: 0, z: 0, width: 8, height: 8 }] })).toBeNull();
});
