import * as THREE from 'three';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createCasinoInterior, createCasinoFurnitureColliders } from '../src/art/ProceduralCasino.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';
import { createChronicleSiteModel, getChronicleSiteColliders } from '../src/art/ChronicleSiteModels.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';

// Generated from actual client collision builders, not decorative mesh bounds.
// Boxes: [centerX, centerZ, halfX, halfZ, yaw, minY, maxY].
// The server uses live entity transforms for the three town-service templates.
const round = value => Math.round(value * 1e6) / 1e6;
function boxShape(box, matrix = new THREE.Matrix4()) {
    const center = box.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
    const size = box.getSize(new THREE.Vector3());
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    const worldBox = box.clone().applyMatrix4(matrix);
    return [center.x, center.z, size.x * scale.x / 2, size.z * scale.z / 2,
        Math.atan2(matrix.elements[8], matrix.elements[0]), worldBox.min.y, worldBox.max.y].map(round);
}
function shapes(manager) {
    return {
        boxes: [...manager.colliders.map(box => boxShape(box)),
            ...manager.orientedColliders.map(collider => boxShape(collider.box, collider.matrix))],
        circles: manager.circularColliders.map(({ x, z, radius }) => [x, z, radius].map(round))
    };
}

export async function collectAdminLandingColliders() {
    const scene = new THREE.Scene(), collision = new CollisionManager();
    const generator = new WorldGenerator(scene, collision);
    await generator.createTown(0, 200, 100);
    await generator.createOverworldStructures();
    for (const chapter of chronicleInvestigations) for (const site of chapter.sites) {
        if (site.kind !== 'inspect') continue;
        const model = createChronicleSiteModel(site, chapter.realm);
        model.mesh.position.set(site.x, 0, site.z);
        getChronicleSiteColliders(model.mesh, model.walls).forEach(collider => collision.addOrientedCollider(collider));
        model.dispose();
    }
    const casino = new CollisionManager();
    createCasinoInterior(new THREE.Scene(), casino);
    const entities = {};
    for (const [type, id] of Object.entries({ TradingHouse: 'trading_house', Stash: 'stash', Forge: 'forge' })) {
        const mesh = createProceduralLanternholdStructure(id, { optimized: true });
        const collider = getLanternholdWalkCollider(mesh);
        entities[type] = boxShape(collider.box, collider.matrix);
    }
    const furniture = Object.fromEntries(['slots', 'blackjack', 'poker', 'roulette', 'baccarat'].map(game =>
        [game, boxShape(createCasinoFurnitureColliders([{ game, x: 0, z: 0 }])[0])]));
    return { version: 1, overworld: shapes(collision), casino: shapes(casino), entities, furniture };
}

export function formatAdminLandingColliders(value) {
    // One primitive per line keeps generated geometry reviews compact.
    return JSON.stringify(value).replaceAll('],[', '],\n[') + '\n';
}
