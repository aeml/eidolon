import * as THREE from 'three';
import { createTailoredTorsoGeometry, createOpenHoodGeometry, createPairedEyesGeometry, createPauldronGeometry, createDrapedSkirtGeometry, createWristCuffGeometry, createFittedBootGeometry, createClothMantleGeometry, createGreatHelmGeometry, createLegSectionGeometry } from '../src/art/ProceduralGarmentGeometry.js';
import { createProceduralFighter, createProceduralRogue, createProceduralWizard, createProceduralCleric } from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment, clearProceduralEquipment } from '../src/art/ProceduralEquipment.js';

const classes = [
    ['Fighter', createProceduralFighter, 'Fighter_Cloak'],
    ['Rogue', createProceduralRogue, 'Rogue_CloakLeft'],
    ['Wizard', createProceduralWizard, 'Wizard_RobePanelLeft'],
    ['Cleric', createProceduralCleric, 'Cleric_VestmentPanelLeft']
];

test.each(['thigh', 'shin', 'greave'])('%s has bounded finite anatomy and outward front faces', section => {
    const shape = createLegSectionGeometry(section), material = new THREE.MeshBasicMaterial();
    for (const attribute of Object.values(shape.attributes)) expect(attribute.array.every(Number.isFinite)).toBe(true);
    expect(shape.attributes.position.count).toBeLessThan(180);
    shape.computeBoundingBox();
    expect(shape.boundingBox.min.y).toBeGreaterThan(-.84);
    expect(shape.boundingBox.max.y).toBeLessThan(.02);
    expect(shape.boundingBox.max.x).toBeLessThan(.27);
    const hit = new THREE.Raycaster(new THREE.Vector3(0, -.35, 1), new THREE.Vector3(0, 0, -1))
        .intersectObject(new THREE.Mesh(shape, material))[0];
    expect(hit).toBeDefined();
    expect(hit.point.z).toBeGreaterThan(.16);
    expect(hit.face.normal.z).toBeGreaterThan(0);
    shape.dispose(); material.dispose();
});

test.each([false, true])('draped mantle border=%s has finite bounded geometry and a continuous lighting seam', border => {
    const shape = createClothMantleGeometry(border);
    for (const attribute of Object.values(shape.attributes)) expect(attribute.array.every(Number.isFinite)).toBe(true);
    shape.computeBoundingBox();
    expect(shape.boundingBox.max.x).toBeLessThan(.47);
    expect(shape.boundingBox.min.y).toBeGreaterThan(-.27);
    expect(shape.boundingBox.max.y).toBeLessThan(.21);
    expect(shape.attributes.position.count).toBeLessThan(160);
    const rows = border ? 2 : 6, normals = shape.attributes.normal;
    for (let row = 0; row < rows; row++) expect(new THREE.Vector3().fromBufferAttribute(normals, row)
        .distanceTo(new THREE.Vector3().fromBufferAttribute(normals, 24 * rows + row))).toBeLessThan(.00001);
    shape.dispose();
});

test('mantle trim follows the hem folds without intersecting the cloth', () => {
    const body = createClothMantleGeometry(), trim = createClothMantleGeometry(true);
    const a = body.attributes.position, b = trim.attributes.position;
    for (let column = 0; column <= 24; column++) for (let row = 0; row < 2; row++) {
        const p = column * 6 + row, q = column * 2 + row;
        expect(b.getY(q)).toBeCloseTo(a.getY(p), 6);
        expect(Math.hypot(b.getX(q), b.getZ(q) / .88) - Math.hypot(a.getX(p), a.getZ(p) / .88)).toBeCloseTo(.002, 6);
    }
    body.dispose(); trim.dispose();
});

test.each([
    ['pauldron shell', () => createPauldronGeometry(), -.04, .37],
    ['pauldron lame', () => createPauldronGeometry('lame'), -.17, .34],
    ['pauldron rim', () => createPauldronGeometry('rim'), -.07, .38],
    ['cloth mantle', () => createClothMantleGeometry(), -.1, .36],
    ['great helm', createGreatHelmGeometry, .1, .36]
])('%s exposes its outside rather than the inner or far wall', (_name, create, y, z) => {
    const shape = create(), material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(shape, material);
    const hit = new THREE.Raycaster(new THREE.Vector3(0, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    expect(hit.point.z).toBeGreaterThan(z);
    expect(hit.face.normal.z).toBeGreaterThan(0);
    shape.dispose(); material.dispose();
});

test.each(['upper', 'sole', 'toe'])('fitted boot %s stays bounded with finite surfaces', part => {
    const geometry = createFittedBootGeometry(part);
    for (const attribute of Object.values(geometry.attributes)) expect(attribute.array.every(Number.isFinite)).toBe(true);
    expect(geometry.index.array.every(index => index < geometry.attributes.position.count)).toBe(true);
    expect(geometry.attributes.position.count).toBeLessThan(200);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.y).toBeGreaterThan(-.021);
    expect(geometry.boundingBox.max.y).toBeLessThan(.321);
    expect(geometry.boundingBox.max.z).toBeLessThan(.541);
    expect(geometry.boundingBox.min.z).toBeGreaterThan(-.191);
    if (part !== 'toe') for (let row = 0; row < (part === 'sole' ? 3 : 7); row++) {
        const normal = geometry.attributes.normal;
        expect(new THREE.Vector3().fromBufferAttribute(normal, row * 25).distanceTo(
            new THREE.Vector3().fromBufferAttribute(normal, row * 25 + 24))).toBeLessThan(.0001);
    }
    geometry.dispose();
});

test('boot ankle is open but its outsole closes the bottom with outward faces', () => {
    const material = new THREE.MeshBasicMaterial();
    const upper = new THREE.Mesh(createFittedBootGeometry(), material);
    const sole = new THREE.Mesh(createFittedBootGeometry('sole'), material);
    expect(new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), 0, .8).intersectObject(upper)).toHaveLength(0);
    const hit = new THREE.Raycaster(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)).intersectObject(sole)[0];
    expect(hit.point.y).toBeCloseTo(-.02);
    upper.geometry.dispose(); sole.geometry.dispose(); material.dispose();
});

