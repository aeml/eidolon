import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../src/art/ProceduralDungeonEntrances.js';

const entrance = DUNGEON_ENTRANCE_DEFINITIONS.verdant_bastion_catacombs;
function collision() {
    const manager = new CollisionManager();
    manager.addCircularCollider(entrance.position[0], entrance.position[2], entrance.interactionRadius);
    return manager;
}

test('the old building-centre waypoint turns a quarter-unit step into a collision ejection', () => {
    const origin = new THREE.Vector3(...entrance.position);
    const corrected = collision().checkCollision(origin.clone().add(new THREE.Vector3(.25, 0, 0)), 3.5, origin);
    expect(corrected.distanceTo(origin)).toBeGreaterThan(30);
});

test.each([1.25, 3.5])('actual server Verdant QA arrival clears entrance collision for radius %s', radius => {
    const source = readFileSync(new URL('../server/internal/game/qa.go', import.meta.url), 'utf8');
    const coordinates = source.match(/case "verdant":\s*(?:\/\/[^\n]*\n\s*)*x, z = ([\d.]+), ([\d.]+)/);
    expect(coordinates).not.toBeNull();
    const origin = new THREE.Vector3(Number(coordinates[1]), 0, Number(coordinates[2]));
    const manager = collision();
    expect(manager.checkCollision(origin, radius, origin)).toBeNull();
    for (let i = 0; i < 8; i++) {
        const step = origin.clone().add(new THREE.Vector3(Math.cos(i * Math.PI / 4), 0, Math.sin(i * Math.PI / 4)));
        expect(manager.checkCollision(step, radius, origin)).toBeNull();
    }
    expect(origin.distanceTo(new THREE.Vector3(...entrance.position))).toBeLessThan(65);
});
