import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Fighter } from '../src/entities/Fighter.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { AbilityController } from '../src/core/AbilityController.js';

const owned = [];
const cases = [
    { skill: 'Shield Slam', technique: 'FTR_06', mastery: 'FTR_05', base: 4, arc: Math.PI / 2, mana: 25, damage: 65 },
    { skill: 'Sweeping Strike', technique: 'FTR_12', mastery: 'FTR_11', base: 5, arc: Math.PI, mana: 30, damage: 62 }
];
function fixture(entry, rank = 0, generic = 0) {
    const p = new Fighter('cone-caster'); owned.push(p); p.mesh = new THREE.Group();
    p.position.set(50000, 40, 50000);
    Object.assign(p.stats, { damage: 50, strength: 10, mana: 200 });
    p.unlockedSkills.push(entry.skill);
    p.talentRanks = { [entry.technique]: rank, [entry.mastery]: rank, FTR_33: generic, FTR_38: generic };
    const entities = [];
    const engine = { currentInstanceId: 'cone-dungeon', currentInstanceType: 'dungeon',
        chunkManager: { getActiveEntities: () => entities }, spawnTransientEffect: jest.fn(() => true),
        floatingTextManager: { spawn: jest.fn() }, isHostileActorTarget: target => target.hostile };
    const add = (id, dx, dz) => {
        const target = new Actor(id, {}); owned.push(target); entities.push(target);
        target.position.set(p.position.x+dx, 0, p.position.z+dz);
        target.radius = .5; target.stats.hp = target.stats.maxHp = 1000; target.hostile = true;
        jest.spyOn(target, 'takeDamage'); return target;
    };
    const cast = () => p.useAbility(new THREE.Vector3(p.position.x, 0, p.position.z+10), engine, entry.skill);
    return { p, engine, add, cast };
}
afterEach(() => { for (const actor of owned.splice(0)) actor.dispose(); jest.restoreAllMocks(); });

