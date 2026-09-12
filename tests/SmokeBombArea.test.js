import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';
import { getAbilityAoeRadius } from '../src/skills/abilityRadii.js';
import { resolveRemoteSkillVisual } from '../src/skills/skillVisuals.js';

afterEach(() => jest.restoreAllMocks());

test.each([0, 1, 5])('paid Smoke Bomb rank %s matches its planar, body-padded radius', rank => {
    for (const radius of [1.25, 5]) for (const outside of [false, true]) {
        const source = new Rogue('smoke-source'), target = new Imp('smoke-target');
        try {
            source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
            source.position.set(60000, 40, 60000);
            source.talentRanks = { ROG_34: rank }; source.unlockedSkills.push('Smoke Bomb');
            source.stats.mana = 1000;
            target.radius = radius; target.position.set(60000 + 5 * (1 + .03 * rank) + radius + (outside ? .01 : -.01), 0, 60000);
            const engine = { isMultiplayer: false, scene: new THREE.Scene(),
                chunkManager: { getActiveEntities: () => [target] },
                floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
                isHostileActorTarget: entity => entity === target };
            source.useAbility(new THREE.Vector3(60100, 0, 60100), engine, 'Smoke Bomb');
            expect(source.stats.mana).toBe(965);
            expect(target.accuracyReductionTimer > 0).toBe(!outside);
            expect(target.slowTimer > 0).toBe(!outside);
            expect(getAbilityAoeRadius('Rogue', 'Smoke Bomb', source)).toBeCloseTo(5 * (1 + .03 * rank), 8);
        } finally { source.dispose(); target.dispose(); }
    }
});

test.each(['friendly', 'dead', 'other-instance', 'wall', 'immune'])('Smoke Bomb respects %s without altering control strength', exclusion => {
    const source = new Rogue('smoke-source'), target = new Imp('smoke-target');
    try {
        source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
        source.stats.mana = 1000; source.unlockedSkills.push('Smoke Bomb');
        source.talentRanks = { ROG_34: 5, ROG_28: 5 }; source.instanceId = 'room';
        target.position.set(4, 0, 0); target.instanceId = exclusion === 'other-instance' ? 'elsewhere' : 'room';
        if (exclusion === 'dead') target.state = 'DEAD';
        if (exclusion === 'immune') target.ccImmune = true;
        const engine = { isMultiplayer: false, currentInstanceId: 'room', currentInstanceType: 'dungeon',
            currentDungeonLayout: exclusion === 'wall' ? { walkRects: [{ x: 0, z: 0, width: 2, height: 4 }, { x: 4, z: 0, width: 2, height: 4 }] } : null,
            scene: new THREE.Scene(), chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
            isHostileActorTarget: () => exclusion !== 'friendly' };
        source.useAbility(target.position.clone(), engine, 'Smoke Bomb');
        expect(source.stats.mana).toBe(965);
        expect(target.slowTimer).toBe(0);
        expect(target.accuracyReductionTimer).toBe(exclusion === 'immune' ? 6 : 0);
        if (exclusion === 'immune') expect(target.accuracyReductionFactor).toBe(.3);
    } finally { source.dispose(); target.dispose(); }
});

test('remote smoke uses the accepted cast center and radius, not current interpolation or local training', () => {
    const source = new Rogue('remote-smoke');
    try {
        source.position.set(100, 0, 100); source.talentRanks = {};
        const target = new THREE.Vector3(4, 0, 8);
        expect(resolveRemoteSkillVisual(source, 'Smoke Bomb', target, { radius: 5.75, arc: 2 * Math.PI }))
            .toMatchObject({ type: 'smoke_cloud', origin: target, radius: 5.75, arc: 2 * Math.PI });
    } finally { source.dispose(); }
});
