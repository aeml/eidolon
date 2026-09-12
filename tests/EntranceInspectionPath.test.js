import * as THREE from 'three';
import { entranceInspectionPath } from './entranceInspectionPath.js';
import { DUNGEON_ENTRANCE_DEFINITIONS, createProceduralDungeonEntrance } from '../src/art/ProceduralDungeonEntrances.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { SceneryVisibility } from '../src/core/SceneryVisibility.js';

test('inspection walks outside the real collider to a genuinely occluded position', () => {
    const definition = DUNGEON_ENTRANCE_DEFINITIONS.verdant_bastion_catacombs;
    const path = entranceInspectionPath(definition);
    expect(path[0]).toEqual({ x: 800, z: 250 });
    expect(path).toHaveLength(7);
    const collision = new CollisionManager();
    collision.addCircularCollider(800, 200, definition.interactionRadius);
    for (let i = 1; i < path.length; i++) {
        const a = new THREE.Vector3(path[i-1].x, 0, path[i-1].z), b = new THREE.Vector3(path[i].x, 0, path[i].z);
        for (let step = 0; step <= 20; step++) {
            expect(collision.checkCollision(a.clone().lerp(b, step / 20), 3.5, a)).toBeNull();
        }
    }
    const root = createProceduralDungeonEntrance('verdant_bastion_catacombs');
    root.position.set(...definition.position); root.updateMatrixWorld(true);
    const visibility = new SceneryVisibility(), entry = visibility.createEntry(root);
    const camera = new THREE.OrthographicCamera(-30, 30, 30, -30, .1, 1000);
    const blocked = point => {
        const focus = new THREE.Vector3(point.x, 0, point.z);
        camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100));
        camera.lookAt(focus); camera.updateMatrixWorld(true);
        return visibility.blocksFocus(entry, camera, focus);
    };
    expect(blocked(path[0])).toBe(false);
    expect(blocked(path.at(-1))).toBe(true);
});
