import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';
import { resolveRemoteSkillVisual } from '../src/skills/skillVisuals.js';

const owned = [];
afterEach(() => { owned.splice(0).forEach(actor => actor.dispose()); jest.restoreAllMocks(); });
function fixture(rank = 5) {
    const source = new Rogue('spiral-owner'), target = new Imp('spiral-enemy'); owned.push(source, target);
    source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
    source.position.set(60000, 40, 60000); source.instanceId = target.instanceId = 'spiral-room';
    Object.assign(source.stats, { mana: 1000, damage: 50, dexterity: 10, critChanceBonus: 0 });
    source.talentRanks = { ROG_34: rank, ROG_09: 5 }; source.unlockedSkills.push('Death Spiral');
    target.position.set(60002, 40, 60000); target.stats.hp = 10000;
    target.bleedStacks = 1; target.bleedTimer = 10; jest.spyOn(target, 'takeDamage');
    const engine = { currentInstanceId: 'spiral-room', currentInstanceType: 'dungeon',
        scene: new THREE.Scene(), chunkManager: { getActiveEntities: () => [target, target] },
        isHostileActorTarget: () => true, spawnTransientEffect: jest.fn(() => true),
        floatingTextManager: { spawn: jest.fn() } };
    return { source, target, engine, cast: () => source.useAbility(new THREE.Vector3(60100, 0, 60100), engine, 'Death Spiral') };
}
test.each([0, 1, 5])('paid rank%s spiral uses the trained planar body-padded circle and consumes only hit bleeds', rank => {
    for (const body of [1.25, 5]) for (const outside of [false, true]) {
        const f = fixture(rank), radius = 4 * (1 + .03 * rank);
        f.target.radius = body; f.target.position.set(60000 + radius + body + (outside ? .01 : -.01), 0, 60000);
        f.cast(); expect(f.source.stats.mana).toBe(965);
        expect(f.target.takeDamage).toHaveBeenCalledTimes(outside ? 0 : 1);
        if (!outside) expect(f.target.takeDamage).toHaveBeenCalledWith(125, f.source);
        expect(f.target.bleedStacks).toBe(outside ? 1 : 0);
        expect(getAbilityAoeRadius('Rogue', 'Death Spiral', f.source)).toBeCloseTo(radius, 8);
        expect(f.engine.spawnTransientEffect.mock.calls.filter(call => call[0] === 'spin')).toHaveLength(1);
    }
});
test.each(['friendly', 'dead', 'inactive', 'other-instance', 'wall', 'remote', 'online', 'mana', 'cooldown'])(
    '%s must not receive predicted damage or lose bleed stacks', excluded => {
        const f = fixture();
        if (excluded === 'friendly') f.engine.isHostileActorTarget = () => false;
        if (excluded === 'dead') f.target.state = 'DEAD';
        if (excluded === 'inactive') f.target.isActive = false;
        if (excluded === 'other-instance') f.target.instanceId = 'different';
        if (excluded === 'remote') f.target.isRemote = true;
        if (excluded === 'online') f.source.isMultiplayer = f.engine.isMultiplayer = true;
        if (excluded === 'mana') f.source.stats.mana = 0;
        if (excluded === 'cooldown') f.source.cooldowns['Death Spiral'] = 10;
        if (excluded === 'wall') f.engine.currentDungeonLayout = { walkRects: [
            { x: 60000, z: 60000, width: 2, height: 4 }, { x: 60002, z: 60000, width: 1, height: 4 }] };
        f.cast(); expect(f.target.takeDamage).not.toHaveBeenCalled(); expect(f.target.bleedStacks).toBe(1);
    });
test('a rank-private observer uses the accepted center and full trained circle', () => {
    const f = fixture(0), origin = new THREE.Vector3(100, 40, 200);
    const visual = resolveRemoteSkillVisual(f.source, 'Death Spiral', origin, { radius: 4.6, arc: 2 * Math.PI });
    expect(visual.layers.find(layer => layer.type === 'spin')).toMatchObject({ origin, radius: 4.6, arc: 2 * Math.PI });
});