test.each([false, true])('wrist cuff rim=%s has a real opening and finite surface data', rim => {
    const geometry = createWristCuffGeometry(rim);
    for (const name of ['position', 'normal', 'uv']) {
        expect(geometry.attributes[name].array.every(Number.isFinite)).toBe(true);
    }
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.min.y).toBeGreaterThan(-.026);
    expect(geometry.boundingBox.max.y).toBeLessThan(.226);
    expect(geometry.boundingBox.max.x).toBeLessThan(.213);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), 0, 2);
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    geometry.dispose(); material.dispose();
});

test.each(['shell', 'rim', 'lame'])('pauldron %s is a bounded finite shell with a modeled inside', (part) => {
    const geometry = createPauldronGeometry(part);
    expect(geometry.attributes.position.array.every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.normal.array.every(Number.isFinite)).toBe(true);
    expect(geometry.parameters.points.length).toBeGreaterThanOrEqual(7);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox.getSize(new THREE.Vector3()).x).toBeLessThan(.94);
    const surface = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(0, -1, .02), new THREE.Vector3(0, 1, 0)).intersectObject(mesh);
    if (part === 'shell') {
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeGreaterThan(.18);
    } else expect(hits).toHaveLength(0);
    geometry.dispose();
    surface.dispose();
});

test('tailored torso follows a rounded shoulder roll inside the original fitted bounds', () => {
    const geometry = createTailoredTorsoGeometry(0.4, 0.6, 1.1);
    const profile = geometry.parameters.points;
    expect(profile).toHaveLength(9);
    expect(profile[0].x).toBeLessThan(profile[4].x);
    expect(profile.at(-1).x).toBeLessThan(profile[4].x * 0.5);
    expect(profile.every(point => point.x <= .6)).toBe(true);
    expect(geometry.parameters.segments).toBe(24);
    expect(profile.at(-1).y - profile[0].y).toBeCloseTo(1.1);
    expect(geometry.attributes.position.array.every(Number.isFinite)).toBe(true);
    expect(geometry.attributes.normal.array.every(Number.isFinite)).toBe(true);
    geometry.dispose();
});

test('cloth folds are bounded, deterministic and have finite smooth normals and UVs', () => {
    for (const border of [false, true]) {
        const geometry = createDrapedSkirtGeometry(border);
        const second = createDrapedSkirtGeometry(border);
        expect([...geometry.attributes.position.array]).toEqual([...second.attributes.position.array]);
        for (const attribute of Object.values(geometry.attributes)) expect(attribute.array.every(Number.isFinite)).toBe(true);
        geometry.computeBoundingBox();
        expect(geometry.boundingBox.min.z).toBeGreaterThanOrEqual(0);
        expect(geometry.boundingBox.max.z).toBeLessThan(.06);
        expect(geometry.boundingBox.min.y).toBeGreaterThan(-1.4);
        expect(geometry.boundingBox.max.x).toBeLessThan(.31);
        expect(geometry.index.count / 3).toBeLessThanOrEqual(320);
        geometry.dispose(); second.dispose();
    }
});

test('woven skirt border follows existing panel triangles without intersecting them', () => {
    const panel = createDrapedSkirtGeometry(), border = createDrapedSkirtGeometry(true);
    const a = panel.attributes.position, b = border.attributes.position;
    for (let row = 0; row <= 10; row++) for (let column = 0; column < 2; column++) {
        const p = row * 17 + 12 + column, q = row * 2 + column;
        expect(b.getX(q)).toBeCloseTo(a.getX(p), 6);
        expect(b.getY(q)).toBeCloseTo(a.getY(p), 6);
        expect(b.getZ(q) - a.getZ(p)).toBeCloseTo(.002, 6);
    }
    panel.dispose(); border.dispose();
});

