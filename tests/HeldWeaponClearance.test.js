import * as THREE from 'three';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard,
    createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment, createProceduralEquipmentVisual } from '../src/art/ProceduralEquipment.js';

const factories = { Fighter: createProceduralFighter, Rogue: createProceduralRogue,
    Wizard: createProceduralWizard, Cleric: createProceduralCleric };

function preparedSword(name, legacyMount = false) {
    const actor = factories[name]();
    if (legacyMount) actor.getObjectByName('Equipment_MainHand').rotation.x = 0;
    applyProceduralEquipment(actor, { mainHand: { id: 'clearance-sword', name: 'Iron Sword', baseName: 'Iron Sword',
        type: 'WEAPON', slot: 'mainHand', level: 1, rarity: 'Rare', sockets: 1,
        gems: [{ type: 'Ruby', quality: 'Flawed' }] } });
    // Reconstruct the recorded old mount AND old socket location for this
    // geometry-only negative. New inlay placement must not rewrite its evidence.
    if (legacyMount) {
        const socket = actor.getObjectByName('Gear_Socket1');
        socket.position.set(.1, .3, .098);
        socket.updateMatrix(); // Batched inspection sources have matrixAutoUpdate=false.
    }
    return actor;
}

function occludingBody(actor) {
    actor.updateMatrixWorld(true);
    const item = actor.getObjectByName('EquippedVisual_mainHand'), socket = actor.getObjectByName('Gear_Socket1');
    const bounds = new THREE.Box3().setFromObject(item), center = bounds.getCenter(new THREE.Vector3());
    const front = new THREE.Vector3(0, .3, 1).normalize();
    const camera = center.addScaledVector(front, Math.max(.5, bounds.getSize(new THREE.Vector3()).length() * 1.8));
    const point = socket.getWorldPosition(new THREE.Vector3());
    const ray = new THREE.Raycaster(camera, point.clone().sub(camera).normalize(), 0, camera.distanceTo(point) - .04);
    const visibleBody = [];
    actor.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (let parent = mesh; parent; parent = parent.parent) {
            if (!parent.visible || parent === item) return;
        }
        visibleBody.push(mesh);
    });
    return ray.intersectObjects(visibleBody, false).map(hit => hit.object.name);
}

test.each(Object.keys(factories))('%s equipped sword socket clears its own body in the detail view', name => {
    expect(occludingBody(preparedSword(name))).toEqual([]);
});

test.each([['Rogue', 'Rogue_HipWrap'], ['Wizard', 'Wizard_HipRobe'], ['Cleric', 'Cleric_HipVestment']])(
    '%s legacy unpitched mount reproduces actual garment occlusion', (name, garment) => {
        expect(occludingBody(preparedSword(name, true))).toContain(garment);
    });

test.each(Object.keys(factories))('%s preserves off-hand mount and shared default/equipped main-hand ownership', name => {
    const actor = preparedSword(name);
    expect(actor.getObjectByName('Equipment_OffHand').rotation.x).toBe(0);
    expect(actor.getObjectByName('EquippedVisual_mainHand').parent).toBe(actor.getObjectByName('Equipment_MainHand'));
});

test.each(['Iron Sword', 'Steel Dagger'])('%s embeds three socket fittings within both blade faces', name => {
    const item = { id: 'inlaid-blade', name, baseName: name, type: 'WEAPON', slot: 'mainHand',
        sockets: 3, gems: [{ type: 'Ruby' }, { type: 'Sapphire' }, { type: 'Emerald' }] };
    const before = JSON.stringify(item), visual = createProceduralEquipmentVisual(item);
    for (let i = 1; i <= 3; i++) {
        const front = visual.getObjectByName(`Gear_Socket${i}`), back = visual.getObjectByName(`Gear_SocketBack${i}`);
        expect(front.position.x).toBe(0);
        expect(front.position.y).toBeCloseTo(.4 + (i - 2) * .085);
        expect(back.position.y).toBe(front.position.y);
        expect(front.position.z + back.position.z).toBeCloseTo(.035);
        expect(back.material).toBe(front.material);
        expect(back.geometry).toBe(front.geometry);
        expect(back.geometry.parameters.radius).toBe(.033);
        expect(back.material.emissiveIntensity).toBe(.12);
    }
    expect(visual.userData.sockets).toBe(3);
    expect(JSON.stringify(item)).toBe(before);
});
