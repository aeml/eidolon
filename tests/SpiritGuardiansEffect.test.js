import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { SpiritGuardiansEffect } from '../src/entities/SpiritGuardiansEffect.js';

function makeSource() {
    return {
        id: 'cleric-visual-test',
        position: new THREE.Vector3(4, 0, -3),
        state: 'IDLE',
        mesh: new THREE.Group(),
        skillRunes: {}
    };
}

describe('SpiritGuardiansEffect', () => {
    test.each(['high', 'low'])('cherubs share batched geometry and flap their wings on %s quality', (quality) => {
        const effect = new SpiritGuardiansEffect(new THREE.Group(), makeSource(), { quality });
        const [first, second] = effect.guardians;
        expect(first.getObjectByName('Cherub_Batch_body').geometry).toBe(second.getObjectByName('Cherub_Batch_body').geometry);
        let visibleMeshes = 0;
        first.traverseVisible((object) => { if (object.isMesh) visibleMeshes++; });
        expect(visibleMeshes).toBeLessThanOrEqual(7);
        const before = first.userData.wings[0].rotation.y;
        effect.update(0.2);
        expect(first.userData.wings[0].rotation.y).not.toBe(before);
        expect(first.userData.bodyMaterial.transparent).toBe(false);
        effect.dispose();
    });

    test('renders three recognizable world-space guardians plus an aura', () => {
        const scene = new THREE.Group();
        const source = makeSource();
        source.mesh.scale.setScalar(2.5);

        const effect = new SpiritGuardiansEffect(scene, source);
        effect.update(0.25);

        expect(effect.group.parent).toBe(scene);
        expect(effect.group.parent).not.toBe(source.mesh);
        expect(effect.guardians).toHaveLength(3);
        expect(effect.group.getObjectByName('SpiritGuardiansAura')).not.toBeNull();
        for (const guardian of effect.guardians) {
            expect(guardian.userData.presentation).toBe('cherub');
            expect(guardian.getObjectByName('Cherub_Belly')).toBeTruthy();
            expect(guardian.getObjectByName('Cherub_Head')).toBeTruthy();
            expect(guardian.userData.wings).toHaveLength(2);
            expect(guardian.getObjectByName('Cherub_Halo')).toBeTruthy();
            expect(Math.hypot(guardian.position.x, guardian.position.z)).toBeCloseTo(12, 5);
        }
        expect(effect.getMetrics()).toEqual(expect.objectContaining({
            active: true,
            guardianCount: 3,
            effectRadius: 16,
            orbitRadius: 12,
            attached: true
        }));
        expect(effect.pulseRing.geometry.parameters.outerRadius).toBe(16);

        effect.dispose();
    });

    test('follows source position without inheriting source scale or facing', () => {
        const scene = new THREE.Group();
        const source = makeSource();
        source.mesh.scale.setScalar(4);
        source.mesh.rotation.y = Math.PI;
        const effect = new SpiritGuardiansEffect(scene, source);

        source.position.set(12, 2, 9);
        effect.update(0.5);

        expect(effect.group.position.x).toBe(12);
        expect(effect.group.position.y).toBeCloseTo(2.12, 5);
        expect(effect.group.position.z).toBe(9);
        expect(effect.group.scale.toArray()).toEqual([1, 1, 1]);
        expect(effect.group.quaternion.toArray()).toEqual([0, 0, 0, 1]);

        effect.dispose();
    });

    test('boost and rune variants rebuild deterministically without duplicate groups', () => {
        const scene = new THREE.Group();
        const source = makeSource();
        const effect = new SpiritGuardiansEffect(scene, source);
        const originalGroup = effect.group;

        effect.setVariant({ boosted: true, runeId: 'spirits_vengeful' });
        effect.update(0.25);

        expect(effect.group).toBe(originalGroup);
        expect(scene.children).toEqual([originalGroup]);
        expect(effect.guardians).toHaveLength(5);
        expect(effect.getMetrics()).toEqual(expect.objectContaining({
            boosted: true,
            runeId: 'spirits_vengeful',
            effectRadius: 20,
            orbitRadius: 15,
            guardianCount: 5
        }));

        effect.dispose();
    });

    test('expanded variants show the complete authoritative damage boundary', () => {
        const scene = new THREE.Group();
        const source = makeSource();
        source.skillRunes['Spirit Guardians'] = 'spirits_expanded';
        const effect = new SpiritGuardiansEffect(scene, source, {
            runeId: 'spirits_expanded'
        });

        expect(effect.getMetrics()).toEqual(expect.objectContaining({
            effectRadius: 24,
            orbitRadius: 18
        }));
        expect(effect.pulseRing.geometry.parameters.outerRadius).toBe(24);

        effect.setVariant({ boosted: true, runeId: 'spirits_expanded' });
        expect(effect.getMetrics()).toEqual(expect.objectContaining({
            effectRadius: 30,
            orbitRadius: 22.5
        }));
        expect(effect.pulseRing.geometry.parameters.outerRadius).toBe(30);

        effect.dispose();
    });

    test('reattaches after an instance effect-group clear while state remains active', () => {
        const scene = new THREE.Group();
        const source = makeSource();
        const effect = new SpiritGuardiansEffect(scene, source);

        scene.remove(effect.group);
        expect(effect.group.parent).toBeNull();
        effect.update(0.016);

        expect(effect.group.parent).toBe(scene);
        effect.dispose();
    });

    test('dispose releases every owned resource exactly once', () => {
        const scene = new THREE.Group();
        const effect = new SpiritGuardiansEffect(scene, makeSource());
        const resources = [...effect.resources];
        const disposeSpies = resources.map((resource) => jest.spyOn(resource, 'dispose'));

        effect.dispose();
        effect.dispose();

        expect(scene.children).toHaveLength(0);
        expect(effect.resources.size).toBe(0);
        expect(effect.guardians).toHaveLength(0);
        disposeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    });
});