test('vestment hem follows the bottom two rows of the cloth and restores with the default outfit', () => {
    const panel = createDrapedSkirtGeometry(), hem = createDrapedSkirtGeometry('hem');
    const a = panel.attributes.position, b = hem.attributes.position;
    for (let row = 0; row < 2; row++) for (let column = 0; column <= 16; column++) {
        const p = (9 + row) * 17 + column, q = row * 17 + column;
        expect(b.getX(q)).toBeCloseTo(a.getX(p), 6);
        expect(b.getY(q)).toBeCloseTo(a.getY(p), 6);
        expect(b.getZ(q) - a.getZ(p)).toBeCloseTo(.002, 6);
    }
    panel.dispose(); hem.dispose();
    const actor = createProceduralCleric();
    for (const side of ['Left', 'Right']) {
        const cloth = actor.getObjectByName(`Cleric_VestmentPanel${side}`);
        const trim = actor.getObjectByName(`Cleric_VestmentHem${side}`);
        expect(trim.position.equals(cloth.position)).toBe(true);
        expect(trim.scale.equals(cloth.scale)).toBe(true);
        expect(trim.quaternion.equals(cloth.quaternion)).toBe(true);
        expect(cloth.material.side).toBe(THREE.DoubleSide);
        expect(trim.material.side).toBe(THREE.DoubleSide);
        expect(cloth.material.flatShading).toBe(false);
    }
    applyProceduralEquipment(actor, { legs: { id: 'vestment-replace', name: 'Plate Greaves', level: 1 } });
    for (const side of ['Left', 'Right']) {
        expect(actor.getObjectByName(`Cleric_VestmentPanel${side}`).visible).toBe(false);
        expect(actor.getObjectByName(`Cleric_VestmentHem${side}`).visible).toBe(false);
    }
    clearProceduralEquipment(actor);
    for (const side of ['Left', 'Right']) {
        expect(actor.getObjectByName(`Cleric_VestmentPanel${side}`).visible).toBe(true);
        expect(actor.getObjectByName(`Cleric_VestmentHem${side}`).visible).toBe(true);
    }
});

test('hood leaves the face opening clear rather than forming a cone over the face', () => {
    const geometry = createOpenHoodGeometry();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const hood = new THREE.Mesh(geometry, material);
    hood.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(0, 0.25, 1), new THREE.Vector3(0, 0, -1)).intersectObject(hood);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.z).toBeLessThan(0);
    geometry.dispose();
    material.dispose();
});

test('paired eyes leave a real gap across the nose', () => {
    const geometry = createPairedEyesGeometry(0.1, 0.04, 0.24);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const eyes = new THREE.Mesh(geometry, material);
    eyes.updateMatrixWorld(true);
    const cast = (x) => new THREE.Raycaster(new THREE.Vector3(x, 0, 1), new THREE.Vector3(0, 0, -1)).intersectObject(eyes);
    expect(cast(0)).toHaveLength(0);
    expect(cast(-0.12).length).toBeGreaterThan(0);
    expect(cast(0.12).length).toBeGreaterThan(0);
    geometry.dispose();
    material.dispose();
});

test.each(classes)('%s cloth panels are visible from both sides', (_name, create, panelName) => {
    const actor = create();
    actor.updateMatrixWorld(true);
    const panel = actor.getObjectByName(panelName);
    panel.geometry.computeBoundingBox();
    const center = panel.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(panel.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(panel.matrixWorld);
    for (const side of [-1, 1]) {
        const ray = new THREE.Raycaster(center.clone().addScaledVector(normal, side), normal.clone().multiplyScalar(-side));
        expect(ray.intersectObject(panel).length).toBeGreaterThan(0);
    }
});

test.each(classes)('%s uses independent garment length and preserves the rig through animation and unequip', (name, create) => {
    const actor = create();
    const bounds = { ...actor.userData.bounds };
    const shoulder = actor.getObjectByName('Rig_UpperArmRight');
    const shoulderRest = shoulder.position.clone();
    expect(shoulder.position.y).toBeGreaterThan(0.6);
    applyProceduralEquipment(actor, {
        chest: { id: 'fit-chest', name: 'Plate Mail', level: 1 },
        legs: { id: 'fit-legs', name: 'Plate Greaves', level: 1 }
    });
    for (const slot of ['chest', 'legs']) {
        const piece = actor.getObjectByName(`EquippedVisual_${slot}`);
        expect(piece.scale.y).toBe(actor.userData.equipmentLengthBySlot[slot]);
        expect(piece.scale.x).toBe(actor.userData.equipmentScaleBySlot?.[slot] ?? 1);
        if (name !== 'Fighter') expect(piece.scale.y).toBeGreaterThan(piece.scale.x);
    }
    const mixer = new THREE.AnimationMixer(actor);
    for (const clip of actor.userData.animations) {
        const action = mixer.clipAction(clip).play();
        for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
            mixer.setTime(clip.duration * fraction);
            actor.updateMatrixWorld(true);
            actor.traverse((child) => expect(child.matrixWorld.elements.every(Number.isFinite)).toBe(true));
        }
        action.stop();
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(actor);
    clearProceduralEquipment(actor);
    expect(shoulder.position.toArray()).toEqual(shoulderRest.toArray());
    expect(actor.userData.bounds).toEqual(bounds);
    expect(actor.getObjectByName('EquippedVisual_chest')).toBeUndefined();
});
