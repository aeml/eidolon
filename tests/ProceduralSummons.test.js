import * as THREE from 'three';
import {
    PROCEDURAL_SUMMON_DEFINITIONS,
    createProceduralAvengingSeraph,
    getProceduralSummonCacheMetrics
} from '../src/art/ProceduralSummons.js';
import { AvengingSeraph } from '../src/entities/AvengingSeraph.js';

function visibleMeshCount(root) {
    let count = 0;
    root.traverse((child) => {
        if (child.isMesh && child.visible) count += 1;
    });
    return count;
}

function hasOnlyFiniteTransforms(root) {
    let finite = true;
    root.updateMatrixWorld(true);
    root.traverse((child) => {
        finite &&= child.matrixWorld.elements.every(Number.isFinite);
    });
    return finite;
}

describe('procedural dark-fantasy summons', () => {
    test('Avenging Seraph is grounded, fully bounded, detailed, and unmistakable', () => {
        const seraph = createProceduralAvengingSeraph();
        const definition = PROCEDURAL_SUMMON_DEFINITIONS.AvengingSeraph;
        const bounds = new THREE.Box3().setFromObject(seraph);

        expect(seraph.userData).toEqual(expect.objectContaining({
            proceduralSummon: true,
            proceduralActorType: 'AvengingSeraph',
            artStyle: 'Lanternhold reliquary seraph',
            combatRadius: 1.5,
            sharedGeometry: true,
            bounds: definition.bounds
        }));
        expect(seraph.userData.assetFallback).toBeUndefined();
        expect(visibleMeshCount(seraph)).toBeGreaterThanOrEqual(65);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
        expect(bounds.min.y).toBeLessThan(0.01);
        expect(bounds.max.y).toBeLessThanOrEqual(definition.bounds.height);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-definition.bounds.radius);
        expect(bounds.max.x).toBeLessThanOrEqual(definition.bounds.radius);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-definition.bounds.radius);
        expect(bounds.max.z).toBeLessThanOrEqual(definition.bounds.radius);
        expect(hasOnlyFiniteTransforms(seraph)).toBe(true);

        [
            'AvengingSeraph_BrokenSunHalo',
            'AvengingSeraph_PrimaryLeft5',
            'AvengingSeraph_PrimaryRight5',
            'AvengingSeraph_OathSpearBlade',
            'AvengingSeraph_CenserBowl',
            'AvengingSeraph_BurialMask',
            'AvengingSeraph_BindingCircle'
        ].forEach((name) => expect(seraph.getObjectByName(name)).not.toBeNull());
    });

    test('all five authoritative states animate independent semantic pivots', () => {
        const seraph = createProceduralAvengingSeraph();
        const clips = Object.fromEntries(seraph.userData.animations.map((clip) => [clip.name, clip]));

        expect(Object.keys(clips)).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
        expect(clips.Idle.tracks.length).toBeGreaterThanOrEqual(8);
        expect(clips.Attack.tracks.some((track) => track.name === 'Rig_SeraphWeapon.rotation[z]')).toBe(true);
        expect(clips.Death.tracks.some((track) => track.name === 'Rig_SeraphBody.position[y]')).toBe(true);

        for (const [state, sampleTime] of Object.entries({ Idle: 0.5, Walk: 0.3, Run: 0.18, Attack: 0.42, Death: 1.15 })) {
            seraph.userData.resetPose();
            const mixer = new THREE.AnimationMixer(seraph);
            mixer.clipAction(clips[state]).reset().play();
            mixer.update(sampleTime);
            seraph.updateMatrixWorld(true);
            expect(hasOnlyFiniteTransforms(seraph)).toBe(true);
            mixer.stopAllAction();
            mixer.uncacheRoot(seraph);
        }

        seraph.userData.resetPose();
        const attackMixer = new THREE.AnimationMixer(seraph);
        const weapon = seraph.getObjectByName('Rig_SeraphWeapon');
        const restingWeaponZ = weapon.rotation.z;
        attackMixer.clipAction(clips.Attack).reset().play();
        attackMixer.update(0.42);
        expect(weapon.rotation.z).not.toBeCloseTo(restingWeaponZ, 4);
    });

    test('instances share immutable rendering resources while keeping poses independent', () => {
        const first = createProceduralAvengingSeraph();
        const second = createProceduralAvengingSeraph();
        const firstMask = first.getObjectByName('AvengingSeraph_BurialMask');
        const secondMask = second.getObjectByName('AvengingSeraph_BurialMask');

        expect(first).not.toBe(second);
        expect(first.getObjectByName('Rig_SeraphWingLeft')).not.toBe(second.getObjectByName('Rig_SeraphWingLeft'));
        expect(firstMask.geometry).toBe(secondMask.geometry);
        expect(firstMask.material).toBe(secondMask.material);

        first.position.set(8, 4, -2);
        first.scale.setScalar(0.3);
        first.getObjectByName('Rig_SeraphWingLeft').rotation.z = 1.2;
        first.userData.resetPose();
        expect(first.position.toArray()).toEqual([0, 0, 0]);
        expect(first.scale.toArray()).toEqual([1, 1, 1]);
        expect(first.getObjectByName('Rig_SeraphWingLeft').rotation.z).toBeCloseTo(-0.18);
        expect(second.getObjectByName('Rig_SeraphWingLeft').rotation.z).toBeCloseTo(-0.18);
        expect(getProceduralSummonCacheMetrics()).toEqual({ geometries: 30, materials: 8 });
    });

    test('entity ownership keeps one exact full-silhouette interaction hitbox', () => {
        const mesh = createProceduralAvengingSeraph();
        const first = new AvengingSeraph('seraph-first');
        const second = new AvengingSeraph('seraph-second');
        const bounds = PROCEDURAL_SUMMON_DEFINITIONS.AvengingSeraph.bounds;
        first.name = '';
        second.name = '';

        first.setMesh(mesh);
        second.setMesh(mesh);

        const hitboxes = [];
        mesh.traverse((child) => {
            if (child.name === 'ActorInteractionHitbox') hitboxes.push(child);
        });
        expect(hitboxes).toHaveLength(1);
        expect(hitboxes[0].userData.entityId).toBe('seraph-second');
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: bounds.radius * 2,
            height: bounds.height,
            depth: bounds.radius * 2
        }));
        expect(hitboxes[0].position.y).toBe(bounds.height / 2);
    });
});