describe.each(cases)('$skill trained cone', entry => {
    test('named and generic damage training enters the ordinary critical step once', () => {
        const f = fixture(entry, 5, 5), target = f.add('critical-target', 0, 1);
        f.p.stats.critChanceBonus = 1;
        f.cast();
        expect(target.takeDamage).toHaveBeenCalledTimes(1);
        expect(target.stats.hp).toBe(1000 - 2 * Math.floor(entry.damage * 1.3 + 1e-9));
    });

    test('trained cone retains angular limits, friendly/instance isolation and one hit per actor', () => {
        const f = fixture(entry, 5, 5), angle = entry.arc / 2;
        const inside = f.add('inside-angle', Math.sin(angle-.001)*3, Math.cos(angle-.001)*3);
        const outside = f.add('outside-angle', Math.sin(angle+.001)*3, Math.cos(angle+.001)*3);
        const ally = f.add('ally', 0, 1), other = f.add('other-scene', 0, 1);
        const dead = f.add('dead', 0, 1), remote = f.add('remote', 0, 1), inactive = f.add('inactive', 0, 1);
        ally.hostile = false; other.instanceId = 'other'; dead.state = 'DEAD'; remote.isRemote = true; inactive.isActive = false;
        f.engine.chunkManager.getActiveEntities().push(inside);
        f.cast();
        expect(inside.takeDamage).toHaveBeenCalledTimes(1);
        for (const target of [outside, ally, other, dead, remote, inactive]) expect(target.takeDamage).not.toHaveBeenCalled();
    });

    test.each([false, true])('trained cone preserves wall/doorway admission, doorway=%s', doorway => {
        const f = fixture(entry, 5, 5), target = f.add('across-wall', 0, 2);
        f.engine.currentDungeonLayout = { walkRects: [
            { x: 50000, z: 49991, width: 20, height: 20 },
            { x: 50000, z: 50011.5, width: 20, height: 20 },
            ...(doorway ? [{ x: 50000, z: 50001, width: 4, height: 5 }] : [])
        ] };
        f.cast(); expect(target.takeDamage).toHaveBeenCalledTimes(doorway ? 1 : 0);
    });

    test.each(['mana', 'cooldown', 'online'])('%s never executes offline trained damage', reason => {
        const f = fixture(entry, 5, 5), target = f.add('no-hit', 0, 1);
        if (reason === 'mana') f.p.stats.mana = 0;
        if (reason === 'cooldown') f.p.cooldowns[entry.skill] = 100;
        if (reason === 'online') { f.p.isMultiplayer = true; f.engine.isMultiplayer = true; }
        f.cast(); expect(target.takeDamage).not.toHaveBeenCalled();
    });

    test.each([0, 1, 5].flatMap(rank => [0, 5].map(generic => ({ rank, generic }))))('paid planar edge rank$rank generic$generic', ({ rank, generic }) => {
        const f = fixture(entry, rank, generic), radius = entry.base * (1 + .02 * rank + .05 * generic);
        const edge = f.add('edge', 0, radius+.5-.001), outside = f.add('outside', 0, radius+.5+.001);
        const center = f.add('center', 0, 1), behind = f.add('behind', 0, -1);
        f.cast();
        expect(f.p.stats.mana).toBe(200-entry.mana);
        const expected = Math.floor(entry.damage*(1+.04*rank+.02*generic)+1e-9);
        for (const target of [edge, center]) {
            expect(target.takeDamage).toHaveBeenCalledTimes(1);
            expect(target.stats.hp).toBe(1000-expected);
        }
        for (const target of [outside, behind]) expect(target.takeDamage).not.toHaveBeenCalled();
        const shape = f.engine.spawnTransientEffect.mock.calls.find(call => call[3]?.abilityName === entry.skill);
        expect(shape[3].radius).toBeCloseTo(radius, 8); expect(shape[3].arc).toBeCloseTo(entry.arc, 8);
    });

    test.each(['high', 'low'])('%s owner and rank-private observer use matching trained cone geometry', quality => {
        const f = fixture(entry, 5, 5), radius = entry.base*1.35;
        for (const remote of [false, true]) {
            const actor = remote ? { id: 'remote-cone', meshType: 'Fighter', position: f.p.position.clone(), mesh: new THREE.Group() } : f.p;
            const engine = { effects: [], player: actor, uiManager: { getGraphicsQuality: () => quality },
                renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
                spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
            try {
                const aim = actor.position.clone().add(new THREE.Vector3(0, 0, 10));
                if (remote) new AbilityController(engine).triggerRemoteAbilityVisuals(actor, entry.skill, aim.x, aim.z, { radius, arc: entry.arc });
                else Actor.prototype.spawnAbilityPresentation.call(actor, engine, entry.skill, aim);
                const shapes = engine.effects.filter(effect => effect.abilityShape);
                expect(shapes).toHaveLength(1); expect(shapes[0].abilityShape.radius).toBeCloseTo(radius, 8);
                expect(shapes[0].abilityShape.arc).toBeCloseTo(entry.arc, 8);
                expect(shapes[0].root.userData.gameplayRadius).toBeCloseTo(radius, 8);
                expect(shapes[0].root.parent).toBe(engine.renderSystem.effectGroup);
                const boundary = shapes[0].root.children.find(child => child.userData.gameplayBoundary);
                expect(boundary).toBeDefined();
                expect(boundary.userData.gameplayRadius).toBeCloseTo(radius, 8);
            } finally { engine.effects.forEach(effect => effect.dispose()); }
        }
    });

    test('accepted cone replaces a stale radius once without replaying local animation', () => {
        const f = fixture(entry), p = f.p;
        p.playAbilityAnimation = jest.fn();
        const engine = { effects: [], player: p, renderSystem: { effectGroup: new THREE.Group(), getEffectQualityScale: () => 1 },
            spawnTransientEffect: GameEngine.prototype.spawnTransientEffect };
        const controller = new AbilityController(engine), radius = entry.base*1.35;
        Actor.prototype.spawnAbilityPresentation.call(p, engine, entry.skill, p.position.clone().add(new THREE.Vector3(0, 0, 5)));
        const original = engine.effects.find(effect => effect.abilityShape);
        const accepted = { skillName: entry.skill, targetX: p.position.x, targetZ: p.position.z+5, radius, arc: entry.arc };
        try {
            controller.reconcileLocalAbilityShape(accepted);
            expect(original.isActive).toBe(false);
            const current = engine.effects.filter(effect => effect.isActive && effect.abilityShape);
            expect(current).toHaveLength(1); expect(current[0].abilityShape).toMatchObject({ radius, authoritative: true });
            controller.reconcileLocalAbilityShape(accepted);
            expect(engine.effects.filter(effect => effect.isActive && effect.abilityShape)).toEqual(current);
            expect(p.playAbilityAnimation).not.toHaveBeenCalled();
        } finally { engine.effects.forEach(effect => effect.dispose()); }
    });
});
