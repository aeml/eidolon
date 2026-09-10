import * as THREE from 'three';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard,
    createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment } from '../src/art/ProceduralEquipment.js';

const factories = { Fighter: createProceduralFighter, Rogue: createProceduralRogue,
    Wizard: createProceduralWizard, Cleric: createProceduralCleric };

function preparedSword(name, legacyMount = false) {
    const actor = factories[name]();
    if (legacyMount) actor.getObjectByName('Equipment_MainHand').rotation.x = 0;
    applyProceduralEquipment(actor, { mainHand: { id: 'clearance-sword', name: 'Iron Sword', baseName: 'Iron Sword',
        type: 'WEAPON', slot: 'mainHand', level: 1, rarity: 'Rare', sockets: 1,
        gems: [{ type: 'Ruby', quality: 'Flawed' }] } });
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