describe('Cleric Spirit Guardians lifecycle', () => {
    function makeEngine() {
        const effectScene = new THREE.Group();
        return {
            effectScene,
            renderSystem: { effectGroup: effectScene },
            uiManager: { getGraphicsQuality: () => 'high' },
            chunkManager: { getActiveEntities: () => [] },
            floatingTextManager: { spawn: jest.fn() }
        };
    }

    test('activation and refresh keep exactly one owner-following effect', () => {
        const cleric = new Cleric('cleric-lifecycle');
        cleric.mesh = new THREE.Group();
        const engine = makeEngine();

        cleric.useAbility(new THREE.Vector3(1, 0, 1), engine, 'Spirit Guardians');
        const firstEffect = cleric.spiritEffect;
        cleric.cooldowns['Spirit Guardians'] = 0;
        cleric.stats.mana = cleric.stats.maxMana;
        cleric.useAbility(new THREE.Vector3(2, 0, 2), engine, 'Spirit Guardians');

        expect(firstEffect).toBeInstanceOf(SpiritGuardiansEffect);
        expect(cleric.spiritEffect).toBe(firstEffect);
        expect(engine.effectScene.children).toEqual([firstEffect.group]);
        expect(cleric.spirits).toHaveLength(3);

        cleric.cancelAbilities();
    });

    test('boosted activation creates five guardians and expiry removes them once', () => {
        const cleric = new Cleric('cleric-boosted');
        cleric.mesh = new THREE.Group();
        const engine = makeEngine();

        cleric.useAbility(new THREE.Vector3(), engine, 'Spirit Guardians Boost');
        expect(cleric.spiritEffect?.guardians).toHaveLength(5);
        expect(engine.effectScene.children).toHaveLength(1);

        cleric.spiritDuration = 0.01;
        cleric.update(0.02, null, null, null, engine.floatingTextManager);

        expect(cleric.spiritsActive).toBe(false);
        expect(cleric.spiritEffect).toBeNull();
        expect(engine.effectScene.children).toHaveLength(0);
    });

    test('multiplayer presentation never applies client-side guardian damage', () => {
        const cleric = new Cleric('cleric-authoritative');
        cleric.mesh = new THREE.Group();
        cleric.isMultiplayer = true;
        cleric.spiritsActive = true;
        cleric.spiritDuration = 5;
        const engine = makeEngine();
        cleric.gameEngine = engine;
        const enemy = {
            isActive: true,
            state: 'IDLE',
            constructor: { name: 'Skeleton' },
            position: new THREE.Vector3(1, 0, 0),
            takeDamage: jest.fn()
        };

        cleric.update(0.6, null, null, { getActiveEntities: () => [enemy] }, engine.floatingTextManager);

        expect(enemy.takeDamage).not.toHaveBeenCalled();
        cleric.cancelAbilities();
    });

    test('repeated activation and cancellation leaves stable scene and effect counts', () => {
        const cleric = new Cleric('cleric-soak');
        cleric.mesh = new THREE.Group();
        const engine = makeEngine();

        for (let index = 0; index < 20; index += 1) {
            cleric.spiritsActive = true;
            cleric.spiritBoosted = index % 2 === 0;
            cleric.spiritDuration = 8;
            expect(cleric.createSpirits(engine)).toBe(true);
            cleric.update(0.016, null, null, null, engine.floatingTextManager);
            expect(engine.effectScene.children).toHaveLength(1);
            cleric.cancelAbilities();
            expect(engine.effectScene.children).toHaveLength(0);
            expect(cleric.spirits).toHaveLength(0);
        }
    });
});
