import * as THREE from 'three';
import {
    TOWN_ACTOR_DEFINITIONS,
    TOWN_ACTOR_TYPES,
    createProceduralTownActor,
    createProceduralDwarfSalesman,
    createProceduralQuestNPC,
    createProceduralDungeonNPC,
    createProceduralRespecNPC,
    getProceduralTownActorCacheMetrics
} from '../src/art/ProceduralTownActors.js';
import { DwarfSalesman } from '../src/entities/DwarfSalesman.js';
import { QuestNPC } from '../src/entities/QuestNPC.js';
import { DungeonNPC } from '../src/entities/DungeonNPC.js';
import { RespecNPC } from '../src/entities/RespecNPC.js';

const FACTORIES = Object.freeze({
    DwarfSalesman: createProceduralDwarfSalesman,
    QuestNPC: createProceduralQuestNPC,
    DungeonNPC: createProceduralDungeonNPC,
    RespecNPC: createProceduralRespecNPC
});

const ENTITY_FACTORIES = Object.freeze({
    DwarfSalesman: (id) => new DwarfSalesman(id),
    QuestNPC: (id) => new QuestNPC(id),
    DungeonNPC: (id) => new DungeonNPC(id),
    RespecNPC: (id) => new RespecNPC(id)
});

const IDENTITY_OBJECTS = Object.freeze({
    DwarfSalesman: ['DwarfSalesman_ForgeApron', 'DwarfSalesman_HammerHead', 'DwarfSalesman_MerchantPack'],
    QuestNPC: ['QuestNPC_Scroll', 'QuestNPC_Quill', 'QuestNPC_OathSunRing'],
    DungeonNPC: ['DungeonNPC_LanternFrame', 'DungeonNPC_KeyRing', 'DungeonNPC_MapCase'],
    RespecNPC: ['RespecNPC_AshMask', 'RespecNPC_SoulOrb', 'RespecNPC_Ledger']
});

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

