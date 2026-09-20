import * as THREE from 'three';
import { aimDungeonCombatTarget } from './dungeonTargetInput.js';
import { createProceduralMagmaGolem, createProceduralInfernalBehemoth } from '../src/art/ProceduralOverworldEnemies.js';
import { MagmaGolem } from '../src/entities/MagmaGolem.js';
import { InfernalBehemoth } from '../src/entities/InfernalBehemoth.js';

test('recorded Fire stall positions expose the selected Magma Golem through ordinary raycasts', async () => {
    const poses = [
        ['target', MagmaGolem, createProceduralMagmaGolem, 99984.0625, 19558.4453125],
        ['behemoth-a', InfernalBehemoth, createProceduralInfernalBehemoth, 99995.078125, 19560.015625],
        ['golem', MagmaGolem, createProceduralMagmaGolem, 99995.234375, 19556.357421875],
        ['behemoth-b', InfernalBehemoth, createProceduralInfernalBehemoth, 99994.515625, 19560.330078125]
    ];
    const actors = poses.map(([id, Actor, build, x, z]) => {
        const actor = new Actor(id);
        actor.updateNameTag = () => {};
        actor.setMesh(build());
        actor.position.set(x, 0, z);
        actor.mesh.position.copy(actor.position);
        actor.mesh.updateMatrixWorld(true);
        return actor;
    });
    const boxes = actors.map(actor => actor.mesh.getObjectByName('ActorInteractionHitbox'));
    const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, .1, 2000);
    camera.position.set(99983.96597605452 + 100, 100, 19561.42065874282 + 100);
    camera.lookAt(99983.96597605452, 0, 19561.42065874282);
    camera.updateMatrixWorld(true);
    boxes[0].geometry.computeBoundingBox();
    const bounds = boxes[0].geometry.boundingBox;
    const ray = new THREE.Raycaster(), observations = [];
    let hovered;
    const point = await aimDungeonCombatTarget({
        project: async (_id, sample) => {
            sample ||= { x: .5, y: .5, z: .5 };
            const p = new THREE.Vector3(...['x', 'y', 'z'].map(axis =>
                bounds.min[axis] + (bounds.max[axis] - bounds.min[axis]) * sample[axis]));
            boxes[0].localToWorld(p).project(camera);
            return { x: p.x, y: p.y, visible: Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 };
        },
        move: async (x, y) => {
            ray.setFromCamera(new THREE.Vector2(x, y), camera);
            hovered = ray.intersectObjects(boxes)[0]?.object.userData.entityId;
            observations.push(hovered);
        },
        settle: async () => {}, hoveredId: async () => hovered
    }, 'target', true);
    expect({ point: Boolean(point), observations }).toEqual({ point: true, observations: ['target'] });
});