describe('procedural Lanternhold service actors', () => {
    test.each(TOWN_ACTOR_TYPES)('%s is grounded, bounded, detailed, and semantically distinct', (type) => {
        const actor = FACTORIES[type]();
        const bounds = new THREE.Box3().setFromObject(actor);
        const size = bounds.getSize(new THREE.Vector3());
        const definition = TOWN_ACTOR_DEFINITIONS[type];

        expect(actor.userData).toEqual(expect.objectContaining({
            proceduralTownActor: true,
            proceduralActorType: type,
            artStyle: definition.artStyle,
            sharedGeometry: true,
            bounds: definition.bounds
        }));
        expect(actor.userData.assetFallback).toBeUndefined();
        expect(visibleMeshCount(actor)).toBeGreaterThanOrEqual(40);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
        expect(bounds.min.y).toBeLessThan(0.01);
        expect(size.y).toBeGreaterThan(type === 'DwarfSalesman' ? 3 : 3.7);
        expect(bounds.max.y).toBeLessThanOrEqual(definition.bounds.height + 0.01);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-definition.bounds.radius - 0.001);
        expect(bounds.max.x).toBeLessThanOrEqual(definition.bounds.radius + 0.001);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-definition.bounds.radius - 0.001);
        expect(bounds.max.z).toBeLessThanOrEqual(definition.bounds.radius + 0.001);
        expect(hasOnlyFiniteTransforms(actor)).toBe(true);
        IDENTITY_OBJECTS[type].forEach((name) => expect(actor.getObjectByName(name)).not.toBeNull());
    });

    test('all four services expose different art identities and silhouettes', () => {
        const actors = TOWN_ACTOR_TYPES.map((type) => createProceduralTownActor(type));
        const styles = actors.map((actor) => actor.userData.artStyle);
        const heights = actors.map((actor) => (
            new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).y.toFixed(2)
        ));

        expect(new Set(styles).size).toBe(TOWN_ACTOR_TYPES.length);
        expect(new Set(heights).size).toBeGreaterThanOrEqual(3);
        expect(actors[0].getObjectByName('DwarfSalesman_HammerHead')).not.toBeNull();
        expect(actors[1].getObjectByName('DwarfSalesman_HammerHead')).toBeUndefined();
        expect(actors[2].getObjectByName('DungeonNPC_LanternFlame')).not.toBeNull();
        expect(actors[3].getObjectByName('RespecNPC_MemoryShard3')).not.toBeNull();
    });

    test.each(TOWN_ACTOR_TYPES)('%s has an expressive generated idle clip', (type) => {
        const actor = createProceduralTownActor(type);
        const focus = actor.getObjectByName('Rig_ServiceFocus');
        const clip = actor.userData.animations[0];
        const originalFocusRotation = focus.rotation.z;
        const mixer = new THREE.AnimationMixer(actor);

        expect(actor.userData.animations.map((entry) => entry.name)).toEqual(['Idle']);
        expect(clip.tracks.length).toBeGreaterThanOrEqual(9);
        expect(clip.tracks.some((track) => track.name === 'Rig_ServiceFocus.rotation[z]')).toBe(true);

        mixer.clipAction(clip).reset().play();
        mixer.update(0.65);
        actor.updateMatrixWorld(true);
        expect(focus.rotation.z).not.toBeCloseTo(originalFocusRotation, 4);
        expect(hasOnlyFiniteTransforms(actor)).toBe(true);
        mixer.stopAllAction();
        mixer.uncacheRoot(actor);
    });

    test('shares immutable render resources but keeps actor poses independent and resettable', () => {
        TOWN_ACTOR_TYPES.forEach((type) => createProceduralTownActor(type));
        const first = createProceduralQuestNPC();
        const second = createProceduralQuestNPC();
        const firstTorso = first.getObjectByName('QuestNPC_Torso');
        const secondTorso = second.getObjectByName('QuestNPC_Torso');

        expect(first).not.toBe(second);
        expect(first.getObjectByName('Rig_Chest')).not.toBe(second.getObjectByName('Rig_Chest'));
        expect(firstTorso.geometry).toBe(secondTorso.geometry);
        expect(firstTorso.material).toBe(secondTorso.material);

        first.scale.setScalar(0.7);
        first.getObjectByName('Rig_Chest').rotation.y = 0.8;
        first.getObjectByName('Rig_ServiceFocus').rotation.z = 0.9;
        first.userData.resetPose();
        expect(first.scale.toArray()).toEqual([1, 1, 1]);
        expect(first.getObjectByName('Rig_Chest').rotation.y).toBeCloseTo(0);
        expect(first.getObjectByName('Rig_ServiceFocus').rotation.z).toBeCloseTo(0);
        expect(second.getObjectByName('Rig_Chest').rotation.y).toBeCloseTo(0);
        expect(getProceduralTownActorCacheMetrics()).toEqual(expect.objectContaining({
            geometries: expect.any(Number),
            materials: expect.any(Number)
        }));
        expect(getProceduralTownActorCacheMetrics().geometries).toBeGreaterThanOrEqual(30);
        expect(getProceduralTownActorCacheMetrics().materials).toBeGreaterThanOrEqual(32);
    });

    test.each(TOWN_ACTOR_TYPES)('%s keeps one exact full-silhouette interaction hitbox through pool ownership', (type) => {
        const mesh = createProceduralTownActor(type);
        const first = ENTITY_FACTORIES[type](`${type}-first`);
        const second = ENTITY_FACTORIES[type](`${type}-second`);
        const declaredBounds = TOWN_ACTOR_DEFINITIONS[type].bounds;

        // JSDOM has no text metrics; nameplate rendering is covered in the
        // browser gallery while this unit case isolates mesh ownership.
        first.name = '';
        second.name = '';

        first.setMesh(mesh);
        second.setMesh(mesh);

        const hitboxes = [];
        mesh.traverse((child) => {
            if (child.name === 'ActorInteractionHitbox') hitboxes.push(child);
        });
        expect(hitboxes).toHaveLength(1);
        expect(hitboxes[0].userData.entityId).toBe(`${type}-second`);
        expect(hitboxes[0].geometry.parameters).toEqual(expect.objectContaining({
            width: declaredBounds.radius * 2,
            height: declaredBounds.height,
            depth: declaredBounds.radius * 2
        }));
        expect(hitboxes[0].position.y).toBe(declaredBounds.height / 2);
    });

    test('rejects unclassified service types instead of hiding them behind a generic fallback', () => {
        expect(() => createProceduralTownActor('UnknownTownService'))
            .toThrow('Unknown procedural town actor type: UnknownTownService');
    });
});
